// Catalogue des Pass. Les PRIX font foi dans la table app_config (clé pricing_passes) ;
// ceux-ci ne servent que de valeurs de secours si la base est injoignable.
export const PASS_CATALOG = [
  { type: "boost_24h", icon: "⚡", label: "Boost 24h", duration: "24 heures", price: 500, aiPerDay: 50, perks: ["50 questions IA ce jour-là", "Idéal la veille d'un examen"] },
  { type: "week_7d", icon: "📅", label: "Semaine", duration: "7 jours", price: 1000, aiPerDay: 200, perks: ["200 questions IA par jour", "Tous les agents spécialisés"] },
  { type: "month_30d", icon: "🌙", label: "Mois", duration: "30 jours", price: 2500, aiPerDay: null, perks: ["Questions IA illimitées", "Tous les agents spécialisés"], popular: true },
  { type: "quarter_90d", icon: "🌿", label: "Trimestre", duration: "90 jours", price: 6000, aiPerDay: null, perks: ["Questions IA illimitées", "Économie par rapport au mois"] },
  { type: "year_365d", icon: "🌳", label: "Année", duration: "365 jours", price: 18000, aiPerDay: null, perks: ["Questions IA illimitées", "Le meilleur prix par mois"] },
  { type: "lifetime", icon: "💎", label: "À vie", duration: "Illimité", price: 35000, aiPerDay: null, perks: ["Accès permanent", "Soutien durable à VIE Foundation"] },
];

export const PASS_LABEL = Object.fromEntries(PASS_CATALOG.map((p) => [p.type, p.label]));

export const PASS_STATUS_LABEL = {
  pending: "⏳ En attente de vérification",
  active: "✅ Actif",
  expired: "⌛ Expiré",
  rejected: "❌ Refusé",
};
