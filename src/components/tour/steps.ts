export interface TourStep {
  id: string;
  selector: string;
  title: string;
  body: string;
  placement?: "right" | "bottom" | "left" | "top";
  padding?: number;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    selector: '[data-tour="brand"]',
    title: "Bienvenue 👋 — visite en 1 minute",
    body: "On va vous montrer 4 endroits à connaître : l'Accueil, Mes tontines, Payer, et la cloche de notifications. Cliquez sur « Étape suivante » pour commencer.",
    placement: "right",
    padding: 8,
  },
  {
    id: "home",
    selector: '[data-tour="nav-accueil"]',
    title: "Étape 1 — Commencez ici chaque jour",
    body: "👉 Le bouton « Accueil » (à gauche) ouvre votre tableau de bord. Vous y voyez en haut ce que vous devez payer aujourd'hui, puis vos tontines actives. Astuce : une carte rouge = à régler en priorité.",
    placement: "right",
  },
  {
    id: "tontines",
    selector: '[data-tour="nav-tontines"]',
    title: "Étape 2 — Vos tontines et leurs membres",
    body: "👉 Cliquez sur « Mes tontines » pour voir toutes vos tontines, leurs membres et leur cycle en cours. Depuis cette page, vous pouvez aussi en créer une nouvelle ou rejoindre une existante avec un code.",
    placement: "right",
  },
  {
    id: "payer",
    selector: '[data-tour="nav-payer"]',
    title: "Étape 3 — Payer une cotisation",
    body: "👉 « Payer » centralise toutes vos cotisations à régler. Choisissez Orange Money, MTN Mobile Money ou carte bancaire — le paiement prend moins d'une minute, et un reçu est généré automatiquement.",
    placement: "right",
  },
  {
    id: "bell",
    selector: '[data-tour="notifications"]',
    title: "Étape 4 — Gardez un œil sur la cloche",
    body: "🔔 Cette cloche s'allume dès qu'il se passe quelque chose : rappel de paiement, demande d'adhésion, annonce d'un organisateur. Cliquez dessus pour ne rien manquer. Vous pouvez relancer cette visite à tout moment via le « ? » en haut à droite.",
    placement: "bottom",
    padding: 6,
  },
];

export const TOUR_DONE_KEY = "tt_tour_done_v1";