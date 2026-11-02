import React, { useEffect, useMemo, useRef, useState } from "react";
import LoginGate from "../components/LoginGate.jsx";
import { getConfig, getMyCertification, recordSandboxAttempt, requestCertificationFunding } from "../lib/cloud.js";

const LEVEL = "HSK1";            // seul niveau disposant d'une banque de questions pour l'instant
const EXAM_SIZE = 30;
const EXAM_MINUTES = 30;
const MIN_BANK = 10;

const STATUS = {
  in_progress: { icon: "📚", label: "En préparation", help: "Réussis l'examen blanc pour devenir éligible." },
  eligible: { icon: "✅", label: "Éligible", help: "Tu peux demander le financement de ta certification officielle." },
  funding_requested: { icon: "⏳", label: "Financement demandé", help: "Ta demande est en cours d'examen par l'équipe." },
  funded: { icon: "🎁", label: "Financement accordé", help: "L'équipe te contactera pour l'inscription à l'examen officiel." },
  registered: { icon: "🗓️", label: "Inscrit à l'examen officiel", help: "Prépare-toi bien !" },
  completed: { icon: "🏅", label: "Certification obtenue", help: "Félicitations !" },
};

const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const mmss = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");

export default function Certification({ user, quiz, onLogin }) {
  const bank = useMemo(() => (quiz || []).filter((q) => Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer)), [quiz]);
  const [cfg, setCfg] = useState(null);
  const [cert, setCert] = useState(null);
  const [mode, setMode] = useState("intro"); // intro | exam | result
  const [qs, setQs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [left, setLeft] = useState(EXAM_MINUTES * 60);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const startedAt = useRef(0);
  const finishing = useRef(false);

  const reloadCert = async () => { if (user) setCert(await getMyCertification(user.id, LEVEL)); };
  useEffect(() => { getConfig().then(setCfg); }, []);
  useEffect(() => { reloadCert(); }, [user]);

  // Chronomètre
  useEffect(() => {
    if (mode !== "exam") return;
    const t = setInterval(() => setLeft((l) => (l > 0 ? l - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [mode]);
  useEffect(() => { if (mode === "exam" && left === 0) finish(); /* eslint-disable-next-line */ }, [left, mode]);

  if (!user) return <LoginGate title="🎓 Certification" text="Connecte-toi pour passer l'examen blanc et demander le financement de ta certification officielle." onLogin={onLogin} />;

  const requiredPct = cfg?.sandbox?.pass_percent ?? 80;
  const enough = bank.length >= MIN_BANK;

  const start = () => {
    const picked = shuffle(bank).slice(0, Math.min(EXAM_SIZE, bank.length));
    setQs(picked); setIdx(0); setAnswers({}); setLeft(EXAM_MINUTES * 60); setResult(null); setMsg("");
    finishing.current = false; startedAt.current = Date.now(); setMode("exam");
  };

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    setBusy(true);
    const score = qs.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    const r = await recordSandboxAttempt(LEVEL, score, qs.length, seconds);
    setBusy(false);
    setResult({ score, total: qs.length, server: r.ok ? r.result : null, error: r.ok ? null : r.error });
    setMode("result");
    reloadCert();
  }

  const askFunding = async () => {
    setBusy(true); setMsg("");
    const r = await requestCertificationFunding(LEVEL);
    setBusy(false);
    setMsg(r.ok ? "✅ Demande envoyée à l'équipe." : "⚠️ " + r.error);
    reloadCert();
  };

  const st = STATUS[cert?.eligibility_status] || STATUS.in_progress;

  // ---------------- EXAMEN ----------------
  if (mode === "exam") {
    const q = qs[idx];
    const answered = Object.keys(answers).length;
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-900 text-white text-sm">
          <span>Question <b>{idx + 1}</b>/{qs.length} · {answered} répondue{answered > 1 ? "s" : ""}</span>
          <span className={left < 120 ? "text-red-300 font-bold" : ""}>⏱️ {mmss(left)}</span>
        </div>
        <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="text-xs text-gray-400 mb-1">{q.type}</div>
          <div className="font-bold text-gray-900 mb-4">{q.question}</div>
          <div className="space-y-2">
            {q.options.map((o, i) => (
              <button key={i} onClick={() => setAnswers({ ...answers, [idx]: i })}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-colors ${answers[idx] === i ? "border-indigo-500 bg-indigo-50 font-semibold" : "border-gray-200 hover:border-gray-300"}`}>{o}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm disabled:opacity-40">← Précédent</button>
          {idx < qs.length - 1
            ? <button onClick={() => setIdx(idx + 1)} className="ml-auto px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm">Suivant →</button>
            : <button onClick={() => { if (answered === qs.length || window.confirm(`Il reste ${qs.length - answered} question(s) sans réponse. Terminer quand même ?`)) finish(); }} disabled={busy} className="ml-auto px-5 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm disabled:opacity-50">{busy ? "Envoi…" : "Terminer l'examen ✓"}</button>}
        </div>
      </div>
    );
  }

  // ---------------- RÉSULTAT ----------------
  if (mode === "result" && result) {
    const pct = Math.round((result.score / result.total) * 100);
    const ok = result.server ? result.server.passed : pct >= requiredPct;
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        <div className={`p-6 rounded-2xl text-center border-2 ${ok ? "border-green-400 bg-green-50" : "border-orange-300 bg-orange-50"}`}>
          <div className="text-5xl font-bold text-gray-900">{result.score}/{result.total}</div>
          <div className="text-lg font-semibold mt-1">{pct}% · {ok ? "Réussi 🎉" : "Pas encore 💪"}</div>
          <div className="text-xs text-gray-500 mt-1">Seuil : {requiredPct}%</div>
          {result.error && <div className="mt-2 text-xs text-red-600">⚠️ Résultat non enregistré : {result.error}</div>}
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 bg-white">
          <h4 className="font-bold text-gray-900 mb-2">Correction</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {qs.map((q, i) => {
              const good = answers[i] === q.answer;
              return (
                <div key={i} className={`p-3 rounded-xl text-sm border ${good ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <div className="font-semibold text-gray-900">{i + 1}. {q.question}</div>
                  {!good && <div className="text-red-700 text-xs mt-1">Ta réponse : {answers[i] != null ? q.options[answers[i]] : "— (sans réponse)"}</div>}
                  <div className="text-green-700 text-xs">Bonne réponse : {q.options[q.answer]}</div>
                  {q.explication && <div className="text-gray-500 text-xs mt-0.5">💡 {q.explication}</div>}
                </div>
              );
            })}
          </div>
        </div>
        <button onClick={() => setMode("intro")} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">Retour à ma certification</button>
      </div>
    );
  }

  // ---------------- ACCUEIL ----------------
  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-800 to-indigo-800 text-white shadow">
        <div className="text-xs font-bold tracking-widest opacity-80 mb-1">🎓 CERTIFICATION {LEVEL}</div>
        <h3 className="text-xl font-bold mb-1">De l'entraînement à l'examen officiel</h3>
        <p className="text-sm opacity-90">Réussis l'examen blanc ({requiredPct}% minimum) pour devenir éligible au financement communautaire de ta certification officielle.</p>
      </div>

      <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-3xl">{st.icon}</div>
          <div>
            <div className="font-bold text-gray-900">{st.label}</div>
            <div className="text-xs text-gray-500">{st.help}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="p-2 rounded-xl bg-gray-50"><div className="text-lg font-bold text-indigo-600">{cert?.sandbox_attempts ?? 0}</div><div className="text-[10px] text-gray-500">tentatives</div></div>
          <div className="p-2 rounded-xl bg-gray-50"><div className="text-lg font-bold text-indigo-600">{cert?.sandbox_best_score != null ? cert.sandbox_best_score + "%" : "—"}</div><div className="text-[10px] text-gray-500">meilleur score</div></div>
          <div className="p-2 rounded-xl bg-gray-50"><div className="text-lg font-bold text-indigo-600">{requiredPct}%</div><div className="text-[10px] text-gray-500">seuil</div></div>
        </div>
        {enough ? (
          <button onClick={start} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow">▶️ Lancer l'examen blanc ({Math.min(EXAM_SIZE, bank.length)} questions · {EXAM_MINUTES} min)</button>
        ) : <div className="text-sm text-gray-500">La banque de questions est trop petite pour un examen blanc.</div>}
        {cert?.eligibility_status === "eligible" && (
          <button onClick={askFunding} disabled={busy} className="w-full mt-2 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-50">🎁 Demander le financement de ma certification</button>
        )}
        {msg && <div className="mt-2 text-sm text-gray-700">{msg}</div>}
      </div>

      <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-xs text-gray-600 space-y-1">
        <div><b>À savoir :</b> l'examen blanc est un entraînement, il ne remplace pas l'examen HSK officiel.</div>
        <div>Le financement dépend des fonds collectés dans l'onglet Solidarité et de la décision de l'équipe : il n'est pas automatique.</div>
        <div>Dates, tarifs et inscription : renseigne-toi auprès d'un centre d'examen agréé (par exemple un Institut Confucius).</div>
      </div>
    </div>
  );
}
