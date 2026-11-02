// Objectifs proposés dans « Mon Cap » (ids = valeurs de user_goals.goal_type)
export const GOALS = [
  { id: "hsk_exam", icon: "🎓", label: "Réussir un examen HSK", hint: "Obtenir une certification officielle", levels: ["HSK1", "HSK2", "HSK3", "HSK4"] },
  { id: "job_china", icon: "💼", label: "Travailler avec la Chine", hint: "Emploi, stage, entreprises sino-ivoiriennes", levels: ["HSK2", "HSK3", "HSK4"] },
  { id: "studies_china", icon: "🏛️", label: "Étudier en Chine", hint: "Bourses et admissions universitaires", levels: ["HSK3", "HSK4", "HSK5"] },
  { id: "business", icon: "🤝", label: "Faire du commerce / import-export", hint: "Négocier et communiquer avec des fournisseurs", levels: ["HSK1", "HSK2", "HSK3"] },
  { id: "travel", icon: "✈️", label: "Voyager en Chine", hint: "Se débrouiller au quotidien", levels: ["HSK1", "HSK2"] },
  { id: "culture", icon: "🏮", label: "Passion pour la langue et la culture", hint: "Apprendre pour le plaisir", levels: ["HSK1", "HSK2", "HSK3"] },
  { id: "other", icon: "✨", label: "Autre objectif", hint: "Tu le décris toi-même", levels: ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"] },
];

export const goalById = (id) => GOALS.find((g) => g.id === id) || null;
