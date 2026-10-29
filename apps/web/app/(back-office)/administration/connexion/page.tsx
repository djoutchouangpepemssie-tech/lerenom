import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ConnexionAdministration } from '@/composants/ConnexionAdministration';
import { adminConnecte } from '@/lib/session-admin';

/** L'entrée du back-office. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connexion',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PageConnexionAdministration() {
  if ((await adminConnecte()) !== null) redirect('/administration');

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f4f2] p-6 text-[#16181D]">
      <ConnexionAdministration />
    </div>
  );
}
