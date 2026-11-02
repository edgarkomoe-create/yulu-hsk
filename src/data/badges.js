// Badges de soutien — seuils alignés sur la fonction SQL refresh_contribution()
export const BADGES = [
  { id: "graine", icon: "🌱", label: "Graine", min: 200 },
  { id: "pousse", icon: "🌿", label: "Pousse", min: 500 },
  { id: "arbre", icon: "🌳", label: "Arbre", min: 1000 },
  { id: "foret", icon: "🌲", label: "Forêt", min: 2500 },
  { id: "montagne", icon: "⛰️", label: "Montagne", min: 5000 },
  { id: "etoile", icon: "⭐", label: "Étoile", min: 10000 },
  { id: "legende", icon: "👑", label: "Légende", min: 25000 },
];

export const badgeById = (id) => BADGES.find((b) => b.id === id) || null;

export function nextBadge(totalFcfa) {
  return BADGES.find((b) => totalFcfa < b.min) || null;
}
