import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lerenom/db';
import { consommeLien, resoudLien } from '@lerenom/liens';
import {
  COMMENTAIRE_MAX,
  CRITERES_AVIS,
  droitDeDeposerUnAvis,
  NOTE_MAX,
  NOTE_MIN,
  signauxDeModeration,
  valideAvis,
} from '@lerenom/core';

/**
 * Les actions qu'un client peut faire depuis son lien reçu par SMS.
 *
 * Deux, et chacune n'est permise qu'au lien qui la porte : **annuler** sa demande depuis le
 * lien de suivi, **déposer un avis** depuis le lien d'invitation. Un lien de suivi ne dépose
 * pas d'avis, et un lien d'avis n'annule rien.
 *
 * L'annulation est gratuite et sans justification — le motif est demandé, jamais exigé.
 *
 * L'annulation ne touche pas aux professionnels qui ont **déjà accepté** : ils ont été
 * facturés, ils ont les coordonnées, et faire disparaître la demande de leur tableau de bord
 * reviendrait à leur reprendre ce qu'ils ont payé. Les propositions encore en attente, elles,
 * sont retirées : les laisser serait envoyer des pros chez quelqu'un qui n'attend plus personne.
 */

export const dynamic = 'force-dynamic';

const Annulation = z.object({
  action: z.literal('annuler'),
  motif: z.string().max(400).optional(),
});

const CLES_CRITERES = CRITERES_AVIS.map((critere) => critere.cle);

const DepotAvis = z.object({
  action: z.literal('deposer-avis'),
  note: z.number().int().min(NOTE_MIN).max(NOTE_MAX),
  criteres: z
    .record(
      z.enum(CLES_CRITERES as [string, ...string[]]),
      z.number().int().min(NOTE_MIN).max(NOTE_MAX),
    )
    .optional(),
  commentaire: z.string().max(COMMENTAIRE_MAX).optional(),
});

const Action = z.discriminatedUnion('action', [Annulation, DepotAvis]);

/** Les statuts depuis lesquels une annulation a encore un sens. */
const ANNULABLES = ['brouillon', 'en_distribution', 'en_attente_de_relance', 'en_pause'];

export async function POST(
  requete: Request,
  { params }: { readonly params: Promise<{ readonly jeton: string }> },
): Promise<NextResponse> {
  const { jeton } = await params;

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const analyse = Action.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Action inconnue.' }, { status: 400 });
  }

  const resolution = await resoudLien(jeton);
  if (resolution.issue !== 'valide') {
    return NextResponse.json(
      { erreur: 'Ce lien n’est plus valide.', etat: resolution.issue },
      { status: 410 },
    );
  }

  if (analyse.data.action === 'deposer-avis') {
    if (resolution.lien.action !== 'deposer_avis') {
      return NextResponse.json({ erreur: 'Ce lien ne permet pas cette action.' }, { status: 403 });
    }
    return deposeAvis(resolution.lien, analyse.data, requete);
  }

  if (resolution.lien.action !== 'voir_pros') {
    return NextResponse.json({ erreur: 'Ce lien ne permet pas cette action.' }, { status: 403 });
  }

  const demande = await prisma.demande.findUnique({
    where: { id: resolution.lien.demandeId },
    select: { id: true, statut: true, annuleeLe: true, reference: true },
  });

  if (demande === null) {
    return NextResponse.json({ erreur: 'Cette demande n’existe plus.' }, { status: 404 });
  }

  if (demande.annuleeLe !== null) {
    // Annuler deux fois n'est pas une erreur du client : c'est un double clic, ou un retour
    // en arrière. On répond comme si c'était la première fois.
    return NextResponse.json({ annuleeLe: demande.annuleeLe.toISOString(), dejaAnnulee: true });
  }

  if (!ANNULABLES.includes(demande.statut)) {
    return NextResponse.json(
      { erreur: 'Cette demande est déjà close : il n’y a plus rien à annuler.' },
      { status: 409 },
    );
  }

  const annuleeLe = new Date();

  await prisma.$transaction([
    prisma.demande.update({
      where: { id: demande.id },
      data: {
        statut: 'annulee',
        annuleeLe,
        clotureeLe: annuleeLe,
        motifAnnulation: analyse.data.motif ?? null,
      },
    }),
    // Les propositions en attente sont retirées, pas refusées : le pro n'a rien refusé, et
    // rien ne doit lui être compté.
    prisma.distribution.updateMany({
      where: { demandeId: demande.id, statut: { in: ['envoyee', 'ouverte'] } },
      data: { statut: 'retiree', repondueLe: annuleeLe },
    }),
  ]);

  await consommeLien(resolution.lien.id, requete.headers.get('x-forwarded-for') ?? undefined);

  return NextResponse.json({ annuleeLe: annuleeLe.toISOString() });
}

/**
 * Enregistre un avis.
 *
 * Il entre **en attente**, jamais publié d'emblée : la charte l'annonce, et c'est ce qui
 * permet de tenir la promesse d'un contrôle avant publication. Les signaux de modération sont
 * calculés ici et consignés dans une tâche à valider, pour que le back-office voie d'abord ce
 * qui mérite un œil — un numéro de téléphone, une accusation grave — sans que rien ne soit
 * refusé automatiquement. Un automate qui refuserait seul finirait par refuser un client
 * mécontent et honnête.
 */
async function deposeAvis(
  lien: { readonly id: string; readonly demandeId: string; readonly cibleId: string | null },
  saisi: z.infer<typeof DepotAvis>,
  requete: Request,
): Promise<NextResponse> {
  if (lien.cibleId === null) {
    return NextResponse.json(
      { erreur: 'Ce lien ne désigne aucun professionnel.' },
      { status: 400 },
    );
  }

  const erreurs = valideAvis(saisi);
  if (erreurs.length > 0) {
    return NextResponse.json(
      { erreur: 'Votre avis est incomplet.', details: erreurs },
      { status: 400 },
    );
  }

  const [demande, distribution, avisExistant, travaux] = await Promise.all([
    prisma.demande.findUnique({
      where: { id: lien.demandeId },
      select: { clientPrenom: true, annuleeLe: true },
    }),
    prisma.distribution.findFirst({
      where: { demandeId: lien.demandeId, entrepriseId: lien.cibleId, statut: 'acceptee' },
      select: { id: true },
    }),
    prisma.avis.findUnique({ where: { demandeId: lien.demandeId }, select: { id: true } }),
    prisma.suiviDemande.findFirst({
      where: { demandeId: lien.demandeId, entrepriseId: lien.cibleId, etape: 'travaux_realises' },
      select: { creeLe: true },
    }),
  ]);

  if (demande === null || distribution === null) {
    return NextResponse.json({ erreur: 'Cette intervention est introuvable.' }, { status: 404 });
  }

  const droit = droitDeDeposerUnAvis({
    travauxRealisesLe: travaux?.creeLe ?? null,
    avisDejaDepose: avisExistant !== null,
    demandeAnnuleeLe: demande.annuleeLe,
  });

  if (droit.issue === 'deja-depose') {
    // Le lien est à usage unique, donc ce cas ne se produit qu'à la course : deux requêtes
    // parties ensemble franchissent le garde du lien avant qu'il ne se ferme. C'est
    // « une demande, un avis » en base qui tranche, et un double clic n'est pas une faute du
    // client : on ne lui montre pas une erreur.
    return NextResponse.json({ depose: true, dejaDepose: true });
  }
  if (droit.issue !== 'peut-deposer') {
    return NextResponse.json(
      { erreur: 'Un avis ne peut être déposé qu’après une intervention réellement effectuée.' },
      { status: 409 },
    );
  }

  const commentaire = saisi.commentaire?.trim() ?? '';
  const signaux = signauxDeModeration(commentaire);

  const avis = await prisma.avis.create({
    data: {
      entrepriseId: lien.cibleId,
      demandeId: lien.demandeId,
      note: saisi.note,
      ...(saisi.criteres !== undefined && Object.keys(saisi.criteres).length > 0
        ? { criteres: saisi.criteres }
        : {}),
      ...(commentaire !== '' ? { commentaire } : {}),
      auteurPrenom: demande.clientPrenom,
      statut: 'en_attente',
    },
    select: { id: true },
  });

  await prisma.tacheAValider.create({
    data: {
      type: 'avis_a_moderer',
      objetId: avis.id,
      explication:
        signaux.length > 0
          ? `Signaux à relire : ${signaux.join(', ')}.`
          : 'Aucun signal automatique : relecture de routine.',
    },
  });

  await consommeLien(lien.id, requete.headers.get('x-forwarded-for') ?? undefined);

  return NextResponse.json({ depose: true });
}
