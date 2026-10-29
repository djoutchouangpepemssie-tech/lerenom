import {
  AFRelationship,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from 'pdf-lib';
import { NOM_FICHIER_FACTURX, xmpFacturx } from '@lerenom/core';

/**
 * L'assemblage d'une facture Factur-X : un PDF lisible, et son XML dedans.
 *
 * Jusqu'ici le professionnel disposait de deux moitiés — une page imprimable qu'il devait
 * imprimer lui-même, et un XML à télécharger à part. C'est précisément ce que Factur-X existe
 * pour éviter : **une facture électronique est un seul fichier**, lisible par un humain et
 * exploitable par une machine. Deux fichiers séparés demandent au destinataire de les
 * rapprocher, et il ne le fera pas.
 *
 * Trois choses sont nécessaires pour qu'un logiciel comptable reconnaisse le fichier, et
 * aucune ne suffit seule :
 *
 * 1. **Le XML joint sous le nom `factur-x.xml`.** Le nom est imposé par la norme ; un lecteur
 *    qui en cherche un autre ne trouve rien.
 * 2. **La relation `/Alternative`.** Elle dit que la pièce jointe n'est pas un supplément
 *    mais une autre expression du même document. Sans elle, le XML est traité comme une pièce
 *    jointe quelconque — un logo, une photo — et ignoré.
 * 3. **Les métadonnées XMP** qui déclarent le profil et le nom du fichier. C'est ce qu'un
 *    logiciel interroge *avant* d'ouvrir quoi que ce soit.
 *
 * ## Ce que ce module ne garantit pas
 *
 * Le XMP annonce `pdfaid:part 3`, et le fichier en a la forme. **La conformité PDF/A-3 n'est
 * pas pour autant certifiée** : elle exige en plus un profil colorimétrique de sortie
 * (`OutputIntent`) et des polices intégralement incorporées, deux points qui dépendent du
 * moteur de rendu et qu'aucun test d'ici ne vérifie. Un validateur strict peut donc refuser
 * le fichier là où un logiciel de comptabilité l'acceptera sans difficulté.
 *
 * C'est écrit ici plutôt que caché dans un coin : annoncer une conformité qu'on n'a pas vérifiée
 * est pire que de ne rien annoncer, parce que celui qui s'y fie ne le découvre qu'au moment
 * où son expert-comptable refuse la pièce. Le point est consigné en `QUESTIONS.md` §Q35.
 */

export interface FactureAAssembler {
  /** Le PDF rendu, tel que l'humain le lira. */
  readonly pdf: Uint8Array;
  /** Le XML Factur-X correspondant, octet pour octet celui que la route télécharge. */
  readonly xml: string;
  readonly numero: string;
  readonly emetteur: string;
  readonly emiseLe: Date;
}

/**
 * Joint le XML au PDF et pose les métadonnées.
 *
 * `pdf-lib` sait attacher un fichier, mais pas déclarer la relation Factur-X attend : la
 * bibliothèque écrit `/AFRelationship /Unspecified` par défaut, ce qui vide l'opération de son
 * sens. On la pose donc explicitement.
 */
export async function assembleFacturx(facture: FactureAAssembler): Promise<Uint8Array> {
  const document = await PDFDocument.load(facture.pdf);

  document.setTitle(`Facture ${facture.numero}`);
  document.setAuthor(facture.emetteur);
  document.setProducer('Le Renom');
  document.setCreator('Le Renom');
  document.setCreationDate(facture.emiseLe);
  document.setModificationDate(facture.emiseLe);

  await document.attach(new TextEncoder().encode(facture.xml), NOM_FICHIER_FACTURX, {
    mimeType: 'text/xml',
    description: `Facture ${facture.numero} au format Factur-X`,
    creationDate: facture.emiseLe,
    modificationDate: facture.emiseLe,
    afRelationship: AFRelationship.Alternative,
  });

  // Le paquet XMP remplace les métadonnées que `pdf-lib` écrit de son côté : sans cette
  // substitution, le fichier porte bien le XML mais rien ne dit qu'il s'agit d'un Factur-X, et
  // aucun logiciel comptable n'ira le chercher.
  const xmp = xmpFacturx({
    titre: `Facture ${facture.numero}`,
    auteur: facture.emetteur,
    creeLe: facture.emiseLe,
  });
  const flux = document.context.stream(xmp, {
    Type: 'Metadata',
    Subtype: 'XML',
  });
  document.catalog.set(PDFName.of('Metadata'), document.context.register(flux));

  return document.save();
}

export interface ControleFacturx {
  /** Le nom exact de la pièce jointe, décodé. `null` si aucune n'est présente. */
  readonly nomJoint: string | null;
  /** La relation déclarée. Factur-X exige `Alternative`. */
  readonly relation: string | null;
  /** Le contenu du fichier joint, décompressé. */
  readonly xmlJoint: string | null;
  /** Le XMP du catalogue déclare-t-il l'extension Factur-X ? */
  readonly xmpDeclare: boolean;
}

/**
 * Vérifie qu'un PDF assemblé porte bien ce qu'il annonce.
 *
 * **Lit la structure du document, pas son texte brut.** La première version de ce contrôle
 * cherchait `factur-x.xml` dans les octets du fichier et le trouvait : non pas dans la pièce
 * jointe, mais dans les métadonnées XMP qui en citent le nom. Le contrôle passait donc même
 * si aucun fichier n'était joint — un contrôle qui ne peut pas échouer ne vérifie rien.
 *
 * Deux détails l'imposaient. Le nom d'une pièce jointe est écrit en UTF-16 gros-boutiste, pas
 * en texte lisible ; et son contenu est dans un flux compressé. Les deux sont invisibles à une
 * recherche de chaîne, et tous deux le resteraient le jour où l'assemblage casserait.
 */
export async function controleFacturx(octets: Uint8Array): Promise<ControleFacturx> {
  const document = await PDFDocument.load(octets);

  const noms = document.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  const fichiers = noms?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
  const table = fichiers?.lookupMaybe(PDFName.of('Names'), PDFArray);

  let nomJoint: string | null = null;
  let relation: string | null = null;
  let xmlJoint: string | null = null;

  if (table !== undefined) {
    for (let i = 0; i + 1 < table.size(); i += 2) {
      // Le nom est une chaîne PDF UTF-16BE préfixée d'une marque d'ordre des octets.
      const brut = table.lookup(i)?.toString() ?? '';
      nomJoint = decodeNomPdf(brut);
      const specification = table.lookup(i + 1, PDFDict);
      relation =
        specification.get(PDFName.of('AFRelationship'))?.toString().replace('/', '') ?? null;
      const ef = specification.lookupMaybe(PDFName.of('EF'), PDFDict);
      const flux = ef?.lookup(PDFName.of('F'));
      if (flux instanceof PDFRawStream) {
        xmlJoint = new TextDecoder().decode(decodePDFRawStream(flux).decode());
      }
      break;
    }
  }

  const metadonnees = document.catalog.lookup(PDFName.of('Metadata'));
  const xmp =
    metadonnees instanceof PDFRawStream
      ? new TextDecoder().decode(decodePDFRawStream(metadonnees).decode())
      : '';

  return {
    nomJoint,
    relation,
    xmlJoint,
    xmpDeclare: xmp.includes('urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#'),
  };
}

/**
 * Décode un nom de fichier tel que le PDF le stocke.
 *
 * `pdf-lib` écrit les chaînes non ASCII en hexadécimal UTF-16BE — `<FEFF0066...>` — et les
 * autres entre parenthèses. Les deux formes se présentent, selon le nom.
 */
function decodeNomPdf(brut: string): string {
  if (!brut.startsWith('<')) return brut.replace(/^\(|\)$/g, '');
  const hexadecimal = brut.slice(1, -1);
  let texte = '';
  // La marque d'ordre des octets (FEFF) ouvre la chaîne et ne fait pas partie du nom.
  for (let i = hexadecimal.startsWith('FEFF') ? 4 : 0; i < hexadecimal.length; i += 4) {
    texte += String.fromCharCode(Number.parseInt(hexadecimal.slice(i, i + 4), 16));
  }
  return texte;
}

/**
 * Un PDF d'une page, le strict minimum pour éprouver l'assemblage.
 *
 * Il existe pour les tests : vérifier l'assemblage sur un vrai rendu de facture demanderait
 * un navigateur, et le défaut qu'on cherche ici — un XML absent, une relation manquante — ne
 * dépend pas de ce que la page contient.
 */
export async function pdfMinimal(texte: string): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage();
  page.drawText(texte, { x: 50, y: 700, size: 12 });
  return document.save();
}
