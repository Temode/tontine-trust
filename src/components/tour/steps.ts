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
    title: "Bienvenue sur Tontine Digital 👋",
    body: "En 1 minute, on vous montre où trouver l'essentiel : votre tableau de bord, vos tontines, et la page Payer.",
    placement: "right",
    padding: 8,
  },
  {
    id: "home",
    selector: '[data-tour="nav-accueil"]',
    title: "Accueil",
    body: "Votre tableau de bord : ce que vous devez payer, votre prochain tour, vos tontines actives.",
    placement: "right",
  },
  {
    id: "tontines",
    selector: '[data-tour="nav-tontines"]',
    title: "Mes tontines",
    body: "Toutes vos tontines, leurs membres et leurs cycles. Vous pouvez aussi en créer ou rejoindre une depuis ici.",
    placement: "right",
  },
  {
    id: "payer",
    selector: '[data-tour="nav-payer"]',
    title: "Payer",
    body: "Régler une cotisation en Orange Money, MTN Money ou par carte en quelques secondes.",
    placement: "right",
  },
  {
    id: "bell",
    selector: '[data-tour="notifications"]',
    title: "Notifications",
    body: "Annonces, demandes d'adhésion, rappels de paiement : tout arrive ici.",
    placement: "bottom",
    padding: 6,
  },
];

export const TOUR_DONE_KEY = "tt_tour_done_v1";