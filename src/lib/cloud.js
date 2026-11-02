// ============================================================
// Couche d'accès aux données cloud (V1) — toutes les fonctions sont
// tolérantes : sans Supabase ou hors-ligne, elles renvoient une valeur vide
// plutôt que de planter l'application.
// ============================================================
import { supabase } from "../supabase.js";

const WAVE_FALLBACK = "https://pay.wave.com/m/M_ci_lPtTUkiLSpYn/c/ci/";

// ---------- Config globale (prix, liens) ----------
let _cfg = null;
export async function getConfig() {
  if (_cfg) return _cfg;
  const base = {
    pricing_passes: null,
    pricing_donations: { anonymous_min: 50, official_min: 200 },
    sandbox: { pass_percent: 80 },
    payment: { wave_link: WAVE_FALLBACK },
  };
  if (!supabase) return base;
  try {
    const { data, error } = await supabase.from("app_config").select("key,value");
    if (error || !data) return base;
    const out = { ...base };
    data.forEach((r) => { out[r.key] = r.value; });
    _cfg = out;
    return out;
  } catch (e) {
    return base;
  }
}

// ---------- Professeur IA (Edge Function) ----------
export async function askAI({ message, agent, history, context }) {
  if (!supabase) return { ok: false, code: "no_supabase", message: "Cloud non configuré." };
  try {
    const { data, error } = await supabase.functions.invoke("ask-ai", {
      body: { message, agent, history, context },
    });
    if (error) {
      let payload = null;
      try { payload = await error.context.json(); } catch (e) {}
      if (payload?.error === "quota_exceeded") return { ok: false, code: "quota", message: payload.message, quota: payload.quota };
      if (payload?.error) return { ok: false, code: payload.error, message: payload.message || "Erreur du service IA." };
      return { ok: false, code: "network", message: "Service IA injoignable." };
    }
    return { ok: true, reply: data.reply, agent: data.agent, quota: data.quota };
  } catch (e) {
    return { ok: false, code: "network", message: "Service IA injoignable." };
  }
}

// ---------- Mon Cap ----------
export async function getMyGoal(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data } = await supabase.from("user_goals").select("*").eq("user_id", userId).maybeSingle();
    return data || null;
  } catch (e) { return null; }
}

export async function saveMyGoal(userId, goal) {
  if (!supabase || !userId) return { ok: false, error: "Connexion requise" };
  const row = {
    user_id: userId,
    goal_type: goal.goal_type,
    goal_custom_text: goal.goal_custom_text ? String(goal.goal_custom_text).slice(0, 300) : null,
    target_level: goal.target_level,
    target_date: goal.target_date || null,
    motivation: goal.motivation ? String(goal.motivation).slice(0, 300) : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("user_goals").upsert(row, { onConflict: "user_id" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ---------- Pass ----------
export async function getMyPasses(userId) {
  if (!supabase || !userId) return [];
  try {
    const { data } = await supabase.from("passes").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    return data || [];
  } catch (e) { return []; }
}

export function activePassOf(passes) {
  const now = Date.now();
  return (passes || []).find((p) => p.status === "active" && (!p.expires_at || new Date(p.expires_at).getTime() > now)) || null;
}

export async function requestPass(userId, pass, transactionRef) {
  if (!supabase || !userId) return { ok: false, error: "Connexion requise" };
  const units = { boost_24h: ["hour", 24], week_7d: ["day", 7], month_30d: ["day", 30], quarter_90d: ["day", 90], year_365d: ["day", 365], lifetime: ["lifetime", 0] };
  const [unit, value] = units[pass.type] || ["day", 0];
  const { error } = await supabase.from("passes").insert({
    user_id: userId,
    pass_code: pass.type,
    pass_type: pass.type,
    price_fcfa: pass.price,
    duration_unit: unit,
    duration_value: value,
    transaction_ref: String(transactionRef).trim().slice(0, 60),
    status: "pending",
  });
  if (error) {
    if (String(error.message).includes("duplicate") || error.code === "23505") return { ok: false, error: "Ce numéro de transaction a déjà été enregistré." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ---------- Solidarité ----------
export async function getCommunityGoal() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.from("community_goals").select("*").order("ends_at", { ascending: false }).limit(1).maybeSingle();
    return data || null;
  } catch (e) { return null; }
}

export async function getSupportersWall() {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from("supporters_wall").select("*").limit(30);
    return data || [];
  } catch (e) { return []; }
}

export async function getMyContribution(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data } = await supabase.from("contributions").select("*").eq("user_id", userId).maybeSingle();
    return data || null;
  } catch (e) { return null; }
}

export async function submitDonation(userId, d) {
  if (!supabase) return { ok: false, error: "Cloud non configuré" };
  const { error } = await supabase.from("donations").insert({
    user_id: userId || null,
    is_anonymous: !!d.anonymous,
    transaction_ref: String(d.ref).trim().slice(0, 60),
    full_name: String(d.name || "Anonyme").trim().slice(0, 80),
    wave_number: String(d.wave || "-").trim().slice(0, 30),
    whatsapp: d.whatsapp ? String(d.whatsapp).trim().slice(0, 30) : null,
    amount_fcfa: Math.round(Number(d.amount)),
    status: "pending",
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ce numéro de transaction a déjà été enregistré." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// Rafraîchissement en direct (objectif communautaire + mur). Renvoie une fonction de désabonnement.
export function subscribeSolidarity(onChange) {
  if (!supabase) return () => {};
  const ch = supabase
    .channel("solidarity-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "community_goals" }, onChange)
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (e) {} };
}

// ---------- Certification ----------
export async function recordSandboxAttempt(level, score, max, seconds) {
  if (!supabase) return { ok: false, error: "Cloud non configuré" };
  const { data, error } = await supabase.rpc("record_sandbox_attempt", {
    p_level: level, p_score: score, p_max: max, p_seconds: Math.round(seconds || 0),
  });
  return error ? { ok: false, error: error.message } : { ok: true, result: data };
}

export async function getMyCertification(userId, level) {
  if (!supabase || !userId) return null;
  try {
    const { data } = await supabase.from("certifications").select("*").eq("user_id", userId).eq("level", level).maybeSingle();
    return data || null;
  } catch (e) { return null; }
}

export async function requestCertificationFunding(level) {
  if (!supabase) return { ok: false, error: "Cloud non configuré" };
  const { error } = await supabase.rpc("request_certification_funding", { p_level: level });
  return error ? { ok: false, error: error.message } : { ok: true };
}
