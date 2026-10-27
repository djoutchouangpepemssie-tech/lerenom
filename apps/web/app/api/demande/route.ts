import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lerenom/db';
import {
  expirationCode,
  mobileFrancaisValide,
  normaliseMobileFrancais,
  VALIDITE_CODE_MINUTES,
} from '@lerenom/core';
import { empreinteCode, tireCode } from '@lerenom/securite';
import { secretVerification } from '../../../lib/secrets';

/**
 * Dépôt d'une demande de devis.
 *
 * Une demande entre en base au statut **brouillon**, et elle y reste tant que le numéro de
 * mobile n'a pas été vérifié par code SMS : c'est la règle, et c'est aussi la première barrière
 * anti-fraude. Rien n'est envoyé à un professionnel avant.
 *
 * Deux autres règles sont appliquées ici, et pas ailleurs :
 *   * dans une ville qui n'est pas ouverte, la demande est enregistrée au statut
 *     `en_attente_ouverture` : elle ne part pas, et le client le sait avant d'envoyer ;
 *   * le **texte exact du consentement** est conservé avec la demande. C'est lui qui fera foi,
 *     pas une version réécrite plus tard.
 */

export const dynamic = 'force-dynamic';

const Demande = z.object({
  prestationSlug: z.string().min(1),
  communeCode: z.string().min(2),
  description: z.string().min(10, 'Décrivez votre besoin en quelques mots.').max(600),
  reponses: z.record(z.string(), z.string()).optional(),
  urgence: z.enum(['normale', 'rapide', 'urgente']),
  delaiSouhaite: z.string().max(80).optional(),
  adresse: z.string().max(200).optional(),
  codePostal: z.string().max(10).optional(),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  clientPrenom: z.string().min(2).max(60),
  clientEmail: z.email('Cette adresse électronique ne semble pas valide.'),
  clientTelephone: z.string().refine(mobileFrancaisValide, 'Indiquez un mobile français.'),
  consentementTexte: z.string().min(20),
});

/** Référence lisible et unique : DEM-2026-xxxxxx. */
function reference(): string {
  const annee = new Date().getFullYear();
  const aleatoire = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return `DEM-${annee}-${aleatoire}`;
}

export async function POST(requete: Request): Promise<NextResponse> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const analyse = Demande.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json(
      {
        erreur: 'Demande incomplète.',
        details: analyse.error.issues.map((probleme) => ({
          champ: probleme.path.join('.'),
          message: probleme.message,
        })),
      },
      { status: 400 },
    );
  }

  const donnees = analyse.data;

  const [prestation, commune] = await Promise.all([
    prisma.prestation.findUnique({
      where: { slug: donnees.prestationSlug },
      include: { metier: true },
    }),
    prisma.commune.findUnique({ where: { code: donnees.communeCode } }),
  ]);

  if (prestation === null || commune === null) {
    return NextResponse.json({ erreur: 'Prestation ou commune inconnue.' }, { status: 404 });
  }

  const telephone = normaliseMobileFrancais(donnees.clientTelephone);
  if (telephone === null) {
    return NextResponse.json({ erreur: 'Numéro de mobile invalide.' }, { status: 400 });
  }

  // Anti-doublon : même numéro, même prestation, même commune sur 7 jours.
  const ilYaSeptJours = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const doublon = await prisma.demande.findFirst({
    where: {
      clientTelephone: telephone,
      prestationId: prestation.id,
      communeId: commune.code,
      deposeeLe: { gte: ilYaSeptJours },
    },
    select: { reference: true },
  });

  if (doublon !== null) {
    return NextResponse.json(
      {
        erreur: 'Vous avez déjà déposé cette demande cette semaine.',
        reference: doublon.reference,
      },
      { status: 409 },
    );
  }

  const demande = await prisma.demande.create({
    data: {
      reference: reference(),
      type: 'partagee',
      // Brouillon tant que le téléphone n'est pas vérifié : rien ne part avant.
      statut: commune.statut === 'ouvert' ? 'brouillon' : 'en_attente_ouverture',
      metierId: prestation.metierId,
      prestationId: prestation.id,
      // Le visiteur a choisi lui-même sa prestation dans le catalogue : la confiance est totale.
      confianceClassement: 1,
      communeId: commune.code,
      adresse: donnees.adresse ?? null,
      codePostal: donnees.codePostal ?? commune.codesPostaux[0] ?? null,
      description: donnees.description,
      ...(donnees.reponses !== undefined ? { reponses: donnees.reponses } : {}),
      urgence: donnees.urgence,
      delaiSouhaite: donnees.delaiSouhaite ?? null,
      budgetMin: donnees.budgetMin ?? null,
      budgetMax: donnees.budgetMax ?? null,
      clientPrenom: donnees.clientPrenom,
      clientEmail: donnees.clientEmail,
      clientTelephone: telephone,
      consentementTexte: donnees.consentementTexte,
      consentementDonneLe: new Date(),
      objectifPros: 3,
      origine: requete.headers.get('referer'),
      appareil: requete.headers.get('user-agent'),
    },
    select: { id: true, reference: true, statut: true },
  });

  // Le code de vérification : tiré ici, haché en base, envoyé en clair par SMS et nulle part
  // ailleurs. Le worker prendra ce message dans la file ; tant qu'aucun opérateur n'est branché,
  // il y reste et la demande n'est pas distribuée.
  const code = tireCode();
  await prisma.$transaction([
    prisma.demande.update({
      where: { id: demande.id },
      data: {
        codeVerificationHash: empreinteCode(code, demande.id, secretVerification()),
        codeExpireLe: expirationCode(),
        tentativesVerification: 0,
      },
    }),
    prisma.messageSortant.create({
      data: {
        canal: 'sms',
        modele: 'verification-demande',
        destinataire: telephone,
        corps:
          `Le Renom : votre code de vérification est ${code}. ` +
          `Il est valable ${String(VALIDITE_CODE_MINUTES)} minutes. Demande ${demande.reference}.`,
        statut: 'en_attente',
      },
    }),
  ]);

  return NextResponse.json({
    reference: demande.reference,
    statut: demande.statut,
    villeOuverte: commune.statut === 'ouvert',
  });
}
