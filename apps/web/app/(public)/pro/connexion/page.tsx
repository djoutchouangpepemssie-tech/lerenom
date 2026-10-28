import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Conteneur, Section } from '@lerenom/ui';
import { FormulaireConnexion } from '@/composants/FormulaireConnexion';
import { proConnecte } from '@/lib/session-pro';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connexion professionnelle',
  description: 'Accédez à votre espace : vos demandes, votre fiche et vos statistiques.',
  robots: { index: false, follow: true },
};

export default async function PageConnexion() {
  // Déjà connecté : on ne lui remontre pas un formulaire qu'il a déjà rempli.
  if ((await proConnecte()) !== null) redirect('/pro/espace');

  return (
    <Section fond="creme" className="py-14 md:py-20">
      <Conteneur>
        <FormulaireConnexion />
      </Conteneur>
    </Section>
  );
}
