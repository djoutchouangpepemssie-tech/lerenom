import { prisma } from '@lerenom/db';
import type { Prisma } from '@lerenom/db';
import {
  PARAMETRES_PAR_DEFAUT,
  ajusteZonesPourFormule,
  engagementInscription,
  slugEntreprise,
  valideInscription,
  type ProblemeInscription,
  type SaisieInscription,
  type VilleChoisie,
} from '@lerenom/core';
import { hacheMotDePasse } from '@lerenom/securite';

/**
 * L'enregistrement d'une inscription professionnelle.
 *
 * Ce fichier orchestre : il lit, appelle les règles de `@lerenom/core`, écrit le résultat. Il
 * ne décide de rien — à une exception près, qui ne peut pas vivre ailleurs : **créer ou
 * revendiquer**. Cette décision dépend de ce que la base contient, et une fonction pure ne
 * peut pas le savoir.
 *
 * Le principe est celui du titre de la page : « Créer ou revendiquer ma fiche ». L'annuaire
 * contient déjà des entreprises venues de la base SIRENE que personne n'a réclamées. Un
 * professionnel dont le SIRET est déjà là ne crée pas un doublon : il reprend sa fiche, avec
 * ses éventuels avis et son ancienneté. Si quelqu'un l'a déjà revendiquée, on refuse — deux
 * personnes ne peuvent pas tenir la même fiche sans que l'une s'en aperçoive.
 *
 * Tout passe par une seule transaction. Une inscription à moitié écrite — l'entreprise sans
 * son compte, les zones sans les métiers — serait pire qu'une inscription refusée : elle
 * bloquerait le SIRET et l'adresse électronique sans donner accès à quoi que ce soit.
 */

/** Ce que rend une inscription qui n'a pas pu être enregistrée. */
export type EchecInscription =
  | { readonly genre: 'saisie'; readonly problemes: readonly ProblemeInscription[] }
  | { readonly genre: 'fiche-deja-revendiquee'; readonly message: string }
  | { readonly genre: 'adresse-deja-utilisee'; readonly message: string }
  | { readonly genre: 'reference-inconnue'; readonly message: string };

/** Ce que rend une inscription enregistrée. */
export type ReussiteInscription = {
  readonly entrepriseId: string;
  readonly utilisateurId: string;
  readonly slug: string;
  /** Vrai quand une fiche existante a été reprise plutôt qu'une nouvelle créée. */
  readonly revendiquee: boolean;
  /** Les villes gardées après ajustement à la formule, et celles retirées. */
  readonly villesConservees: readonly string[];
  readonly villesRetirees: readonly string[];
  readonly paiementRequis: boolean;
};

export type ResultatInscription =
  ({ readonly ok: true } & ReussiteInscription) | ({ readonly ok: false } & EchecInscription);

/**
 * Enregistre une inscription, ou dit précisément pourquoi elle ne peut pas l'être.
 *
 * Ne lève pas pour un refus prévisible : un SIRET déjà revendiqué et une adresse déjà utilisée
 * sont des réponses, pas des pannes. Elle laisse remonter le reste.
 */
export async function enregistreInscription(
  saisie: SaisieInscription,
): Promise<ResultatInscription> {
  const problemes = valideInscription(saisie);
  if (problemes.length > 0) return { ok: false, genre: 'saisie', problemes };

  const siret = saisie.siret.replace(/\s/g, '');
  const email = saisie.email.trim().toLowerCase();

  // Les métiers et les communes sont des slugs et des codes venus du formulaire : ils doivent
  // exister. Un code inventé ne doit pas produire une inscription amputée en silence.
  const [metiers, communes] = await Promise.all([
    prisma.metier.findMany({
      where: { slug: { in: [...saisie.metiers] }, masque: false },
      select: { id: true, slug: true },
    }),
    prisma.commune.findMany({
      where: { code: { in: [...saisie.villes] } },
      select: {
        code: true,
        statut: true,
        population: true,
        codesPostaux: true,
        nom: true,
        latitude: true,
        longitude: true,
      },
    }),
  ]);

  if (metiers.length !== new Set(saisie.metiers).size) {
    return {
      ok: false,
      genre: 'reference-inconnue',
      message: 'Un des métiers choisis n’existe plus. Revenez à l’étape des métiers.',
    };
  }
  if (communes.length !== new Set(saisie.villes).size) {
    return {
      ok: false,
      genre: 'reference-inconnue',
      message: 'Une des villes choisies n’existe plus. Revenez à l’étape des villes.',
    };
  }

  // L'ajustement à la formule est la même fonction que celle qui a affiché, à l'étape 6, les
  // villes qui seraient retirées. Le professionnel ne doit pas découvrir après coup un
  // périmètre différent de celui qu'il a validé.
  const villesPourCore: readonly VilleChoisie[] = communes.map((commune) => ({
    code: commune.code,
    statut: commune.statut,
    population: commune.population ?? 0,
    ...(commune.code === saisie.communeSiege ? { siege: true } : {}),
  }));
  const ajustement = ajusteZonesPourFormule(villesPourCore, saisie.formule, PARAMETRES_PAR_DEFAUT);

  const engagement = engagementInscription(saisie.formule, saisie.annuel);
  const motDePasseHash = await hacheMotDePasse(saisie.motDePasse);

  // Le siège sert d'adresse à l'agence principale. Faute de siège déclaré, la première ville
  // gardée en tient lieu : une agence doit être quelque part pour que les distances se
  // calculent, et une entreprise sans agence ne reçoit aucune demande.
  const codeSiege =
    saisie.communeSiege !== null &&
    ajustement.conservees.some((v) => v.code === saisie.communeSiege)
      ? saisie.communeSiege
      : ajustement.conservees[0]?.code;
  if (codeSiege === undefined) {
    return {
      ok: false,
      genre: 'reference-inconnue',
      message: 'Aucune ville ne subsiste pour cette formule. Revenez à l’étape des villes.',
    };
  }
  const communeSiege = communes.find((c) => c.code === codeSiege);

  try {
    return await prisma.$transaction(async (tx) => {
      const dejaPrise = await tx.utilisateurPro.findUnique({
        where: { email },
        select: { id: true },
      });
      if (dejaPrise !== null) {
        return {
          ok: false as const,
          genre: 'adresse-deja-utilisee' as const,
          message:
            'Cette adresse électronique est déjà rattachée à un compte. Connectez-vous, ou utilisez une autre adresse.',
        };
      }

      const existante = await tx.entreprise.findUnique({
        where: { siret },
        select: { id: true, slug: true, revendiquee: true },
      });

      if (existante !== null && existante.revendiquee) {
        return {
          ok: false as const,
          genre: 'fiche-deja-revendiquee' as const,
          message:
            'Cette entreprise est déjà inscrite sur Le Renom. Connectez-vous, ou écrivez-nous si vous pensez que quelqu’un tient votre fiche à tort.',
        };
      }

      const entreprise =
        existante === null
          ? await tx.entreprise.create({
              data: {
                siret,
                siren: siret.slice(0, 9),
                nom: saisie.nomEntreprise.trim(),
                slug: await slugLibre(tx, saisie.nomEntreprise.trim(), siret),
                source: 'inscription',
                revendiquee: true,
                // `verifiee` reste faux : la vérification du numéro n'a pas encore eu lieu, et
                // c'est elle qui conditionne l'envoi des demandes. La fiche existe dans
                // l'annuaire ; elle ne reçoit rien tant que personne n'a répondu au code.
                verifiee: false,
              },
              select: { id: true, slug: true },
            })
          : await tx.entreprise.update({
              where: { id: existante.id },
              data: { revendiquee: true, nom: saisie.nomEntreprise.trim() },
              select: { id: true, slug: true },
            });

      const utilisateur = await tx.utilisateurPro.create({
        data: {
          entrepriseId: entreprise.id,
          email,
          telephone: saisie.telephone.trim(),
          nom: saisie.nomEntreprise.trim(),
          motDePasseHash,
          roleDansEntreprise: 'gerant',
        },
        select: { id: true },
      });

      await tx.fiche.upsert({
        where: { entrepriseId: entreprise.id },
        create: {
          entrepriseId: entreprise.id,
          description: saisie.description.trim(),
          telephone: saisie.telephone.trim(),
          email,
        },
        update: {
          description: saisie.description.trim(),
          telephone: saisie.telephone.trim(),
          email,
        },
      });

      await tx.agence.create({
        data: {
          entrepriseId: entreprise.id,
          // L'adresse précise n'est pas demandée pendant l'inscription : la ville suffit pour
          // apparaître et pour recevoir des demandes. Elle se complète depuis l'espace pro.
          adresse: communeSiege?.nom ?? '',
          codePostal: communeSiege?.codesPostaux[0] ?? '',
          communeId: codeSiege,
          // Les coordonnées de la commune, recopiées ici : sans elles, aucune distance ne se
          // calcule et l'entreprise n'est éligible à rien. Elles seront remplacées par celles
          // de l'adresse exacte quand elle sera saisie.
          ...(communeSiege?.latitude != null ? { latitude: communeSiege.latitude } : {}),
          ...(communeSiege?.longitude != null ? { longitude: communeSiege.longitude } : {}),
          principale: true,
          contactEmail: email,
          contactTelephone: saisie.telephone.trim(),
        },
      });

      await tx.metierPro.createMany({
        data: metiers.map((metier) => ({
          entrepriseId: entreprise.id,
          metierId: metier.id,
          principal: metier.slug === saisie.metierPrincipal,
        })),
        skipDuplicates: true,
      });

      await tx.zonePro.createMany({
        data: ajustement.conservees.map((ville) => ({
          entrepriseId: entreprise.id,
          communeId: ville.code,
        })),
        skipDuplicates: true,
      });

      await tx.abonnement.create({
        data: {
          entrepriseId: entreprise.id,
          formule: saisie.formule,
          periodicite: saisie.annuel ? 'annuel' : 'mensuel',
          // Une formule payante existe dès la signature, mais elle n'est pas payée : tant que
          // Stripe n'est pas raccordé, `impaye` est l'état exact. Rien dans le classement ni
          // dans la distribution ne regarde un abonnement qui n'est pas « actif », donc cette
          // honnêteté ne donne aucune visibilité non réglée.
          statut: engagement.paiementRequis ? 'impaye' : 'actif',
          debuteLe: new Date(),
          ...(engagement.moisEngagement > 0
            ? { engageJusquA: dansNMois(engagement.moisEngagement) }
            : {}),
        },
      });

      return {
        ok: true as const,
        entrepriseId: entreprise.id,
        utilisateurId: utilisateur.id,
        slug: entreprise.slug,
        revendiquee: existante !== null,
        villesConservees: ajustement.conservees.map((v) => v.code),
        villesRetirees: ajustement.retirees.map((v) => v.code),
        paiementRequis: engagement.paiementRequis,
      };
    });
  } catch (erreur) {
    // Deux inscriptions simultanées sur le même SIRET ou la même adresse : la contrainte
    // d'unicité de la base est la seule garantie qui tienne, les vérifications ci-dessus ne
    // ferment pas la fenêtre entre la lecture et l'écriture.
    const cible = cibleDeConflit(erreur);
    if (cible === 'email') {
      return {
        ok: false,
        genre: 'adresse-deja-utilisee',
        message:
          'Cette adresse électronique vient d’être rattachée à un compte. Connectez-vous, ou utilisez une autre adresse.',
      };
    }
    if (cible === 'siret') {
      return {
        ok: false,
        genre: 'fiche-deja-revendiquee',
        message:
          'Cette entreprise vient d’être inscrite sur Le Renom. Connectez-vous pour accéder à votre espace.',
      };
    }
    throw erreur;
  }
}

/**
 * Un slug libre pour la fiche.
 *
 * Le slug porte déjà le SIRET, donc une collision est improbable ; elle n'est pas impossible
 * — deux entreprises de même nom, l'une entrée sans SIRET. Plutôt que de laisser la contrainte
 * d'unicité refuser une inscription par ailleurs valide, on suffixe.
 */
async function slugLibre(
  tx: Prisma.TransactionClient,
  nom: string,
  siret: string,
): Promise<string> {
  const souhaite = slugEntreprise(nom, siret);
  for (let rang = 0; rang < 20; rang += 1) {
    const candidat = rang === 0 ? souhaite : `${souhaite}-${String(rang + 1)}`;
    const pris = await tx.entreprise.findUnique({
      where: { slug: candidat },
      select: { id: true },
    });
    if (pris === null) return candidat;
  }
  // Vingt homonymes au même SIRET n'arrivera pas. Si cela arrive, mieux vaut une adresse laide
  // qu'une inscription refusée.
  return `${souhaite}-${String(Date.now())}`;
}

function dansNMois(mois: number): Date {
  const echeance = new Date();
  echeance.setMonth(echeance.getMonth() + mois);
  return echeance;
}

/**
 * Lit la cible d'une violation d'unicité, sans dépendre du texte du message.
 *
 * Prisma expose le champ fautif dans `meta.target`. On ne s'en sert que pour choisir le
 * message : une erreur inconnue continue de remonter.
 */
function cibleDeConflit(erreur: unknown): 'email' | 'siret' | null {
  if (typeof erreur !== 'object' || erreur === null) return null;
  const code = (erreur as { code?: unknown }).code;
  if (code !== 'P2002') return null;
  const cible = (erreur as { meta?: { target?: unknown } }).meta?.target;
  const champs = Array.isArray(cible)
    ? cible.map((entree) => (typeof entree === 'string' ? entree : ''))
    : [typeof cible === 'string' ? cible : ''];
  if (champs.some((champ) => champ.includes('email'))) return 'email';
  if (champs.some((champ) => champ.includes('siret') || champ.includes('slug'))) return 'siret';
  return null;
}
