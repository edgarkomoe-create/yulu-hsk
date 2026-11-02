import React, { useCallback, useEffect, useState } from "react";
import { BADGES, badgeById, nextBadge } from "../data/badges.js";
import { getCommunityGoal, getConfig, getMyContribution, getSupportersWall, subscribeSolidarity, submitDonation } from "../lib/cloud.js";

const fmt = (n) => Number(n || 0).toLocaleString("fr-FR") + " FCFA";

export default function Solidarite({ user, onLogin }) {
  const [cfg, setCfg] = useState(null);
  const [goal, setGoal] = useState(null);
  const [wall, setWall] = useState([]);
  const [mine, setMine] = useState(null);
  const [form, setForm] = useState({ ref: "", name: "", wave: "", whatsapp: "", amount: "", anonymous: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const reload = useCallback(async () => {
    const [g, w, m] = await Promise.all([getCommunityGoal(), getSupportersWall(), user ? getMyContribution(user.id) : null]);
    setGoal(g); setWall(w); setMine(m);
  }, [user]);

  useEffect(() => { getConfig().then(setCfg); }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => subscribeSolidarity(reload), [reload]);

  const min = form.anonymous ? cfg?.pricing_donations?.anonymous_min ?? 50 : cfg?.pricing_donations?.official_min ?? 200;
  const waveLink = cfg?.payment?.wave_link;
  const pct = goal ? Math.min(100, Math.round((goal.current_amount_fcfa / goal.target_amount_fcfa) * 100)) : 0;
  const myBadge = badgeById(mine?.current_badge);
  const nb = nextBadge(mine?.total_donated_fcfa || 0);

  const submit = async () => {
    setMsg("");
    const amount = Number(form.amount);
    if (!form.ref.trim() || (!form.anonymous && (!form.name.trim() || !form.wave.trim()))) {
      setMsg("⚠️ Remplis les champs obligatoires."); return;
    }
    if (!(amount >= min)) { setMsg(`⚠️ Le montant minimum est de ${fmt(min)}.`); return; }
    setBusy(true);
    const r = await submitDonation(user?.id, { ...form, amount });
    setBusy(false);
    if (r.ok) { setMsg("❤️ Merci ! Ton don est enregistré et sera vérifié avant d'apparaître sur le mur."); setForm({ ref: "", name: "", wave: "", whatsapp: "", amount: "", anonymous: false }); }
    else setMsg("⚠️ " + r.error);
  };

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-600 via-red-500 to-orange-500 text-white shadow">
        <div className="text-xs font-bold tracking-widest opacity-80 mb-1">🤝 SOLIDARITÉ</div>
        <h3 className="text-xl font-bold mb-1">Ensemble, on va plus loin</h3>
        <p className="text-sm opacity-90">Chaque don validé alimente l'objectif collectif du mois et soutient la VIE Foundation.</p>
      </div>

      {goal ? (
        <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="text-xs font-bold text-rose-600">🎯 OBJECTIF DU MOIS</div>
              <div className="font-bold text-gray-900">{goal.title}</div>
              {goal.description && <div className="text-xs text-gray-500">{goal.description}</div>}
            </div>
            {goal.status === "completed" && <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">✅ Atteint !</span>}
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-rose-500 to-orange-400 rounded-full transition-all" style={{ width: pct + "%" }} /></div>
          <div className="flex justify-between text-xs text-gray-600 mt-1.5">
            <span><b>{fmt(goal.current_amount_fcfa)}</b> sur {fmt(goal.target_amount_fcfa)} ({pct}%)</span>
            <span>{goal.contributor_count} contributeur{goal.contributor_count > 1 ? "s" : ""}</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Fin le {new Date(goal.ends_at).toLocaleDateString("fr-FR")}</div>
        </div>
      ) : (
        <div className="p-5 rounded-2xl border border-gray-200 bg-white text-sm text-gray-500">Aucun objectif collectif en cours pour le moment.</div>
      )}

      {user ? (
        <div className="p-5 rounded-2xl border border-yellow-300 bg-yellow-50">
          <h4 className="font-bold text-gray-900 mb-2">Mon impact</h4>
          {mine && mine.donation_count > 0 ? (
            <div className="text-sm text-gray-700 space-y-1">
              <div>{myBadge ? <span className="text-2xl mr-1">{myBadge.icon}</span> : null}<b>{myBadge ? "Badge " + myBadge.label : "Merci !"}</b></div>
              <div>Total validé : <b>{fmt(mine.total_donated_fcfa)}</b> en {mine.donation_count} don{mine.donation_count > 1 ? "s" : ""}</div>
              {nb && <div className="text-xs text-gray-500">Prochain badge « {nb.label} {nb.icon} » à {fmt(nb.min)} cumulés.</div>}
            </div>
          ) : <div className="text-sm text-gray-500">Aucun don validé pour l'instant. Ton premier don débloque le badge 🌱 Graine (dès {fmt(cfg?.pricing_donations?.official_min ?? 200)}).</div>}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {BADGES.map((b) => {
              const got = (mine?.badges_unlocked || []).includes(b.id);
              return <span key={b.id} title={`${b.label} — ${fmt(b.min)}`} className={`px-2 py-1 rounded-full text-xs border ${got ? "bg-white border-yellow-400 font-bold" : "bg-gray-100 border-gray-200 opacity-50"}`}>{b.icon} {b.label}</span>;
            })}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600 flex flex-wrap items-center gap-3">
          <span>Connecte-toi pour associer tes dons à ton compte et débloquer tes badges.</span>
          <button onClick={onLogin} className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700">Se connecter</button>
        </div>
      )}

      <div className="p-5 rounded-2xl border border-rose-200 bg-white shadow-sm">
        <h4 className="font-bold text-gray-900 mb-3">❤️ Faire un don</h4>
        <div className="text-sm text-gray-700 mb-2"><b>Étape 1.</b> Envoie ton don avec Wave.</div>
        {waveLink && <a href={waveLink} target="_blank" rel="noreferrer" className="inline-block mb-3 px-5 py-2.5 rounded-xl bg-cyan-500 text-white font-bold hover:bg-cyan-600">🌊 Faire mon don →</a>}
        <div className="text-sm text-gray-700 mb-2"><b>Étape 2.</b> Enregistre-le ici pour qu'il soit vérifié.</div>
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
          <input type="checkbox" checked={form.anonymous} onChange={setF("anonymous")} />
          Don anonyme (minimum {fmt(cfg?.pricing_donations?.anonymous_min ?? 50)} · sans badge nominatif)
        </label>
        <div className="grid md:grid-cols-2 gap-2">
          <input value={form.ref} onChange={setF("ref")} maxLength={60} placeholder="N° transaction Wave *" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
          <input value={form.amount} onChange={setF("amount")} inputMode="numeric" placeholder={`Montant FCFA * (min ${min})`} className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
          {!form.anonymous && <>
            <input value={form.name} onChange={setF("name")} maxLength={80} placeholder="Nom & prénoms *" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <input value={form.wave} onChange={setF("wave")} maxLength={30} placeholder="N° Wave *" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <input value={form.whatsapp} onChange={setF("whatsapp")} maxLength={30} placeholder="WhatsApp (facultatif)" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
          </>}
        </div>
        <button onClick={submit} disabled={busy} className="mt-3 w-full py-2.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 disabled:opacity-50">{busy ? "Envoi…" : "✅ J'ai donné — enregistrer"}</button>
        {msg && <div className="mt-2 text-sm text-gray-700">{msg}</div>}
        <p className="text-[11px] text-gray-400 mt-2">Ton n° Wave et ton WhatsApp ne sont jamais affichés publiquement. Seul ton prénom (ou « Anonyme ») apparaît sur le mur, après validation.</p>
      </div>

      <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <h4 className="font-bold text-gray-900 mb-2">🏆 Mur des soutiens</h4>
        {wall.length === 0 ? <div className="text-sm text-gray-500">Sois le premier à apparaître ici 🌱</div> : (
          <div className="divide-y divide-gray-100">
            {wall.map((w, i) => {
              const b = badgeById(w.badge_unlocked);
              return (
                <div key={i} className="py-2 flex items-center gap-2 text-sm">
                  <span className="text-lg">{b ? b.icon : "❤️"}</span>
                  <b className="text-gray-900">{w.display_name}</b>
                  <span className="text-gray-500">{fmt(w.amount_fcfa)}</span>
                  <span className="ml-auto text-xs text-gray-400">{new Date(w.created_at).toLocaleDateString("fr-FR")}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
