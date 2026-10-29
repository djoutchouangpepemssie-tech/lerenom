import { prisma } from '@lerenom/db';

/**
 * Le carnet de clients d'un professionnel.
 *
 * Il manquait entièrement, et l'absence avait des conséquences en chaîne. Le code *vérifiait*
 * qu'un client appartient bien à l'entreprise, en *listait* pour un menu déroulant — et rien
 * n'en créait jamais. Le menu était donc toujours vide pour un vrai professionnel, le devis
 * partait sans client, la facture qui en naît aussi, et une facture sans destinataire
 * identifié n'est pas une facture au sens de l'article L441-9 du code de commerce.
 *
 * ## Ce que la saisie exige, et ce qu'elle laisse libre
 *
 * **Le nom seul est obligatoire.** Un artisan qui prépare un devis dans sa camionnette n'a
 * pas toujours l'adresse sous la main ; la lui réclamer tout de suite le ferait renoncer au
 * devis, pas chercher l'adresse. L'adresse manquante sera réclamée à l'émission de la
 * facture, qui est le moment où elle devient obligatoire — et l'écran le dit alors.
 *
 * **Le SIREN est obligatoire pour un client professionnel**, et lui seul. C'est une mention
 * obligatoire de la facture entre professionnels, et son absence fait tomber la facture ;
 * l'exiger d'un particulier n'aurait aucun sens.
 *
 * ## Pourquoi on ne supprime pas
 *
 * Un client porte des devis et des factures émises. L'effacer romprait le lien d'une pièce
 * qui fait foi — la facture garderait son numéro et perdrait son destinataire. Le carnet
 * s'archive : le client disparaît des menus, ses documents restent entiers.
 */

export interface ClientDuPro {
  readonly id: string;
  readonly nom: string;
  readonly email: string | null;
  readonly telephone: string | null;
  readonly adresse: string | null;
  readonly codePostal: string | null;
  readonly ville: string | null;
  readonly professionnel: boolean;
  readonly siren: string | null;
  readonly devis: number;
  readonly factures: number;
  /** L'adresse manque : la facture ne pourra pas être émise en l'état. */
  readonly adresseIncomplete: boolean;
}

export async function clientsDuPro(entrepriseId: string): Promise<readonly ClientDuPro[]> {
  const clients = await prisma.clientPro.findMany({
    where: { entrepriseId },
    orderBy: { nom: 'asc' },
    select: {
      id: true,
      nom: true,
      email: true,
      telephone: true,
      adresse: true,
      codePostal: true,
      ville: true,
      professionnel: true,
      siren: true,
      _count: { select: { devis: true, factures: true } },
    },
  });

  return clients.map((client) => ({
    id: client.id,
    nom: client.nom,
    email: client.email,
    telephone: client.telephone,
    adresse: client.adresse,
    codePostal: client.codePostal,
    ville: client.ville,
    professionnel: client.professionnel,
    siren: client.siren,
    devis: client._count.devis,
    factures: client._count.factures,
    adresseIncomplete:
      client.adresse === null ||
      client.adresse.trim() === '' ||
      client.codePostal === null ||
      client.ville === null,
  }));
}

export interface SaisieClient {
  readonly nom: string;
  readonly email: string;
  readonly telephone: string;
  readonly adresse: string;
  readonly codePostal: string;
  readonly ville: string;
  readonly professionnel: boolean;
  readonly siren: string;
}

export type ResultatClient =
  { readonly ok: true; readonly id: string } | { readonly ok: false; readonly message: string };

/** Vide devient `null` : une chaîne vide en base se lit comme « renseigné », et ne l'est pas. */
function ouNull(valeur: string): string | null {
  const propre = valeur.trim();
  return propre === '' ? null : propre;
}

function valide(saisie: SaisieClient): string | null {
  if (saisie.nom.trim() === '') return 'Le nom du client est obligatoire.';
  if (saisie.nom.trim().length > 140) return 'Ce nom est trop long.';

  // Le SIREN d'un client professionnel est une mention obligatoire de la facture. Un contrôle
  // de longueur, pas de clé de Luhn : refuser un SIREN valide à cause d'un contrôle trop
  // zélé bloquerait une facture légitime, ce qui coûte plus cher qu'un chiffre erroné.
  if (saisie.professionnel) {
    const siren = saisie.siren.replace(/\s/g, '');
    if (siren === '') return 'Le SIREN est obligatoire pour un client professionnel.';
    if (!/^\d{9}$/.test(siren)) return 'Un SIREN compte neuf chiffres.';
  }

  const codePostal = saisie.codePostal.trim();
  if (codePostal !== '' && !/^\d{5}$/.test(codePostal)) {
    return 'Un code postal compte cinq chiffres.';
  }
  const email = saisie.email.trim();
  if (email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'Cette adresse électronique ne semble pas valide.';
  }
  return null;
}

function donnees(saisie: SaisieClient) {
  return {
    nom: saisie.nom.trim(),
    email: ouNull(saisie.email),
    telephone: ouNull(saisie.telephone),
    adresse: ouNull(saisie.adresse),
    codePostal: ouNull(saisie.codePostal),
    ville: ouNull(saisie.ville),
    professionnel: saisie.professionnel,
    // Le SIREN d'un particulier est effacé plutôt que gardé : un client repassé en
    // particulier ne doit pas traîner un numéro qui ne le concerne plus et que la facture
    // irait republier.
    siren: saisie.professionnel ? ouNull(saisie.siren.replace(/\s/g, '')) : null,
  };
}

export async function creeUnClient(
  entrepriseId: string,
  saisie: SaisieClient,
): Promise<ResultatClient> {
  const erreur = valide(saisie);
  if (erreur !== null) return { ok: false, message: erreur };

  const client = await prisma.clientPro.create({
    data: { entrepriseId, ...donnees(saisie) },
    select: { id: true },
  });
  return { ok: true, id: client.id };
}

export async function modifieUnClient(
  entrepriseId: string,
  clientId: string,
  saisie: SaisieClient,
): Promise<ResultatClient> {
  const erreur = valide(saisie);
  if (erreur !== null) return { ok: false, message: erreur };

  // `updateMany` avec l'entreprise dans le filtre : un `update` par identifiant seul
  // laisserait modifier le client d'une autre entreprise à qui devinerait un identifiant.
  const { count } = await prisma.clientPro.updateMany({
    where: { id: clientId, entrepriseId },
    data: donnees(saisie),
  });
  if (count === 0) return { ok: false, message: 'Ce client n’existe pas.' };
  return { ok: true, id: clientId };
}
