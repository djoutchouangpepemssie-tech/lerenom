import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Manrope } from 'next/font/google';
import './globals.css';

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
  metadataBase: new URL('https://lerenom.fr'),
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
