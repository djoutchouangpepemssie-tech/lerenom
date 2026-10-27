'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Bouton, cn } from '@lerenom/ui';
import type { SuggestionService, SuggestionVille } from '@/app/api/recherche/route';

/**
 * La recherche « service + ville » de l'accueil.
 *
 * Deux champs, deux listes de suggestions, et le statut de la ville annoncé honnêtement dès la
 * suggestion : le visiteur sait avant de cliquer s'il pourra demander un devis ou s'il consulte
 * l'annuaire. Les suggestions ne mènent jamais vers une entreprise qui a payé.
 *
 * La navigation au clavier est complète : flèches pour parcourir, Entrée pour choisir, Échap
 * pour fermer, et `aria-activedescendant` pour que le lecteur d'écran suive.
 */
export function BarreRecherche({ className }: { readonly className?: string }) {
  const [service, setService] = useState<SuggestionService | null>(null);
  const [ville, setVille] = useState<SuggestionVille | null>(null);

  function lance() {
    if (service !== null && ville !== null) {
      window.location.href = `/${service.metierSlug}/${ville.slug}`;
    } else if (service !== null) {
      window.location.href = `/${service.metierSlug}`;
    } else if (ville !== null) {
      window.location.href = `/${ville.slug}`;
    }
  }

  return (
    <div
      className={cn(
        'border-bordure bg-carte shadow-levee rounded-[var(--radius-panneau)] border p-2',
        'flex flex-col gap-2 md:flex-row md:items-center',
        className,
      )}
    >
      <ChampService valeur={service} onChoisir={setService} />
      <span aria-hidden="true" className="bg-bordure hidden h-8 w-px md:block" />
      <ChampVille valeur={ville} onChoisir={setVille} />
      <Bouton
        aspect="or"
        taille="grand"
        className="shrink-0 md:w-auto"
        pleineLargeur
        onClick={lance}
        disabled={service === null && ville === null}
        title={
          service === null && ville === null
            ? 'Choisissez d’abord un service ou une ville.'
            : undefined
        }
      >
        Trouver un professionnel
      </Bouton>
    </div>
  );
}

const STATUTS = {
  ouvert: { libelle: 'Devis ouverts', classes: 'bg-succes-fond text-succes' },
  bientot: { libelle: 'Ouvre bientôt', classes: 'bg-alerte-fond text-alerte' },
  annuaire: { libelle: 'Annuaire', classes: 'bg-encre/[0.06] text-encre-55' },
} as const;

function ChampService({
  valeur,
  onChoisir,
}: {
  readonly valeur: SuggestionService | null;
  readonly onChoisir: (suggestion: SuggestionService | null) => void;
}) {
  const champ = useAutocompletion<SuggestionService>('services', (donnees) => donnees.services);

  return (
    <Autocompletion
      etiquette="Quel service cherchez-vous ?"
      placeholder="Plombier, nettoyage de canapé, serrurier…"
      champ={champ}
      valeur={valeur}
      onChoisir={onChoisir}
      cleDe={(s) => `${s.type}-${s.slug}`}
      rendu={(suggestion) => (
        <>
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: suggestion.universCouleur }}
          />
          <span className="text-encre min-w-0 flex-1 truncate font-medium">{suggestion.nom}</span>
          <span className="text-encre-40 shrink-0 text-xs">{suggestion.universNom}</span>
        </>
      )}
      libelleDe={(s) => s.nom}
    />
  );
}

function ChampVille({
  valeur,
  onChoisir,
}: {
  readonly valeur: SuggestionVille | null;
  readonly onChoisir: (suggestion: SuggestionVille | null) => void;
}) {
  const champ = useAutocompletion<SuggestionVille>('villes', (donnees) => donnees.villes);

  return (
    <Autocompletion
      etiquette="Dans quelle ville ?"
      placeholder="Paris 11e, Montreuil, 93100…"
      champ={champ}
      valeur={valeur}
      onChoisir={onChoisir}
      cleDe={(v) => v.slug}
      rendu={(suggestion) => (
        <>
          <span className="text-encre min-w-0 flex-1 truncate font-medium">
            {suggestion.nom}
            {suggestion.codePostal !== null && (
              <span className="text-encre-40 ml-1.5 font-mono text-xs">
                {suggestion.codePostal}
              </span>
            )}
          </span>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold',
              STATUTS[suggestion.statut].classes,
            )}
          >
            {STATUTS[suggestion.statut].libelle}
          </span>
        </>
      )}
      libelleDe={(v) => v.nom}
    />
  );
}

interface EtatAutocompletion<T> {
  readonly suggestions: readonly T[];
  readonly chargement: boolean;
  readonly cherche: (texte: string) => void;
  readonly vide: () => void;
}

function useAutocompletion<T>(
  genre: 'services' | 'villes',
  extrait: (donnees: { services: SuggestionService[]; villes: SuggestionVille[] }) => T[],
): EtatAutocompletion<T> {
  const [suggestions, setSuggestions] = useState<readonly T[]>([]);
  const [chargement, setChargement] = useState(false);
  const dernier = useRef(0);

  function cherche(texte: string) {
    if (texte.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const appel = ++dernier.current;
    setChargement(true);

    fetch(`/api/recherche?genre=${genre}&q=${encodeURIComponent(texte)}`)
      .then((reponse) => reponse.json())
      .then((donnees: { services: SuggestionService[]; villes: SuggestionVille[] }) => {
        // Une réponse arrivée après une frappe plus récente est périmée : on la jette.
        if (appel !== dernier.current) return;
        setSuggestions(extrait(donnees));
      })
      .catch(() => {
        if (appel === dernier.current) setSuggestions([]);
      })
      .finally(() => {
        if (appel === dernier.current) setChargement(false);
      });
  }

  return { suggestions, chargement, cherche, vide: () => setSuggestions([]) };
}

function Autocompletion<T>({
  etiquette,
  placeholder,
  champ,
  valeur,
  onChoisir,
  rendu,
  cleDe,
  libelleDe,
}: {
  readonly etiquette: string;
  readonly placeholder: string;
  readonly champ: EtatAutocompletion<T>;
  readonly valeur: T | null;
  readonly onChoisir: (valeur: T | null) => void;
  readonly rendu: (suggestion: T) => React.ReactNode;
  readonly cleDe: (suggestion: T) => string;
  readonly libelleDe: (suggestion: T) => string;
}) {
  const identifiant = useId();
  const [texte, setTexte] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [survole, setSurvole] = useState(-1);
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const surClic = (evenement: MouseEvent) => {
      if (conteneur.current !== null && !conteneur.current.contains(evenement.target as Node)) {
        setOuvert(false);
      }
    };
    document.addEventListener('mousedown', surClic);
    return () => document.removeEventListener('mousedown', surClic);
  }, [ouvert]);

  function choisit(suggestion: T) {
    onChoisir(suggestion);
    setTexte(libelleDe(suggestion));
    setOuvert(false);
    setSurvole(-1);
  }

  const suggestions = champ.suggestions;

  return (
    <div ref={conteneur} className="relative min-w-0 flex-1">
      <label htmlFor={identifiant} className="sr-only">
        {etiquette}
      </label>
      <input
        id={identifiant}
        type="text"
        role="combobox"
        aria-expanded={ouvert && suggestions.length > 0}
        aria-controls={`${identifiant}-liste`}
        aria-autocomplete="list"
        aria-activedescendant={survole >= 0 ? `${identifiant}-option-${survole}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={texte}
        onChange={(evenement) => {
          setTexte(evenement.target.value);
          onChoisir(null);
          setOuvert(true);
          setSurvole(-1);
          champ.cherche(evenement.target.value);
        }}
        onFocus={() => setOuvert(true)}
        onKeyDown={(evenement) => {
          if (evenement.key === 'ArrowDown') {
            evenement.preventDefault();
            setOuvert(true);
            setSurvole((rang) => Math.min(rang + 1, suggestions.length - 1));
          } else if (evenement.key === 'ArrowUp') {
            evenement.preventDefault();
            setSurvole((rang) => Math.max(rang - 1, 0));
          } else if (evenement.key === 'Enter' && survole >= 0) {
            const choix = suggestions[survole];
            if (choix !== undefined) {
              evenement.preventDefault();
              choisit(choix);
            }
          } else if (evenement.key === 'Escape') {
            setOuvert(false);
          }
        }}
        className={cn(
          'min-h-13 w-full rounded-[var(--radius-douce)] bg-transparent px-4 text-[0.98rem]',
          'text-encre placeholder:text-encre-40 focus:outline-none',
          valeur !== null && 'font-semibold',
        )}
      />

      {ouvert && suggestions.length > 0 && (
        <ul
          id={`${identifiant}-liste`}
          role="listbox"
          aria-label={etiquette}
          className="border-bordure bg-carte shadow-levee absolute inset-x-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-[var(--radius-carte)] border py-1.5"
        >
          {suggestions.map((suggestion, rang) => (
            <li key={cleDe(suggestion)}>
              <button
                id={`${identifiant}-option-${rang}`}
                type="button"
                role="option"
                aria-selected={rang === survole}
                onMouseEnter={() => setSurvole(rang)}
                onClick={() => choisit(suggestion)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-sm transition-colors',
                  rang === survole ? 'bg-creme' : 'bg-transparent',
                )}
              >
                {rendu(suggestion)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
