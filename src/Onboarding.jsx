import React, { useState } from "react";

const AVATARS = ["🀄", "🐉", "🐼", "🎓", "🥷", "🦁", "👑", "🌸"];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🀄");
  const [goal, setGoal] = useState(40);
  const [level, setLevel] = useState("debutant");

  const next = () => {
    if (step === 0 && !name.trim()) return;
    if (step === 2) {
      // Sauvegarder le profil
      try {
        localStorage.setItem("hsk1-user-profile-v1", JSON.stringify({
          name: name.trim(),
          avatar,
          goal,
          level,
          onboardedAt: new Date().toISOString(),
        }));
      } catch (e) {}
      // Mettre à jour l'avatar dans le progress
      const raw = localStorage.getItem("hsk1-campus-chinois-v1");
      if (raw) {
        try {
          const p = JSON.parse(raw);
          p.avatar = avatar;
          p.goal = goal;
          p.name = name.trim();
          localStorage.setItem("hsk1-campus-chinois-v1", JSON.stringify(p));
        } catch (e) {}
      }
      onComplete();
      return;
    }
    setStep((s) => s + 1);
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? "w-8 bg-red-600" : i < step ? "w-2 bg-red-300" : "w-2 bg-gray-300"
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">

          {/* ============ SLIDE 1 : BIENVENUE ============ */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">👋</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Bienvenue sur YǔLù 语路 !</h1>
                <p className="text-gray-600 text-sm">Comment tu t'appelles ?</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Ton prénom</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) next(); }}
                  placeholder="Ex : Edgar, Awa, Yao..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-red-500 outline-none text-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Choisis ton avatar</label>
                <div className="grid grid-cols-4 gap-2">
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAvatar(a)}
                      className={`aspect-square rounded-xl border-2 text-3xl transition-all ${
                        avatar === a ? "bg-red-50 border-red-500 scale-105 shadow-md" : "bg-white border-gray-200 hover:border-red-300"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ SLIDE 2 : OBJECTIF ============ */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">🎯</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Ton objectif</h1>
                <p className="text-gray-600 text-sm">Combien de temps par jour ?</p>
              </div>

              <div className="space-y-3">
                {[
                  { value: 20, icon: "🌱", title: "Cool", desc: "5 minutes par jour · Je découvre" },
                  { value: 40, icon: "🔥", title: "Sérieux", desc: "10 minutes par jour · Recommandé", recommended: true },
                  { value: 60, icon: "🚀", title: "Intensif", desc: "15 minutes par jour · Je fonce" },
                ].map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setGoal(g.value)}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                      goal === g.value ? "bg-red-50 border-red-500 shadow-md" : "bg-white border-gray-200 hover:border-red-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{g.icon}</span>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          {g.title}
                          {g.recommended && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">Recommandé</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{g.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ============ SLIDE 3 : NIVEAU ============ */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">📚</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Ton niveau</h1>
                <p className="text-gray-600 text-sm">Pour adapter ton parcours</p>
              </div>

              <div className="space-y-3">
                {[
                  { value: "debutant", icon: "🌱", title: "Débutant total", desc: "Je n'ai jamais appris le chinois" },
                  { value: "bases", icon: "🌿", title: "J'ai quelques bases", desc: "Je connais déjà des mots simples" },
                ].map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setLevel(l.value)}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                      level === l.value ? "bg-red-50 border-red-500 shadow-md" : "bg-white border-gray-200 hover:border-red-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{l.icon}</span>
                      <div>
                        <div className="font-bold text-gray-900">{l.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{l.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ============ BOUTONS ============ */}
          <div className="flex gap-2 mt-8">
            {step > 0 && (
              <button
                onClick={back}
                className="px-5 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200"
              >
                ← Retour
              </button>
            )}
            <button
              onClick={next}
              disabled={step === 0 && !name.trim()}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold shadow-lg hover:from-red-700 hover:to-orange-600 disabled:opacity-40"
            >
              {step === 2 ? "🚀 C'est parti !" : "Continuer →"}
            </button>
          </div>

          {/* Skip */}
          {step === 0 && (
            <button
              onClick={() => {
                setName("Élève");
                setStep(1);
              }}
              className="block mx-auto mt-4 text-xs text-gray-400 hover:text-red-500"
            >
              Passer (je remplirai plus tard)
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          💡 Tu pourras modifier tout ça dans l'espace admin
        </p>
      </div>
    </div>
  );
}
