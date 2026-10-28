/**
 * Le nettoyage des données laissées par un test interrompu.
 *
 * Un test d'intégration qui échoue en plein milieu laisse ses entreprises, ses demandes et ses
 * liens derrière lui. À la relance, la contrainte d'unicité sur le slug le fait échouer avant
 * même d'avoir commencé — et l'on perd un temps fou à chercher une régression qui n'existe pas.
 *
 * Chaque suite préfixe ses données d'une marque. On supprime tout ce qui la porte, dans l'ordre
 * des dépendances, avant de commencer. Jamais appelé en production : les marques de test ne
 * correspondent à rien de réel, mais le garde-fou est là quand même.
 */

import process from 'node:process';
import { prisma } from './index';

export async function nettoieLesDonneesDeTest(marque: string): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Le nettoyage des données de test ne tourne pas en production.');
  }
  if (!marque.startsWith('test-')) {
    throw new Error(`La marque « ${marque} » ne commence pas par « test- » : refusé.`);
  }

  const entreprises = await prisma.entreprise.findMany({
    where: { slug: { startsWith: marque } },
    select: { id: true },
  });
  const demandes = await prisma.demande.findMany({
    where: { reference: { startsWith: marque } },
    select: { id: true },
  });

  const entrepriseIds = entreprises.map((e) => e.id);
  const demandeIds = demandes.map((d) => d.id);

  if (demandeIds.length > 0) {
    await prisma.recredit.deleteMany({
      where: { contestation: { demandeId: { in: demandeIds } } },
    });
    await prisma.contestation.deleteMany({ where: { demandeId: { in: demandeIds } } });
    await prisma.avis.deleteMany({ where: { demandeId: { in: demandeIds } } });
    await prisma.lienAction.deleteMany({ where: { demandeId: { in: demandeIds } } });
    await prisma.messageSortant.deleteMany({ where: { demandeId: { in: demandeIds } } });
    await prisma.appelSuivi.deleteMany({ where: { demandeId: { in: demandeIds } } });
    await prisma.suiviDemande.deleteMany({ where: { demandeId: { in: demandeIds } } });
    await prisma.noteInterne.deleteMany({ where: { demandeId: { in: demandeIds } } });
    await prisma.distribution.deleteMany({ where: { demandeId: { in: demandeIds } } });
    await prisma.tacheAValider.deleteMany({ where: { objetId: { in: demandeIds } } });
    await prisma.demande.deleteMany({ where: { id: { in: demandeIds } } });
  }

  if (entrepriseIds.length > 0) {
    await prisma.recredit.deleteMany({
      where: { contestation: { entrepriseId: { in: entrepriseIds } } },
    });
    await prisma.contestation.deleteMany({ where: { entrepriseId: { in: entrepriseIds } } });
    await prisma.alerte.deleteMany({ where: { objetId: { in: entrepriseIds } } });
    await prisma.exclusivite.deleteMany({ where: { entrepriseId: { in: entrepriseIds } } });
    await prisma.quotaMensuel.deleteMany({ where: { entrepriseId: { in: entrepriseIds } } });
    await prisma.abonnement.deleteMany({ where: { entrepriseId: { in: entrepriseIds } } });
    await prisma.entreprise.deleteMany({ where: { id: { in: entrepriseIds } } });
  }
}
