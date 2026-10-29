import { ImageResponse } from 'next/og';

/**
 * Le gabarit des images de partage.
 *
 * Une fiche collée dans une conversation n'affichait ni titre, ni image : un rectangle gris
 * et une adresse. C'est pourtant par là que passent les recommandations entre voisins, qui
 * sont le bouche-à-oreille de ce métier.
 *
 * **Un seul gabarit, pas une image par page dessinée à la main.** Trois images écrites
 * séparément divergeraient à la première retouche de l'identité, et l'une d'elles resterait
 * à l'ancienne charte pendant des mois sans que personne ne s'en aperçoive — on ne regarde
 * jamais ses propres aperçus de partage.
 *
 * ## Une seule police, et aucune déclaration de famille
 *
 * `ImageResponse` ne sait pas lire une police installée : il faut lui fournir les octets du
 * fichier. Les chercher au moment du rendu, sur un service extérieur, ferait dépendre
 * l'aperçu d'un partage d'une requête réseau qui peut échouer — et quand elle échoue,
 * l'image entière échoue.
 *
 * Le moteur ne dispose donc que de sa police intégrée, sans empattements. Une première
 * version déclarait malgré tout `fontFamily: 'serif'` sur le titre et `'sans-serif'` sur le
 * reste : ces déclarations **ne faisaient rien**, et l'image rendue était la même. Les
 * laisser aurait donné à lire un choix typographique qui n'existait pas. Ce qui porte
 * l'identité ici, ce sont les couleurs, l'échelle des tailles et le filet doré.
 */

export const TAILLE_PARTAGE = { width: 1200, height: 630 };
export const TYPE_PARTAGE = 'image/png';

const NUIT = '#0f1115';
const CREME = '#f6f4ee';
const OR = '#c9a24d';
const OR_CLAIR = '#e2c27a';

export interface ContenuPartage {
  /** La ligne la plus grande : le métier, la ville, le nom de l'entreprise. */
  readonly titre: string;
  /** Une ligne au-dessus du titre : la catégorie, le département. */
  readonly surtitre?: string;
  /** Une ligne en dessous : la promesse, la note, le nombre d'avis. */
  readonly soustitre?: string;
}

/**
 * Fabrique l'image.
 *
 * Le titre est tronqué plutôt que réduit : une image de partage s'affiche à trois cents
 * pixels de large dans un fil de discussion, et un titre rétréci pour tenir en entier y
 * devient illisible. Mieux vaut en montrer moins, lisiblement.
 */
export function imagePartage(contenu: ContenuPartage): ImageResponse {
  const titre =
    contenu.titre.length > 72 ? `${contenu.titre.slice(0, 71).trimEnd()}…` : contenu.titre;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: NUIT,
        color: CREME,
        padding: '72px 80px',
      }}
    >
      {/* Aucun écart entre le nom et le point : le point doré est la marque, pas une
          ponctuation qui suit le mot. */}
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.01em' }}>Le Renom</span>
        <span style={{ fontSize: 40, color: OR }}>.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {contenu.surtitre !== undefined && (
          <span
            style={{
              fontSize: 26,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: OR_CLAIR,
            }}
          >
            {contenu.surtitre}
          </span>
        )}
        <span style={{ fontSize: 76, lineHeight: 1.08, fontWeight: 700 }}>{titre}</span>
        {contenu.soustitre !== undefined && (
          <span style={{ fontSize: 30, color: '#c9c6bd' }}>{contenu.soustitre}</span>
        )}
      </div>

      {/* Le filet doré : la seule marque graphique qui survit à une miniature de trois
            cents pixels, où le texte secondaire est déjà illisible. */}
      <div style={{ display: 'flex', width: 220, height: 6, backgroundColor: OR }} />
    </div>,
    TAILLE_PARTAGE,
  );
}
