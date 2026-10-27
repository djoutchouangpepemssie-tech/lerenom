import { redirect } from 'next/navigation';

/**
 * L'accueil du site public arrive en phase 2. En attendant, la racine mène à la démonstration
 * du design system : la porte de validation de la phase 0.
 */
export default function Accueil() {
  redirect('/design');
}
