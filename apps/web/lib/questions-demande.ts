/**
 * Les trois questions posées à l'étape « Détails », adaptées à l'univers.
 *
 * Trois, pas dix : chaque question en plus est un visiteur en moins. Elles sont choisies pour
 * leur effet sur le devis — ce sont celles dont la réponse change le prix, et dont l'absence
 * provoque l'écart d'informations que le professionnel découvre sur place.
 */

export interface QuestionDemande {
  readonly cle: string;
  readonly libelle: string;
  readonly options: readonly string[];
}

const LOGEMENT: QuestionDemande = {
  cle: 'logement',
  libelle: 'Type de logement',
  options: ['Appartement', 'Maison', 'Local professionnel', 'Copropriété'],
};

const ACCES: QuestionDemande = {
  cle: 'acces',
  libelle: 'Accès',
  options: ['Rez-de-chaussée', 'Étage avec ascenseur', 'Étage sans ascenseur'],
};

const SURFACE: QuestionDemande = {
  cle: 'surface',
  libelle: 'Surface concernée',
  options: ['Moins de 20 m²', '20 à 50 m²', '50 à 100 m²', 'Plus de 100 m²'],
};

export const QUESTIONS_PAR_UNIVERS: Readonly<Record<string, readonly QuestionDemande[]>> = {
  'plomberie-et-chauffage': [
    LOGEMENT,
    {
      cle: 'etat',
      libelle: 'Situation',
      options: ['Fuite en cours', 'Panne', 'Installation neuve', 'Entretien'],
    },
    ACCES,
  ],
  'electricite-et-domotique': [
    LOGEMENT,
    {
      cle: 'etat',
      libelle: 'Situation',
      options: ['Panne totale', 'Panne partielle', 'Ajout d’équipement', 'Mise aux normes'],
    },
    {
      cle: 'anciennete',
      libelle: 'Âge de l’installation',
      options: ['Moins de 10 ans', '10 à 25 ans', 'Plus de 25 ans', 'Je ne sais pas'],
    },
  ],
  'serrurerie-et-securite': [
    LOGEMENT,
    {
      cle: 'situation',
      libelle: 'Situation',
      options: ['Porte claquée', 'Clé perdue', 'Après effraction', 'Installation prévue'],
    },
    {
      cle: 'porte',
      libelle: 'Type de porte',
      options: ['Simple', 'Blindée', 'Vitrée', 'Je ne sais pas'],
    },
  ],
  'renovation-et-second-oeuvre': [LOGEMENT, SURFACE, ACCES],
  'maconnerie-toiture-et-facade': [
    LOGEMENT,
    SURFACE,
    {
      cle: 'hauteur',
      libelle: 'Hauteur du bâtiment',
      options: ['Plain-pied', '1 étage', '2 à 4 étages', 'Plus de 4 étages'],
    },
  ],
  'energie-et-confort': [
    LOGEMENT,
    SURFACE,
    {
      cle: 'chauffage',
      libelle: 'Chauffage actuel',
      options: ['Gaz', 'Fioul', 'Électrique', 'Pompe à chaleur', 'Je ne sais pas'],
    },
  ],
  'menage-et-entretien-de-la-maison': [
    LOGEMENT,
    SURFACE,
    {
      cle: 'frequence',
      libelle: 'Fréquence souhaitée',
      options: ['Une seule fois', 'Hebdomadaire', 'Toutes les deux semaines', 'Mensuelle'],
    },
  ],
  'canapes-matelas-tapis-et-textiles': [
    {
      cle: 'matiere',
      libelle: 'Matière',
      options: ['Tissu', 'Cuir', 'Velours', 'Synthétique', 'Je ne sais pas'],
    },
    {
      cle: 'taille',
      libelle: 'Taille',
      options: ['1 à 2 places', '3 places', 'Angle ou plus', 'Plusieurs pièces'],
    },
    {
      cle: 'tache',
      libelle: 'Nature des taches',
      options: ['Usure générale', 'Taches alimentaires', 'Urine ou odeurs', 'Aucune, entretien'],
    },
  ],
  'nettoyage-professionnel': [
    {
      cle: 'locaux',
      libelle: 'Type de locaux',
      options: ['Bureaux', 'Commerce', 'Copropriété', 'Entrepôt'],
    },
    SURFACE,
    {
      cle: 'frequence',
      libelle: 'Fréquence souhaitée',
      options: ['Une seule fois', 'Quotidienne', 'Hebdomadaire', 'Mensuelle'],
    },
  ],
  'jardin-et-espaces-verts': [
    SURFACE,
    {
      cle: 'acces-jardin',
      libelle: 'Accès au terrain',
      options: ['Direct depuis la rue', 'Par la maison', 'Difficile'],
    },
    {
      cle: 'frequence',
      libelle: 'Fréquence souhaitée',
      options: ['Une seule fois', 'Mensuelle', 'Saisonnière', 'À l’année'],
    },
  ],
  'bricolage-et-petits-travaux': [
    LOGEMENT,
    {
      cle: 'duree',
      libelle: 'Durée estimée',
      options: ['Moins d’une heure', 'Une demi-journée', 'Une journée', 'Plusieurs jours'],
    },
    ACCES,
  ],
  'demenagement-et-transport': [
    {
      cle: 'volume',
      libelle: 'Volume estimé',
      options: ['Studio', 'T2 ou T3', 'T4 ou plus', 'Maison'],
    },
    {
      cle: 'acces-depart',
      libelle: 'Accès au départ',
      options: ['Rez-de-chaussée', 'Étage avec ascenseur', 'Étage sans ascenseur'],
    },
    {
      cle: 'acces-arrivee',
      libelle: 'Accès à l’arrivée',
      options: ['Rez-de-chaussée', 'Étage avec ascenseur', 'Étage sans ascenseur'],
    },
  ],
  'nuisibles-et-hygiene': [
    LOGEMENT,
    SURFACE,
    {
      cle: 'anciennete-infestation',
      libelle: 'Depuis quand ?',
      options: ['Quelques jours', 'Quelques semaines', 'Plusieurs mois', 'Je ne sais pas'],
    },
  ],
  'electromenager-et-multimedia': [
    {
      cle: 'appareil',
      libelle: 'Appareil concerné',
      options: [
        'Lave-linge',
        'Lave-vaisselle',
        'Réfrigérateur',
        'Four ou plaque',
        'Téléviseur',
        'Ordinateur',
        'Autre',
      ],
    },
    {
      cle: 'age',
      libelle: 'Âge de l’appareil',
      options: ['Moins de 2 ans', '2 à 5 ans', 'Plus de 5 ans', 'Je ne sais pas'],
    },
    { cle: 'garantie', libelle: 'Sous garantie ?', options: ['Oui', 'Non', 'Je ne sais pas'] },
  ],
  'auto-moto-et-velo': [
    {
      cle: 'vehicule',
      libelle: 'Type de véhicule',
      options: ['Citadine', 'Berline', 'SUV ou monospace', 'Utilitaire', 'Moto', 'Vélo'],
    },
    {
      cle: 'lieu',
      libelle: 'Lieu de l’intervention',
      options: [
        'Devant chez moi',
        'Parking privé',
        'Parking souterrain',
        'Sur mon lieu de travail',
      ],
    },
    { cle: 'etat-vehicule', libelle: 'État', options: ['Roulant', 'Immobilisé', 'Je ne sais pas'] },
  ],
  'services-a-la-personne': [
    {
      cle: 'beneficiaire',
      libelle: 'Pour qui ?',
      options: ['Un enfant', 'Un adulte', 'Une personne âgée', 'Un animal'],
    },
    {
      cle: 'frequence',
      libelle: 'Fréquence souhaitée',
      options: [
        'Une seule fois',
        'Quelques heures par semaine',
        'Tous les jours',
        'Pendant les vacances',
      ],
    },
    {
      cle: 'horaires',
      libelle: 'Horaires',
      options: ['En journée', 'Le soir', 'Le week-end', 'Variables'],
    },
  ],
  'beaute-et-bien-etre-a-domicile': [
    {
      cle: 'personnes',
      libelle: 'Combien de personnes ?',
      options: ['Une', 'Deux', 'Trois à cinq', 'Plus de cinq'],
    },
    {
      cle: 'occasion',
      libelle: 'À quelle occasion ?',
      options: ['Entretien régulier', 'Un événement', 'Un mariage', 'Sans occasion particulière'],
    },
    {
      cle: 'horaires',
      libelle: 'Horaires souhaités',
      options: ['En journée', 'En soirée', 'Le week-end', 'Peu importe'],
    },
  ],
  'evenements-et-receptions': [
    {
      cle: 'invites',
      libelle: 'Nombre d’invités',
      options: ['Moins de 20', '20 à 50', '50 à 150', 'Plus de 150'],
    },
    {
      cle: 'lieu-evenement',
      libelle: 'Lieu',
      options: ['À domicile', 'Salle louée', 'Extérieur', 'Pas encore choisi'],
    },
    {
      cle: 'date-evenement',
      libelle: 'Date',
      options: ['Dans le mois', 'Dans 1 à 3 mois', 'Dans 3 à 6 mois', 'Plus tard'],
    },
  ],
};
