import { redirect } from 'next/navigation';
import { fermeSessionAdmin } from '@/lib/session-admin';

/**
 * La déconnexion.
 *
 * Une page et non un bouton : le back-office n'a pas de barre persistante côté client, et une
 * requête suffit. La session est **révoquée en base**, pas seulement oubliée du navigateur —
 * un cookie effacé ne protège de rien si quelqu'un en a gardé copie.
 */

export const dynamic = 'force-dynamic';

export default async function PageDeconnexion() {
  await fermeSessionAdmin();
  redirect('/administration/connexion');
}
