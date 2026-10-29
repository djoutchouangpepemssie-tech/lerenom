import {
  LIBELLES_UNITE,
  LIBELLE_CATEGORIE_OPERATION,
  MENTION_AUTOLIQUIDATION,
  MENTION_FRANCHISE_TVA,
  formatEuros,
  montantLigneHT,
  phrasePenalites,
  type AdressePostale,
} from '@lerenom/core';
import type { DocumentAImprimer } from '@/lib/document-a-imprimer';
import { dateSeule } from '@/lib/affichage';

/**
 * Le devis, la facture ou l'avoir, tels qu'ils s'impriment.
 *
 * **Cette page est le document.** Il n'y a pas une version à l'écran et une autre dans le PDF :
 * le PDF est l'impression de cette page. C'est ce qui garantit que les deux ne divergeront
 * jamais — et c'est pourquoi la mise en page est faite en millimètres plutôt qu'en `rem`, et
 * en noir sur blanc plutôt qu'avec les couleurs du site. Un document comptable se lit sur du
 * papier, parfois photocopié, parfois faxé ; le crème et l'or de la marque n'y survivent pas.
 *
 * La couleur du professionnel ne sert qu'à deux filets et au titre. Le reste est noir : une
 * facture imprimée en couleur d'accompagnement sur une imprimante laser devient illisible, et
 * personne ne s'en aperçoit avant le client.
 *
 * Les montants ne sont jamais recalculés ici. Ils arrivent déjà faits de `calculeTotaux`, par
 * `document-a-imprimer.ts` : une arithmétique dans un composant d'affichage est une seconde
 * arithmétique, donc un second résultat.
 */

function Adresse({ adresse }: { readonly adresse: AdressePostale }) {
  return (
    <>
      <span className="block">{adresse.voie}</span>
      {adresse.complement !== undefined && <span className="block">{adresse.complement}</span>}
      <span className="block">
        {adresse.codePostal} {adresse.commune}
      </span>
    </>
  );
}

/**
 * Une mention manquante.
 *
 * Elle ne s'affiche **qu'avant l'émission**, parce qu'elle n'est utile que tant qu'on peut y
 * remédier. Sur une facture émise, elle serait doublement nuisible : elle demanderait de
 * compléter ce qui ne se modifie plus, et elle s'imprimerait en rouge sur l'exemplaire du
 * client. Après l'émission, le manque est dit au professionnel dans la barre au-dessus du
 * document — qui, elle, ne s'imprime pas.
 */
function Lacune({ quoi, montrer }: { readonly quoi: string; readonly montrer: boolean }) {
  if (!montrer) return <span aria-hidden>—</span>;
  return (
    <span className="rounded-[2px] bg-[#fde8e8] px-1 text-[8pt] font-bold text-[#8c1c1c]">
      {quoi} à compléter
    </span>
  );
}

export function DocumentImprimable({ document }: { readonly document: DocumentAImprimer }) {
  const { emetteur, destinataire, totaux } = document;
  const chiffrees = document.lignes.filter((ligne) => ligne.type === 'prestation');
  // Avant l'émission, ce qui manque se signale ; après, le document est ce qu'il est.
  const aCompleter = document.emiseLe === null;
  const aUnAcompte = document.acompteDejaFactureTTC > 0;

  return (
    <article
      className="lr-document mx-auto bg-white text-[9.5pt] leading-[1.45] text-black"
      style={{ '--teinte': document.couleur } as React.CSSProperties}
    >
      {/* ── L'en-tête : qui facture, et quoi ────────────────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-[48%] min-w-[16rem]">
          <p
            className="font-[family-name:var(--font-titre)] text-[15pt] leading-tight"
            style={{ color: 'var(--teinte)' }}
          >
            {emetteur.nom}
          </p>
          <p className="mt-1 text-[8.5pt]">
            {emetteur.formeJuridique ?? <Lacune quoi="Forme juridique" montrer={aCompleter} />}
            {emetteur.capitalSocialEuros !== null &&
              ` · capital ${formatEuros(emetteur.capitalSocialEuros)}`}
          </p>
          <address className="mt-2 text-[8.5pt] not-italic">
            {emetteur.adresse === null ? (
              <Lacune quoi="Adresse" montrer={aCompleter} />
            ) : (
              <Adresse adresse={emetteur.adresse} />
            )}
          </address>
          <dl className="mt-2 text-[8pt]">
            <div className="flex gap-1">
              <dt className="font-semibold">SIRET</dt>
              <dd>{emetteur.siret ?? <Lacune quoi="SIRET" montrer={aCompleter} />}</dd>
            </div>
            {emetteur.immatriculation !== null && emetteur.immatriculation.lieu !== '' ? (
              <div className="flex gap-1">
                <dt className="font-semibold">
                  {emetteur.immatriculation.registre === 'rcs' ? 'RCS' : 'Répertoire des métiers'}
                </dt>
                <dd>{emetteur.immatriculation.lieu}</dd>
              </div>
            ) : (
              <Lacune quoi="Immatriculation" montrer={aCompleter} />
            )}
            {emetteur.franchiseTva ? (
              <div className="mt-1">{MENTION_FRANCHISE_TVA}</div>
            ) : (
              <div className="flex gap-1">
                <dt className="font-semibold">TVA</dt>
                <dd>{emetteur.numeroTva ?? <Lacune quoi="N° de TVA" montrer={aCompleter} />}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="text-right">
          <h1
            className="font-[family-name:var(--font-titre)] text-[19pt] leading-none"
            style={{ color: 'var(--teinte)' }}
          >
            {document.intitule}
          </h1>
          <p className="mt-1 text-[12pt] font-bold tracking-wide">
            {document.numero ?? <span className="text-[9pt] font-normal italic">non émise</span>}
          </p>
          <dl className="mt-3 ml-auto grid w-max grid-cols-[auto_auto] gap-x-3 text-[8.5pt]">
            <dt className="text-right font-semibold">Émise le</dt>
            <dd className="text-right">
              {document.emiseLe === null ? '—' : dateSeule(document.emiseLe)}
            </dd>
            {document.prestationLe !== null && (
              <>
                <dt className="text-right font-semibold">Prestation</dt>
                <dd className="text-right">{dateSeule(document.prestationLe)}</dd>
              </>
            )}
            <dt className="text-right font-semibold">Échéance</dt>
            <dd className="text-right">
              {document.echeanceLe === null ? '—' : dateSeule(document.echeanceLe)}
            </dd>
            {document.devisNumero !== null && (
              <>
                <dt className="text-right font-semibold">Devis</dt>
                <dd className="text-right">{document.devisNumero}</dd>
              </>
            )}
          </dl>
        </div>
      </header>

      {/* ── Le destinataire ─────────────────────────────────────────────────────────── */}
      <section className="mt-8 flex flex-wrap justify-between gap-6">
        <div className="min-w-[14rem]">
          <p className="text-[7.5pt] font-bold tracking-[0.14em] uppercase">Facturé à</p>
          <address className="mt-1 text-[9.5pt] not-italic">
            <span className="block font-semibold">
              {destinataire.nom === '' ? (
                <Lacune quoi="Client" montrer={aCompleter} />
              ) : (
                destinataire.nom
              )}
            </span>
            {destinataire.adresse === null ? (
              <Lacune quoi="Adresse du client" montrer={aCompleter} />
            ) : (
              <Adresse adresse={destinataire.adresse} />
            )}
            {destinataire.professionnel && (
              <span className="mt-1 block text-[8pt]">
                SIREN {destinataire.siren ?? <Lacune quoi="SIREN du client" montrer={aCompleter} />}
              </span>
            )}
          </address>
        </div>
        {document.adresseLivraison !== null && (
          <div className="min-w-[14rem]">
            <p className="text-[7.5pt] font-bold tracking-[0.14em] uppercase">Livré à</p>
            <address className="mt-1 text-[9.5pt] not-italic">
              <Adresse adresse={document.adresseLivraison} />
            </address>
          </div>
        )}
      </section>

      {/* ── Les lignes ──────────────────────────────────────────────────────────────── */}
      <table className="mt-7 w-full border-collapse text-[9pt]">
        <thead>
          <tr style={{ borderBottom: '1.5px solid var(--teinte)' }}>
            <th className="pb-1 text-left font-bold">Désignation</th>
            <th className="pb-1 text-right font-bold whitespace-nowrap">Qté</th>
            <th className="pb-1 text-right font-bold whitespace-nowrap">P.U. HT</th>
            <th className="pb-1 text-right font-bold whitespace-nowrap">TVA</th>
            <th className="pb-1 text-right font-bold whitespace-nowrap">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {document.lignes.map((ligne) => {
            if (ligne.type === 'section') {
              return (
                <tr key={ligne.id} className="break-inside-avoid">
                  <th colSpan={5} className="pt-4 pb-1 text-left text-[9.5pt] font-bold">
                    {ligne.designation}
                  </th>
                </tr>
              );
            }
            if (ligne.type === 'texte') {
              return (
                <tr key={ligne.id} className="break-inside-avoid">
                  <td colSpan={5} className="py-1.5 text-[8.5pt] italic">
                    {ligne.designation}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={ligne.id} className="break-inside-avoid align-top">
                <td className="border-t border-[#d8d8d8] py-1.5 pr-3">
                  {ligne.designation}
                  {ligne.detail !== undefined && (
                    <span className="mt-0.5 block text-[8pt] text-[#444]">{ligne.detail}</span>
                  )}
                </td>
                <td className="border-t border-[#d8d8d8] py-1.5 text-right whitespace-nowrap">
                  {ligne.quantite === undefined
                    ? '—'
                    : `${ligne.quantite.toLocaleString('fr-FR')} ${
                        ligne.unite === undefined ? '' : LIBELLES_UNITE[ligne.unite]
                      }`}
                </td>
                <td className="border-t border-[#d8d8d8] py-1.5 text-right whitespace-nowrap">
                  {ligne.prixUnitaireHT === undefined ? '—' : formatEuros(ligne.prixUnitaireHT)}
                </td>
                <td className="border-t border-[#d8d8d8] py-1.5 text-right whitespace-nowrap">
                  {ligne.tauxTva === undefined ? '—' : `${ligne.tauxTva.toLocaleString('fr-FR')} %`}
                </td>
                <td className="border-t border-[#d8d8d8] py-1.5 text-right font-semibold whitespace-nowrap">
                  {formatEuros(montantLigneHT(ligne))}
                </td>
              </tr>
            );
          })}
          {chiffrees.length === 0 && (
            <tr>
              <td colSpan={5} className="border-t border-[#d8d8d8] py-3 text-[8.5pt] italic">
                Aucune ligne chiffrée.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Les totaux ──────────────────────────────────────────────────────────────── */}
      <section className="mt-5 flex break-inside-avoid justify-end">
        <dl className="grid w-[22rem] grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[9pt]">
          {totaux.remiseHT > 0 && (
            <>
              <dt>Total brut HT</dt>
              <dd className="text-right tabular-nums">{formatEuros(totaux.totalBrutHT)}</dd>
              <dt className="text-[8.5pt]">Remise</dt>
              <dd className="text-right text-[8.5pt] tabular-nums">
                − {formatEuros(totaux.remiseHT)}
              </dd>
            </>
          )}
          <dt>Total HT</dt>
          <dd className="text-right tabular-nums">{formatEuros(totaux.totalHT)}</dd>

          {totaux.tva.map((taux) => (
            <div key={taux.taux} className="col-span-2 grid grid-cols-[1fr_auto] gap-x-6">
              <dt className="text-[8.5pt]">
                TVA {taux.taux.toLocaleString('fr-FR')} % sur {formatEuros(taux.baseHT)}
              </dt>
              <dd className="text-right text-[8.5pt] tabular-nums">{formatEuros(taux.montant)}</dd>
            </div>
          ))}

          <dt className="font-bold">Total TTC</dt>
          <dd className="text-right font-bold tabular-nums">{formatEuros(totaux.totalTTC)}</dd>

          {aUnAcompte && (
            <>
              <dt className="text-[8.5pt]">Acompte déjà facturé</dt>
              <dd className="text-right text-[8.5pt] tabular-nums">
                − {formatEuros(document.acompteDejaFactureTTC)}
              </dd>
            </>
          )}

          <div
            className="col-span-2 mt-1 grid grid-cols-[1fr_auto] gap-x-6 pt-2 text-[11pt]"
            style={{ borderTop: '1.5px solid var(--teinte)' }}
          >
            <dt className="font-bold">{document.acompte ? 'Acompte à régler' : 'Net à payer'}</dt>
            <dd className="text-right font-bold tabular-nums">
              {formatEuros(document.montantAPayerTTC)}
            </dd>
          </div>
        </dl>
      </section>

      {document.acompte && (
        <p className="mt-2 text-right text-[8pt]">
          Acompte sur le total ci-dessus. Le solde fera l’objet d’une facture à l’achèvement des
          travaux.
        </p>
      )}

      {/* ── Les mentions ────────────────────────────────────────────────────────────── */}
      <footer className="mt-8 break-inside-avoid border-t border-[#d8d8d8] pt-4 text-[7.8pt] leading-[1.5]">
        <p>
          <span className="font-semibold">Nature de l’opération</span> :{' '}
          {LIBELLE_CATEGORIE_OPERATION[document.categorieOperation]}.
        </p>
        {document.autoliquidation && <p className="mt-1">{MENTION_AUTOLIQUIDATION}</p>}
        <p className="mt-1">{phrasePenalites(document.tauxPenalites)}</p>
        {document.escompte !== null && (
          <p className="mt-1">
            <span className="font-semibold">Escompte</span> : {document.escompte}
          </p>
        )}

        {emetteur.batiment && (
          <p className="mt-1">
            <span className="font-semibold">Assurance professionnelle</span> :{' '}
            {emetteur.assurance === null ? (
              <Lacune quoi="Assurance" montrer={aCompleter} />
            ) : (
              <>
                {emetteur.assurance.assureur}
                {emetteur.assurance.contrat !== undefined &&
                  `, contrat ${emetteur.assurance.contrat}`}
                {' — couverture : '}
                {emetteur.assurance.couverture}
              </>
            )}
          </p>
        )}

        {!destinataire.professionnel && (
          <p className="mt-1">
            <span className="font-semibold">Médiation de la consommation</span> :{' '}
            {emetteur.mediateur === null ? (
              <Lacune quoi="Médiateur" montrer={aCompleter} />
            ) : (
              <>
                {emetteur.mediateur.nom} — {emetteur.mediateur.url}
              </>
            )}
          </p>
        )}

        {document.rib !== null && (
          <p className="mt-2">
            <span className="font-semibold">Règlement par virement</span> : {document.rib.titulaire}{' '}
            — {document.rib.iban}
            {document.rib.banque !== null && ` (${document.rib.banque})`}
          </p>
        )}

        {document.motif !== null && (
          <p className="mt-2">
            <span className="font-semibold">Motif</span> : {document.motif}
          </p>
        )}

        {document.conditionsGenerales !== null && (
          <p className="mt-3 whitespace-pre-line">{document.conditionsGenerales}</p>
        )}
        {document.piedDePage !== null && (
          <p className="mt-3 text-center whitespace-pre-line">{document.piedDePage}</p>
        )}
      </footer>
    </article>
  );
}
