import { NextResponse } from 'next/server';
import { z } from 'zod';
import { modifieLeCatalogue, valideUnUnivers } from '@/lib/administration-catalogue';
import { adminConnecte, inscritAuJournal } from '@/lib/session-admin';

/**
 * Les modifications du catalogue.
 *
 * **Tout passe au journal d'audit**, avec l'état avant et après. Le catalogue gouverne ce que
 * le site propose : un métier masqué disparaît des résultats, un nom changé change des pages
 * indexées. Six mois plus tard, « qui a masqué la plomberie, et quand ? » doit avoir une
 * réponse.
 *
 * **Le rôle décide.** Le catalogue est éditorial : l'administrateur et le support y touchent,
 * le commercial et la comptabilité non. Un contrôle de rôle qui laisserait passer tout le
 * monde serait un contrôle décoratif.
 *
 * Le slug n'est pas modifiable, et ce n'est pas un oubli : il vit dans des adresses déjà
 * indexées. Le schéma est `.strict()` pour que la requête qui en demande le changement soit
 * **refusée**, et non obéie à moitié : par défaut, Zod aurait retiré la clé en silence et
 * renvoyé un succès, laissant croire au changement.
 */

export const dynamic = 'force-dynamic';

const ROLES_AUTORISES = new Set(['administrateur', 'support']);

// `.strict()` et non le comportement par défaut : Zod **retire** les clés inconnues en
// silence. Une requête portant un `slug` aurait donc été acceptée, le slug simplement ignoré,
// et l'appelant aurait cru l'avoir changé. Un refus explicite vaut mieux qu'une obéissance
// partielle — c'est la différence entre « je ne peux pas » et « j'ai fait semblant ».
const Modification = z
  .object({
    niveau: z.enum(['univers', 'metier', 'prestation']),
    id: z.string().min(1).max(40),
    nom: z.string().trim().min(1).max(120).optional(),
    masque: z.boolean().optional(),
    aValider: z.boolean().optional(),
    batiment: z.boolean().optional(),
  })
  .strict();

const ValidationUnivers = z
  .object({
    action: z.literal('valider-univers'),
    universId: z.string().min(1).max(40),
  })
  .strict();

export async function PATCH(requete: Request): Promise<NextResponse> {
  const admin = await adminConnecte();
  if (admin === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }
  if (!ROLES_AUTORISES.has(admin.role)) {
    return NextResponse.json(
      { erreur: 'Le catalogue est modifiable par l’administration et le support.' },
      { status: 403 },
    );
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const validation = ValidationUnivers.safeParse(corps);
  if (validation.success) {
    const resultat = await valideUnUnivers(validation.data.universId);
    if (!resultat.ok) {
      return NextResponse.json({ erreur: resultat.message }, { status: 404 });
    }
    await inscritAuJournal(
      admin.adminId,
      'catalogue.valider-univers',
      'univers',
      validation.data.universId,
      { apres: { valides: resultat.valides } },
    );
    return NextResponse.json({ valides: resultat.valides });
  }

  const analyse = Modification.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json(
      {
        erreur:
          'Modification impossible : le slug n’est pas modifiable, le nom ne peut pas être vide.',
      },
      { status: 400 },
    );
  }

  const { niveau, id, ...modification } = analyse.data;
  const resultat = await modifieLeCatalogue(niveau, id, modification);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  await inscritAuJournal(admin.adminId, 'catalogue.modifier', niveau, id, {
    avant: resultat.avant,
    apres: resultat.apres,
  });

  return NextResponse.json({ ok: true });
}
