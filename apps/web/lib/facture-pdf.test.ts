import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { NOM_FICHIER_FACTURX } from '@lerenom/core';
import { assembleFacturx, controleFacturx, pdfMinimal } from './facture-pdf.ts';

/**
 * L'assemblage Factur-X.
 *
 * Ce qu'on éprouve ici n'est pas la mise en page — elle se vérifie à l'œil, sur les captures —
 * mais le fait que le fichier produit **porte** ce qu'il annonce. Un assemblage raté donne un
 * PDF d'apparence parfaite dont le XML est absent : l'humain ne voit aucune différence, la
 * machine ne trouve rien, et personne ne s'en aperçoit avant que l'expert-comptable refuse la
 * pièce.
 */

const XML =
  '<?xml version="1.0" encoding="UTF-8"?><rsm:CrossIndustryInvoice>témoin</rsm:CrossIndustryInvoice>';

async function assemble() {
  return assembleFacturx({
    pdf: await pdfMinimal('Facture F-2026-0001'),
    xml: XML,
    numero: 'F-2026-0001',
    emetteur: 'Durand & Fils',
    emiseLe: new Date('2026-03-04T10:00:00Z'),
  });
}

describe('assembleFacturx', () => {
  it('joint le XML sous le nom imposé par la norme', async () => {
    const controle = await controleFacturx(await assemble());
    expect(controle.nomJoint).toBe(NOM_FICHIER_FACTURX);
  });

  it('déclare la relation « Alternative », sans laquelle le XML passe pour une pièce jointe quelconque', async () => {
    const controle = await controleFacturx(await assemble());
    expect(controle.relation).toBe('Alternative');
  });

  it('pose les métadonnées XMP que le logiciel comptable interroge en premier', async () => {
    const controle = await controleFacturx(await assemble());
    expect(controle.xmpDeclare).toBe(true);
  });

  it('reste un PDF ouvrable, et garde sa page', async () => {
    const document = await PDFDocument.load(await assemble());
    expect(document.getPageCount()).toBe(1);
    expect(document.getTitle()).toBe('Facture F-2026-0001');
    expect(document.getAuthor()).toBe('Durand & Fils');
  });

  it('conserve le XML octet pour octet : un caractère perdu invalide la facture', async () => {
    const controle = await controleFacturx(await assemble());
    expect(controle.xmlJoint).toBe(XML);
  });

  it('échoue quand rien n’est joint — faute de quoi le contrôle ne vérifierait rien', async () => {
    // La première version de ce contrôle cherchait le nom dans les octets du fichier et le
    // trouvait dans le XMP, qui le cite. Elle passait donc sur un PDF sans pièce jointe.
    const controle = await controleFacturx(await pdfMinimal('Sans pièce jointe'));
    expect(controle.nomJoint).toBeNull();
    expect(controle.xmlJoint).toBeNull();
  });
});
