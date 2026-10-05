import { createClient } from "@supabase/supabase-js";

// ============================== SUPABASE CLIENT ==============================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase non configuré. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans Vercel.");
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

// ============================== AUTHENTIFICATION ==============================

export async function signInWithEmail(email) {
  if (!supabase) throw new Error("Supabase non configuré");
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  } catch (e) {
    return null;
  }
}

// ============================== SYNCHRONISATION PROGRESSION ==============================

export async function syncProgressToCloud(userId, progressData) {
  if (!supabase || !userId) return;
  try {
    const { error } = await supabase.from("progress").upsert({
      user_id: userId,
      data: progressData,
      updated_at: new Date().toISOString(),
    });
    if (error) console.warn("Erreur sync progress:", error.message);
  } catch (e) {
    console.warn("Erreur sync progress:", e);
  }
}

export async function loadProgressFromCloud(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from("progress")
      .select("data")
      .eq("user_id", userId)
      .single();
    if (error) return null;
    return data?.data || null;
  } catch (e) {
    return null;
  }
}

// ============================== PROFIL ==============================

export async function updateProfile(userId, updates) {
  if (!supabase || !userId) return;
  try {
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...updates });
    if (error) console.warn("Erreur profil:", error.message);
  } catch (e) {
    console.warn("Erreur profil:", e);
  }
}

export async function getProfile(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) return null;
    return data;
  } catch (e) {
    return null;
  }
}

// ============================== DONS ==============================

export async function saveDonationToCloud(donation) {
  if (!supabase) return { ok: false, error: "Supabase non configuré" };
  try {
    const { data, error } = await supabase.from("donations").insert(donation);
    if (error) {
      console.warn("Erreur don:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, data };
  } catch (e) {
    console.warn("Erreur don:", e);
    return { ok: false, error: e.message };
  }
}

export async function getMyDonations(userId) {
  if (!supabase || !userId) return [];
  try {
    const { data, error } = await supabase
      .from("donations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return data || [];
  } catch (e) {
    return [];
  }
}
