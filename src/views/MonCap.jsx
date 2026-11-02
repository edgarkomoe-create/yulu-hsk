import React, { useEffect, useMemo, useState } from "react";
import LoginGate from "../components/LoginGate.jsx";
import { GOALS, goalById } from "../data/goals.js";
import { OPPORTUNITIES } from "../data/opportunities.js";
import { askAI, getMyGoal, saveMyGoal } from "../lib/cloud.js";

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export default function MonCap({ user, progress, lessonsCount, onLogin }) {
  const [loaded, setLoaded] = useState(false);
  const [goalType, setGoalType] = useState("hsk_exam");
  const [level, setLevel] = useState("HSK1");
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [cvInput, setCvInput] = useState("");
  const [cvBusy, setCvBusy] = useState(false);
  const [cvOut, setCvOut] = useState("");
  const [cvErr, setCvErr] = useState("");

  useEffect(() => {
    let alive = true;
    if (!user) { setLoaded(true); return; }
    (async () => {
      const g = await getMyGoal(user.id);
      if (!alive) return;
      if (g) {
        setGoalType(g.goal_type || "hsk_exam");
        setLevel(g.target_level || "HSK1");
        setDate(g.target_date ? String(g.target_date).slice(0, 10) : "");
        setText(g.goal_custom_text || g.motivation || "");
      }
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [user]);

  const goal = goalById(goalType);

  // Progression réelle : nombre de défis finaux (boss) réussis
  const lessonsDone = useMemo(() => {
    let n = 0;
    for (let l = 1; l <= lessonsCount; l++) if ((progress.nodes || {})["L" + l + "-boss"]?.done) n++;
    return n;
  }, [progress.nodes, lessonsCount]);
  const pct = lessonsCount ? Math.round((lessonsDone / lessonsCount) * 100) : 0;
  const left = daysUntil(date);

  if (!user) {
    return <LoginGate title="🎯 Mon Cap" text="Connecte-toi pour définir ton objectif, suivre ton avancement et recevoir des conseils personnalisés." onLogin={onLogin} />;
  }
  if (!loaded) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;

  const save = async () => {
    setSaving(true); setMsg("");
    const r = await saveMyGoal(user.id, {
      goal_type: goalType, target_level: level, target_date: date || null,
      goal_custom_text: text, motivation: null,
    });
    setSaving(false);
    setMsg(r.ok ? "✅ Objectif enregistré" : "⚠️ " + r.error);
  };

  const genCv = async () => {
    setCvErr(""); setCvOut("");
    if (cvInput.trim().length < 20) { setCvErr("Décris un peu plus ton parcours (formation, expériences, compétences)."); return; }
    setCvBusy(true);
    const r = await askAI({
      agent: "carriere",
      message: "Rédige mon CV en chinois simplifié avec pinyin et traduction française pour chaque rubrique, à partir de ces informations : " + cvInput.trim().slice(0, 700),
      context: { level, goal: goalType },
    });
    setCvBusy(false);
    if (r.ok) setCvOut(r.reply);
    else setCvErr(r.code === "quota" ? "Quota IA atteint pour aujourd'hui. Prends un Pass pour continuer." : r.message);
  };

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow">
        <div className="text-xs font-bold tracking-widest opacity-80 mb-1">🎯 MON CAP</div>
        <h3 className="text-xl font-bold mb-1">{goal ? goal.icon + " " + goal.label : "Mon objectif"}</h3>
        <p className="text-sm opacity-90">Cap sur <b>{level}</b>{left != null && (left >= 0 ? <> · <b>{left}</b> jour{left > 1 ? "s" : ""} restants</> : <> · date dépassée, fixe-toi une nouvelle échéance</>)}</p>
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1 opacity-90"><span>Leçons validées (défi final réussi)</span><span>{lessonsDone}/{lessonsCount}</span></div>
          <div className="h-2.5 bg-white/25 rounded-full overflow-hidden"><div className="h-full bg-amber-300 rounded-full transition-all" style={{ width: pct + "%" }} /></div>
        </div>
      </div>

      <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <h4 className="font-bold text-gray-900 mb-3">Choisis ton objectif</h4>
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {GOALS.map((g) => (
            <button key={g.id} onClick={() => { setGoalType(g.id); if (!g.levels.includes(level)) setLevel(g.levels[0]); }}
              className={`text-left p-3 rounded-xl border-2 transition-colors ${goalType === g.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
              <div className="font-bold text-sm text-gray-900">{g.icon} {g.label}</div>
              <div className="text-xs text-gray-500">{g.hint}</div>
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <label className="text-xs text-gray-600">Niveau visé
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
              {["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"].map((l) => <option key={l}>{l}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Échéance (facultatif)
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
          </label>
        </div>
        <label className="text-xs text-gray-600 block mb-3">Ta motivation en une phrase (facultatif)
          <input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Ex : je veux travailler avec des partenaires chinois dans le BTP" className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
        </label>
        <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer mon cap"}</button>
        {msg && <span className="ml-3 text-sm text-gray-600">{msg}</span>}
      </div>

      <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50">
        <h4 className="font-bold text-gray-900 mb-1">🧭 Pistes pour ton objectif</h4>
        <p className="text-xs text-gray-500 mb-3">Ce sont des pistes générales, pas des offres. Vérifie toujours les conditions auprès des sources officielles.</p>
        <div className="space-y-2">
          {(OPPORTUNITIES[goalType] || []).map((o) => (
            <div key={o.title} className="p-3 rounded-xl bg-white border border-emerald-200">
              <div className="font-semibold text-sm text-gray-900">{o.title}</div>
              <div className="text-xs text-gray-600 mt-0.5">{o.text}</div>
            </div>
          ))}
        </div>
      </div>

      {["job_china", "studies_china", "business"].includes(goalType) && (
        <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50">
          <h4 className="font-bold text-gray-900 mb-1">📝 CV en chinois (Coach carrière IA)</h4>
          <p className="text-xs text-gray-500 mb-2">Compte pour 1 question IA. Ne mets pas d'informations sensibles (numéros de pièce, mots de passe).</p>
          <textarea value={cvInput} maxLength={600} onChange={(e) => setCvInput(e.target.value)} rows={4}
            placeholder="Formation, expériences, compétences, langues… (600 caractères max)"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
          <div className="flex items-center gap-3 mt-2">
            <button onClick={genCv} disabled={cvBusy} className="px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 disabled:opacity-50">{cvBusy ? "Rédaction en cours…" : "Générer mon CV"}</button>
            <span className="text-xs text-gray-400">{cvInput.length}/600</span>
          </div>
          {cvErr && <div className="mt-2 text-sm text-red-600">{cvErr}</div>}
          {cvOut && (
            <div className="mt-3 p-3 rounded-xl bg-white border border-amber-200">
              <div className="text-sm whitespace-pre-wrap text-gray-800">{cvOut}</div>
              <button onClick={() => { try { navigator.clipboard.writeText(cvOut); } catch (e) {} }} className="mt-2 text-xs px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-100">📋 Copier</button>
              <p className="text-[11px] text-gray-400 mt-2">Relis et fais vérifier ce CV par un locuteur chinois avant de l'envoyer.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
