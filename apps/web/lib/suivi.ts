/**
 * Ce qu'un client voit de sa demande, depuis son lien de suivi.
 *
 * Le périmètre est strict : la demande que le jeton désigne, et rien d'autre. Les coordonnées
 * d'un professionnel ne sont lues que s'il a **accepté** — c'est la promesse faite au client
 * comme au pro, et elle se tient ici, dans la requête, pas seulement dans l'affichage.
 */

import { prisma } from '@lerenom/db';

export interface ProAccepte {
  readonly id: string;
  readonly nom: string;
  readonly slug: string | null;
  readonly telephone: string | null;
  readonly email: string | null;
  readonly ville: string | null;
  readonly note: number | null;
  readonly nombreAvis: number;
  readonly accepteeLe: Date | null;
}

export interface SuiviClient {
  readonly reference: string;
  readonly statut: string;
  readonly prenom: string;
  readonly besoin: string;
  readonly ville: string;
  readonly description: string;
  readonly urgence: string;
  readonly deposeeLe: Date;
  readonly clotureeLe: Date | null;
  readonly annuleeLe: Date | null;
  readonly objectifPros: number;
  readonly nombreSollicites: number;
  readonly enAttenteDeReponse: number;
  readonly pros: readonly ProAccepte[];
}

export async function suiviDeLaDemande(demandeId: string): Promise<SuiviClient | null> {
  const demande = await prisma.demande.findUnique({
    where: { id: demandeId },
    select: {
      reference: true,
      statut: true,
      clientPrenom: true,
      description: true,
      urgence: true,
      deposeeLe: true,
      clotureeLe: true,
      annuleeLe: true,
      objectifPros: true,
      commune: { select: { nom: true } },
      prestation: { select: { nom: true } },
      metier: { select: { nom: true } },
      distributions: {
        select: {
          statut: true,
          repondueLe: true,
          // L'agence porte le contact qui répond vraiment ; la fiche sert de repli.
          agence: {
            select: {
              contactTelephone: true,
              contactEmail: true,
              commune: { select: { nom: true } },
            },
          },
          entreprise: {
            select: {
              id: true,
              slug: true,
              nom: true,
              noteMoyenne: true,
              nombreAvis: true,
              fiche: { select: { telephone: true, email: true } },
            },
          },
        },
        orderBy: { repondueLe: 'asc' },
      },
    },
  });

  if (demande === null) return null;

  const acceptees = demande.distributions.filter((d) => d.statut === 'acceptee');
  const enCours = demande.distributions.filter(
    (d) => d.statut === 'envoyee' || d.statut === 'ouverte',
  );

  return {
    reference: demande.reference,
    statut: demande.statut,
    prenom: demande.clientPrenom,
    besoin: demande.prestation?.nom ?? demande.metier?.nom ?? 'Votre demande',
    ville: demande.commune.nom.replace(/\s+Arrondissement$/i, ''),
    description: demande.description,
    urgence: demande.urgence,
    deposeeLe: demande.deposeeLe,
    clotureeLe: demande.clotureeLe,
    annuleeLe: demande.annuleeLe,
    objectifPros: demande.objectifPros,
    nombreSollicites: demande.distributions.length,
    enAttenteDeReponse: enCours.length,
    pros: acceptees.map((d) => ({
      id: d.entreprise.id,
      nom: d.entreprise.nom,
      slug: d.entreprise.slug,
      telephone: d.agence?.contactTelephone ?? d.entreprise.fiche?.telephone ?? null,
      email: d.agence?.contactEmail ?? d.entreprise.fiche?.email ?? null,
      ville: d.agence?.commune.nom.replace(/\s+Arrondissement$/i, '') ?? null,
      note: d.entreprise.noteMoyenne,
      nombreAvis: d.entreprise.nombreAvis,
      accepteeLe: d.repondueLe,
    })),
  };
}
