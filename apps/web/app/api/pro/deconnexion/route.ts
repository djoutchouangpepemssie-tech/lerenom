import { NextResponse } from 'next/server';
import { fermeSession } from '@/lib/session-pro';

/** La déconnexion : la session est révoquée en base, pas seulement oubliée côté navigateur. */
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  await fermeSession();
  return NextResponse.json({ deconnecte: true });
}
