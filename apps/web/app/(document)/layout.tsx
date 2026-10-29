import type { Metadata } from 'next';
import '../globals.css';

/**
 * La disposition des documents imprimables.
 *
 * Elle ne porte **ni en-tête, ni pied de page, ni navigation**. Un devis imprimé avec le menu
 * du site dessus n'est pas un devis : c'est une capture d'écran. Le document occupe la page, et
 * rien d'autre.
 *
 * La mise en page est en millimètres. C'est inhabituel sur le web et juste ici : la cible est
 * une feuille A4, et un `rem` ne veut rien dire sur du papier. `@page` fixe le format et les
 * marges d'impression ; à l'écran, la même largeur est simulée pour que ce qu'on voit soit ce
 * qui sortira.
 *
 * À l'écran, sous 210 mm, c'est la **page** qui défile horizontalement, et non un conteneur
 * intérieur. La nuance compte pour la vérification : une capture pleine page ne photographie
 * que ce que la page contient, pas ce qu'un `overflow` intérieur cache. Avec un conteneur
 * défilant, la moitié droite du document — le titre, le numéro, les dates, les montants —
 * n'apparaissait sur aucune capture à 390 px, et c'était invisible dans le rapport.
 *
 * `print-color-adjust: exact` est posé sur le document : sans lui, les navigateurs effacent
 * les fonds à l'impression, et les filets de couleur du professionnel disparaissent — on
 * imprimerait un document différent de celui qu'on a validé à l'écran.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

const STYLE_DOCUMENT = `
  .lr-document {
    width: 210mm;
    min-height: 297mm;
    padding: 14mm 15mm;
    box-sizing: border-box;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  /* À l'écran : la feuille posée sur un fond neutre, avec son ombre, pour qu'on la voie
     comme une feuille. On ne descend pas sous 210 mm — on laisse le document défiler
     horizontalement sur un téléphone plutôt que de le reflouer : un document reflué n'est
     plus le document qui sera imprimé, et c'est précisément ce qu'on veut vérifier. */
  @media screen {
    /* Le design system interdit le défilement horizontal partout — c'est la bonne règle pour
       un site qui se lit au pouce. Ici elle devient un piège : masquer le débordement avec
       un document plus large que l'écran laisse la moitié droite de la facture — le titre, le
       numéro, les dates, les totaux — ni visible ni atteignable sur un téléphone. Elle est
       simplement coupée, sans barre de défilement pour le dire. C'est la seule page du
       produit qui a une largeur imposée par le papier, et donc la seule qui doive défiler. */
    html,
    body {
      overflow-x: auto;
    }
    body {
      background: #e8e6e1;
      padding: 1.5rem 0;
      /* Sans cela, le fond s'arrête à la largeur de la fenêtre et le document défilé
         apparaît posé sur du blanc à partir du bord droit de l'écran. */
      min-width: max-content;
    }
    .lr-document {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 12px 32px rgba(0, 0, 0, 0.12);
    }
  }

  @page {
    size: A4;
    margin: 14mm 15mm;
  }

  @media print {
    body {
      background: #fff;
    }
    /* Les marges passent à @page : les cumuler ferait un document de guingois. */
    .lr-document {
      width: auto;
      min-height: 0;
      padding: 0;
      box-shadow: none;
    }
    .lr-sans-impression {
      display: none !important;
    }
  }
`;

export default function DispositionDocument({ children }: { readonly children: React.ReactNode }) {
  return (
    <>
      <style>{STYLE_DOCUMENT}</style>
      <div className="lr-feuille">{children}</div>
    </>
  );
}
