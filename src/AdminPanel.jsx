import React, { useState, useEffect } from "react";
import Studio from "./Studio.jsx";

const ADMIN_PIN = "2026";
const CATALOG_KEY = "hsk1-catalog-v1";
const GEMINI_KEY_STORE = "hsk1-gemini-key";
const WAVE_LINK_STORE = "hsk1-wave-link";
const SETTINGS_KEY = "hsk1-settings-v1";
const STORE_KEY = "hsk1-campus-chinois-v1";

function getSettings() {
  try {
    return Object.assign({ aiFreePerDay: 5, billingOn: false }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
  } catch (e) {
    return { aiFreePerDay: 5, billingOn: false };
  }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
}

export default function AdminPanel({ progress, setDonor, setGoal, addXp, onExit }) {
  const [pinInput, setPinInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [section, setSection] = useState("stats");
  const [toast, setToast] = useState("");
  const [settings, setSettings] = useState(getSettings());
  const [catalog, setCatalog] = useState(() => {
    try { return Object.assign({ lessons: [], quiz: [], vocab: [] }, JSON.parse(localStorage.getItem(CATALOG_KEY) || "{}")); }
    catch (e) { return { lessons: [], quiz: [], vocab: [] }; }
  });

  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };
  const persistCatalog = (next) => {
    setCatalog(next);
    try { localStorage.setItem(CATALOG_KEY, JSON.stringify(next)); } catch (e) {}
  };

  // ============================== ÉCRAN DE VERROUILLAGE ==============================
  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-8 border-2 border-red-500">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white text-4xl shadow-lg mb-4">
                🔒
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Accès restreint</h1>
              <p className="text-sm text-gray-500">
                Espace réservé à l'administration de YǔLù 语路
              </p>
              <div className="mt-3 inline-block px-3 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                MODE ADMIN — NON PUBLIC
              </div>
            </div>

            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pinInput === ADMIN_PIN) setAuthed(true);
                  else { notify("Code incorrect"); setPinInput(""); }
                }
              }}
              placeholder="• • • •"
              className="w-full px-4 py-4 rounded-xl border-2 border-gray-300 text-center tracking-[0.5em] text-2xl font-bold outline-none focus:border-red-500"
              autoFocus
            />

            {toast && (
              <div className="mt-3 text-sm text-center text-red-600 font-bold bg-red-50 p-2 rounded-lg">
                {toast}
              </div>
            )}

            <button
              onClick={() => {
                if (pinInput === ADMIN_PIN) setAuthed(true);
                else { notify("Code incorrect"); setPinInput(""); }
              }}
              className="mt-4 w-full py-3.5 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition-colors"
            >
              Accéder au studio
            </button>

            <button
              onClick={onExit}
              className="mt-3 w-full py-2.5 rounded-xl bg-white border-2 border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
            >
              ← Retour à l'application
            </button>

            <p className="text-[10px] text-gray-400 text-center mt-4">
              Cette page n'est pas référencée. Garde cette URL confidentielle.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================== INTERFACE ADMIN ==============================
  const donations = progress.donations || [];
  const SECTIONS = [
    ["stats", "📊 Stats"],
    ["studio", "🎬 Studio IA"],
    ["facturation", "💳 Facturation"],
    ["dons", "🌊 Dons reçus"],
    ["config", "⚙️ Config"],
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Barre admin supérieure */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-black text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-xl">🔒</div>
          <div className="mr-auto">
            <div className="font-bold">Studio Admin — YǔLù 语路</div>
            <div className="text-xs opacity-70">Accès privé · Ne pas partager cette URL</div>
          </div>
          <div className="px-3 py-1 rounded-full bg-white/10 text-xs">MODE ADMIN</div>
          <button
            onClick={() => {
              if (window.confirm("Quitter le mode admin ?")) {
                onExit();
              }
            }}
            className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors"
          >
            ✕ Quitter
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Navigation admin */}
        <div className="mb-6 flex flex-wrap gap-2 bg-white p-3 rounded-2xl shadow-sm border border-gray-200">
          {SECTIONS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                section === id
                  ? "bg-gray-900 text-white shadow"
                  : "bg-white border border-gray-300 text-gray-600 hover:border-gray-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {toast && (
          <div className="mb-4 p-3 rounded-xl bg-gray-900 text-white text-sm font-bold text-center">
            {toast}
          </div>
        )}

        {/* ============ STATS ============ */}
        {section === "stats" && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-1">📊 Vue d'ensemble</h3>
              <p className="text-xs text-gray-500 mb-5">
                Métriques en direct de ton application YǔLù 语路
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["⚡ XP total", progress.xp, "XP", "bg-indigo-50 text-indigo-700"],
                  ["🔥 Série", computeStreak(progress.history), "jours", "bg-orange-50 text-orange-700"],
                  ["🪙 Pièces", progress.coins || 0, "en circulation", "bg-yellow-50 text-yellow-700"],
                  ["🤝 Cagnotte", progress.pot || 0, "solidaire", "bg-rose-50 text-rose-700"],
                ].map(([l, v, s, c]) => (
                  <div key={l} className={`p-4 rounded-xl border ${c.replace("text-", "border-").replace("bg-", "bg-")} ${c}`}>
                    <div className="text-2xl font-bold">{v}</div>
                    <div className="text-xs font-bold mt-1">{l}</div>
                    <div className="text-[10px] opacity-70">{s}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-3">📚 Contenu du catalogue</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-4 rounded-xl bg-blue-50">
                  <div className="text-2xl font-bold text-blue-700">{5 + catalog.lessons.length}</div>
                  <div className="text-xs text-blue-600">Leçons au total</div>
                </div>
                <div className="p-4 rounded-xl bg-purple-50">
                  <div className="text-2xl font-bold text-purple-700">{catalog.lessons.length}</div>
                  <div className="text-xs text-purple-600">Leçons ajoutées</div>
                </div>
                <div className="p-4 rounded-xl bg-green-50">
                  <div className="text-2xl font-bold text-green-700">{catalog.quiz.length}</div>
                  <div className="text-xs text-green-600">Questions ajoutées</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-3">🌊 Dons reçus</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-4 rounded-xl bg-gray-50">
                  <div className="text-2xl font-bold text-gray-700">{donations.length}</div>
                  <div className="text-xs text-gray-500">Total dons</div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50">
                  <div className="text-2xl font-bold text-amber-700">
                    {donations.filter((d) => d.statut === "en attente de vérification").length}
                  </div>
                  <div className="text-xs text-amber-600">En attente</div>
                </div>
                <div className="p-4 rounded-xl bg-green-50">
                  <div className="text-2xl font-bold text-green-700">
                    {donations.filter((d) => d.statut === "validé").reduce((s, d) => s + (d.montant || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-green-600">FCFA validés</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ STUDIO IA ============ */}
        {section === "studio" && (
          <Studio
            geminiKey={(() => {
              try { return localStorage.getItem(GEMINI_KEY_STORE) || ""; } catch (e) { return ""; }
            })()}
            existingLessons={[
              { id: 1, titre: "Leçon 1", zh: "你好" },
              { id: 2, titre: "Leçon 2", zh: "谢谢你" },
              { id: 3, titre: "Leçon 3", zh: "你叫什么名字？" },
              { id: 4, titre: "Leçon 4", zh: "她是我的汉语老师。" },
              { id: 5, titre: "Leçon 5", zh: "她女儿今年二十岁。" },
              ...catalog.lessons,
            ]}
            onPublish={(lessonData) => {
              const newCatalog = {
                ...catalog,
                lessons: [
                  ...catalog.lessons,
                  {
                    id: lessonData.lesson.id,
                    titre: lessonData.lesson.titre,
                    zh: lessonData.lesson.zh,
                    pinyin: lessonData.lesson.pinyin,
                    fr: lessonData.lesson.fr,
                    sections: lessonData.sections,
                    phrases: lessonData.phrases,
                    pinyinNotes: lessonData.pinyinNotes,
                    caracteres: lessonData.caracteres,
                  },
                ],
                quiz: [...catalog.quiz, ...lessonData.quiz],
              };
              persistCatalog(newCatalog);
              try {
                const dialoguesKey = "hsk1-dialogues-custom-v1";
                const existing = JSON.parse(localStorage.getItem(dialoguesKey) || "{}");
                if (lessonData.dialogues?.length) {
                  existing[lessonData.lesson.id] = lessonData.dialogues;
                  localStorage.setItem(dialoguesKey, JSON.stringify(existing));
                }
              } catch (e) {}
              notify(`✅ "${lessonData.lesson.titre}" publiée !`);
            }}
          />
        )}

        {/* ============ FACTURATION ============ */}
        {section === "facturation" && (
          <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm space-y-5">
            <h3 className="text-xl font-bold text-gray-900">💳 Facturation & Monétisation</h3>

            <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50">
              <b className="text-sm">Version actuelle : {settings.billingOn ? "Payante (premium actif)" : "Gratuite (test)"}</b>
              <p className="text-xs text-gray-600 mt-1 mb-3">
                En version gratuite, tout est ouvert. Active la facturation pour limiter le professeur IA et activer le premium par don.
              </p>
              <button
                onClick={() => {
                  const s = { ...settings, billingOn: !settings.billingOn };
                  setSettings(s);
                  saveSettings(s);
                }}
                className={`px-4 py-2 rounded-xl text-white text-sm font-bold ${
                  settings.billingOn ? "bg-gray-500 hover:bg-gray-600" : "bg-cyan-600 hover:bg-cyan-700"
                }`}
              >
                {settings.billingOn ? "↩️ Revenir en free" : "🚀 Activer la facturation"}
              </button>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-800">Questions IA gratuites / jour (sans don)</label>
              <div className="flex gap-2 mt-2">
                {[3, 5, 10, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      const s = { ...settings, aiFreePerDay: n };
                      setSettings(s);
                      saveSettings(s);
                    }}
                    className={`px-4 py-2 rounded-xl border text-sm font-bold ${
                      settings.aiFreePerDay === n ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-300"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-800">Lien de paiement Wave</label>
              <input
                value={localStorage.getItem(WAVE_LINK_STORE) || ""}
                onChange={(e) => {
                  try { localStorage.setItem(WAVE_LINK_STORE, e.target.value); } catch (er) {}
                }}
                className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                placeholder="https://pay.wave.com/m/..."
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Ce lien apparaît dans l'onglet Fondation de l'app.
              </p>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-800">Objectif XP / jour (test)</label>
              <div className="flex gap-2 mt-2">
                {[20, 40, 60, 100].map((n) => (
                  <button
                    key={n}
                    onClick={() => setGoal(n)}
                    className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-bold hover:border-gray-500"
                  >
                    {n} XP
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============ DONS ============ */}
        {section === "dons" && (
          <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-1">🌊 Dons reçus (Wave)</h3>
            <p className="text-xs text-gray-500 mb-5">
              Vérifie chaque référence dans ton compte Wave, puis valide ou rejette.
            </p>
            {donations.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Aucun don enregistré pour l'instant.</p>
            ) : (
              <div className="space-y-3">
                {donations.map((d, i) => (
                  <div key={i} className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-gray-900">{d.nom}</div>
                        <div className="text-2xl font-bold text-rose-600">{d.montant} FCFA</div>
                      </div>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-bold ${
                          d.statut === "validé"
                            ? "bg-green-100 text-green-700"
                            : d.statut === "rejeté"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {d.statut}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1 mb-3">
                      <div>Réf Wave : <b>{d.ref}</b></div>
                      <div>N° Wave : <b>{d.wave}</b></div>
                      {d.whatsapp && <div>WhatsApp : <b>{d.whatsapp}</b></div>}
                      <div>Date : {d.date}</div>
                    </div>
                    {d.statut === "en attente de vérification" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const next = [...donations];
                            next[i] = { ...d, statut: "validé" };
                            setDonor(true);
                            try {
                              const raw = JSON.parse(localStorage.getItem(STORE_KEY));
                              raw.donations = next;
                              localStorage.setItem(STORE_KEY, JSON.stringify(raw));
                              window.location.reload();
                            } catch (e) {}
                          }}
                          className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700"
                        >
                          ✓ Valider le don
                        </button>
                        <button
                          onClick={() => {
                            const next = [...donations];
                            next[i] = { ...d, statut: "rejeté" };
                            try {
                              const raw = JSON.parse(localStorage.getItem(STORE_KEY));
                              raw.donations = next;
                              raw.donor = false;
                              localStorage.setItem(STORE_KEY, JSON.stringify(raw));
                              window.location.reload();
                            } catch (e) {}
                          }}
                          className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600"
                        >
                          ✕ Rejeter
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ CONFIG ============ */}
        {section === "config" && (
          <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm space-y-5">
            <h3 className="text-xl font-bold text-gray-900">⚙️ Configuration générale</h3>

            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
              <h4 className="font-bold text-gray-800 text-sm mb-2">🔒 Sécurité admin</h4>
              <p className="text-xs text-gray-600 mb-2">
                URL admin actuelle : <code className="bg-white px-2 py-1 rounded text-red-600 font-mono">#studio-2026</code>
              </p>
              <p className="text-xs text-gray-500">
                Pour changer le PIN, modifie la constante <code className="bg-white px-1 rounded">ADMIN_PIN</code> dans le code source
                (<code className="bg-white px-1 rounded">src/AdminPanel.jsx</code>).
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
              <h4 className="font-bold text-gray-800 text-sm mb-2">💾 Données locales</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <div>• Catalogue : <b>{catalog.lessons.length} leçons personnalisées</b></div>
                <div>• Quiz : <b>{catalog.quiz.length} questions ajoutées</b></div>
                <div>• Dons : <b>{donations.length} enregistrés</b></div>
                <div>• Pièces en circulation : <b>{progress.coins || 0} 🪙</b></div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-red-200 bg-red-50">
              <h4 className="font-bold text-red-800 text-sm mb-2">⚠️ Zone dangereuse</h4>
              <button
                onClick={() => {
                  if (window.confirm("⚠️ ATTENTION : Cela va réinitialiser le catalogue personnalisé (leçons et quiz ajoutés). Les 5 leçons de base ne seront pas affectées. Continuer ?")) {
                    try {
                      localStorage.removeItem(CATALOG_KEY);
                      localStorage.removeItem("hsk1-dialogues-custom-v1");
                      window.location.reload();
                    } catch (e) {}
                  }
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700"
              >
                🗑️ Réinitialiser le catalogue personnalisé
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function computeStreak(history) {
  const keys = Object.keys(history).filter((k) => (history[k] || 0) > 0).sort().reverse();
  if (!keys.length) return 0;
  const fmt = (d) => d.toISOString().slice(0, 10);
  const today = fmt(new Date());
  const yesterday = fmt(new Date(Date.now() - 86400000));
  if (keys[0] !== today && keys[0] !== yesterday) return 0;
  const set = new Set(keys);
  let cursor = keys[0];
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    const c = new Date(cursor + "T00:00:00Z");
    c.setUTCDate(c.getUTCDate() - 1);
    cursor = c.toISOString().slice(0, 10);
  }
  return streak;
}
