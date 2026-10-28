import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Manrope } from 'next/font/google';
import './globals.css';
import { baseDuSite } from '@/lib/site';

/*
 * Polices auto-hébergées par next/font : aucun appel à un serveur de polices au chargement,
 * donc aucun décalage de mise en page et aucune dépendance externe pour le visiteur.
 */
const policeTitre = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--police-titre',
});

const policeTexte = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--police-texte',
});

export const metadata: Metadata = {
  title: {
    default: 'Le Renom — trouvez le bon professionnel près de chez vous',
    template: '%s · Le Renom',
  },
  description:
    'Le Renom référence les entreprises de toute l’Île-de-France. Trouvez un professionnel par métier et par ville, consultez ses avis vérifiés et demandez jusqu’à 3 devis gratuitement.',
  // Jamais écrite en dur : une préproduction qui annonce les adresses canoniques de la
  // production présente deux sites réclamant les mêmes pages, et c'est une erreur dont on
  // paie les conséquences des mois plus tard.
  metadataBase: new URL(baseDuSite()),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F1115',
};

export default function DispositionRacine({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${policeTitre.variable} ${policeTexte.variable}`}>
      <body>{children}</body>
    </html>
  );
}
