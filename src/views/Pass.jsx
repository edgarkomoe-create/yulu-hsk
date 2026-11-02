import React, { useEffect, useState } from "react";
import LoginGate from "../components/LoginGate.jsx";
import { PASS_CATALOG, PASS_LABEL, PASS_STATUS_LABEL } from "../data/passes.js";
import { activePassOf, getConfig, getMyPasses, requestPass } from "../lib/cloud.js";

const fmt = (n) => Number(n).toLocaleString("fr-FR") + " FCFA";
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

export default function Pass({ user, onLogin }) {
  const [cfg, setCfg] = useState(null);
  const [passes, setPasses] = useState([]);
  const [choice, setChoice] = useState(null);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const reload = async () => { if (user) setPasses(await getMyPasses(user.id)); };
  useEffect(() => { getConfig().then(setCfg); }, []);
  useEffect(() => { reload(); }, [user]);

  if (!user) return <LoginGate title="🎫 Pass" text="Connecte-toi pour acheter un Pass et débloquer plus de questions au Professeur IA." onLogin={onLogin} />;

  // Les prix de la base font foi
  const prices = cfg?.pricing_passes || {};
  const catalog = PASS_CATALOG.map((p) => ({ ...p, price: prices[p.type] ?? p.price }));
  const waveLink = cfg?.payment?.wave_link;
  const active = activePassOf(passes);

  const submit = async () => {
    setMsg("");
    if (!choice) return;
    if (ref.trim().length < 4) { setMsg("⚠️ Entre le numéro de transaction Wave (reçu par SMS)."); return; }
    setBusy(true);
    const r = await requestPass(user.id, choice, ref);
    setBusy(false);
    if (r.ok) { setMsg("✅ Demande enregistrée. Ton Pass sera activé après vérification du paiement."); setChoice(null); setRef(""); reload(); }
    else setMsg("⚠️ " + r.error);
  };

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow">
        <div className="text-xs font-bold tracking-widest opacity-80 mb-1">🎫 PASS YǓLÙ</div>
        <h3 className="text-xl font-bold mb-1">Plus de questions, plus de progrès</h3>
        <p className="text-sm opacity-90">Gratuit : quelques questions IA par jour. Avec un Pass, tu en débloques davantage. Une part de chaque achat soutient la VIE Foundation ❤️</p>
        {active && <div className="mt-3 inline-block px-3 py-1.5 rounded-full bg-white/20 text-sm font-bold">✅ Pass actif : {PASS_LABEL[active.pass_type]} · {active.expires_at ? "jusqu'au " + fmtDate(active.expires_at) : "à vie"}</div>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {catalog.map((p) => (
          <button key={p.type} onClick={() => { setChoice(p); setMsg(""); }}
            className={`text-left p-4 rounded-2xl border-2 bg-white transition-all hover:shadow ${choice?.type === p.type ? "border-orange-500 shadow" : "border-gray-200"}`}>
            {p.popular && <div className="text-[10px] font-bold text-orange-600 mb-1">⭐ POPULAIRE</div>}
            <div className="text-2xl">{p.icon}</div>
            <div className="font-bold text-gray-900">{p.label}</div>
            <div className="text-xs text-gray-500 mb-2">{p.duration}</div>
            <div className="text-lg font-bold text-orange-600 mb-2">{fmt(p.price)}</div>
            <ul className="text-xs text-gray-600 space-y-0.5">{p.perks.map((k) => <li key={k}>• {k}</li>)}</ul>
          </button>
        ))}
      </div>

      {choice && (
        <div className="p-5 rounded-2xl border-2 border-cyan-300 bg-cyan-50 space-y-3">
          <div className="font-bold text-gray-900">Pass « {choice.label} » — {fmt(choice.price)}</div>
          <div className="text-sm text-gray-700"><b>Étape 1.</b> Paie exactement <b>{fmt(choice.price)}</b> avec Wave.</div>
          {waveLink && <a href={waveLink} target="_blank" rel="noreferrer" className="inline-block px-5 py-2.5 rounded-xl bg-cyan-500 text-white font-bold hover:bg-cyan-600">🌊 Payer avec Wave →</a>}
          <div className="text-sm text-gray-700"><b>Étape 2.</b> Recopie le numéro de transaction reçu par SMS.</div>
          <div className="flex gap-2">
            <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={60} placeholder="N° de transaction Wave" className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <button onClick={submit} disabled={busy} className="px-5 py-2 rounded-xl bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 disabled:opacity-50">{busy ? "…" : "J'ai payé"}</button>
          </div>
          <p className="text-[11px] text-gray-500">L'activation est manuelle : l'équipe vérifie le paiement puis active ton Pass.</p>
        </div>
      )}
      {msg && <div className="p-3 rounded-xl bg-white border border-gray-200 text-sm">{msg}</div>}

      {passes.length > 0 && (
        <div className="p-5 rounded-2xl border border-gray-200 bg-white">
          <h4 className="font-bold text-gray-900 mb-2">Mes demandes</h4>
          <div className="divide-y divide-gray-100">
            {passes.map((p) => {
              const expired = p.status === "active" && p.expires_at && new Date(p.expires_at) < new Date();
              return (
                <div key={p.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                  <b>{PASS_LABEL[p.pass_type] || p.pass_type}</b>
                  <span className="text-gray-500">· réf. {p.transaction_ref}</span>
                  <span className="ml-auto text-xs">{PASS_STATUS_LABEL[expired ? "expired" : p.status] || p.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
