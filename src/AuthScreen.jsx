import React, { useState } from "react";
import {
  signInWithEmail,
  signUpWithPassword,
  signInWithPassword,
  resetPassword,
} from "./supabase.js";

export default function AuthScreen({ onSkip, onBack, onSuccess }) {
  // mode : "login" | "signup" | "magic-sent" | "reset"
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const reset = () => {
    setError("");
    setInfo("");
  };

  // ============================== ACTIONS ==============================

  const handleLogin = async () => {
    reset();
    if (!email.trim() || !email.includes("@")) return setError("Entre un email valide");
    if (!password) return setError("Entre ton mot de passe");
    setLoading(true);
    try {
      await signInWithPassword(email.trim(), password);
      if (onSuccess) onSuccess({ method: "password" });
    } catch (e) {
      const msg = e.message || "";
      if (msg.toLowerCase().includes("invalid")) {
        setError("Email ou mot de passe incorrect");
      } else if (msg.toLowerCase().includes("email not confirmed")) {
        setError("Confirme ton email avant de te connecter (regarde ta boîte mail).");
      } else {
        setError("Erreur : " + msg);
      }
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    reset();
    if (!email.trim() || !email.includes("@")) return setError("Entre un email valide");
    if (password.length < 6) return setError("Le mot de passe doit faire au moins 6 caractères");
    if (password !== password2) return setError("Les mots de passe ne correspondent pas");
    setLoading(true);
    try {
      await signUpWithPassword(email.trim(), password);
      setMode("magic-sent");
      setInfo("Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse.");
      if (onSuccess) onSuccess({ method: "signup" });
    } catch (e) {
      const msg = e.message || "";
      if (msg.toLowerCase().includes("already")) {
        setError("Cet email est déjà utilisé. Essaie de te connecter.");
      } else {
        setError("Erreur : " + msg);
      }
    }
    setLoading(false);
  };

  const handleMagicLink = async () => {
    reset();
    if (!email.trim() || !email.includes("@")) return setError("Entre un email valide");
    setLoading(true);
    try {
      await signInWithEmail(email.trim());
      setMode("magic-sent");
      setInfo("Lien magique envoyé ! Ouvre ton email pour te connecter.");
      if (onSuccess) onSuccess({ method: "magiclink" });
    } catch (e) {
      setError("Erreur : " + (e.message || "réessaye plus tard"));
    }
    setLoading(false);
  };

  const handleReset = async () => {
    reset();
    if (!email.trim() || !email.includes("@")) return setError("Entre un email valide");
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setInfo("Email de réinitialisation envoyé ! Vérifie ta boîte mail.");
    } catch (e) {
      setError("Erreur : " + (e.message || "réessaye plus tard"));
    }
    setLoading(false);
  };

  // ============================== ÉCRAN "EMAIL ENVOYÉ" ==============================
  if (mode === "magic-sent") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="text-6xl mb-4">📬</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Vérifie ta boîte mail !
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              Un message a été envoyé à <b className="text-red-600">{email}</b>.
            </p>
            {info && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 mb-4 text-left">
                {info}
              </div>
            )}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 mb-4 text-left">
              ⚠️ Vérifie tes <b>spams</b> si rien après 1 min.
              <br />
              📱 Ouvre le lien sur <b>le même appareil</b> que ta demande.
            </div>

            <button
              onClick={onSkip}
              className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 text-sm transition-colors mb-2"
            >
              Continuer sans compte en attendant
            </button>

            <button
              onClick={() => { setMode("login"); reset(); }}
              className="text-xs text-gray-400 hover:text-red-500"
            >
              ← Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================== ÉCRAN "RESET" ==============================
  if (mode === "reset") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-3">
                🔑
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Mot de passe oublié</h1>
              <p className="text-sm text-gray-500">
                Entre ton email, on t'enverra un lien pour le réinitialiser.
              </p>
            </div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-red-500 outline-none text-base mb-3"
              autoFocus
            />

            {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg mb-3">{error}</div>}
            {info && <div className="text-xs text-green-700 bg-green-50 p-2 rounded-lg mb-3">{info}</div>}

            <button
              onClick={handleReset}
              disabled={loading || !email.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold shadow-lg hover:from-red-700 hover:to-orange-600 disabled:opacity-40 transition-all"
            >
              {loading ? "Envoi…" : "📧 Envoyer le lien"}
            </button>

            <button
              onClick={() => { setMode("login"); reset(); }}
              className="w-full mt-3 py-2 text-gray-400 text-xs hover:text-red-500"
            >
              ← Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================== ÉCRAN PRINCIPAL ==============================
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-3">
              语
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {mode === "signup" ? "Créer un compte" : "Sauvegarde ton parcours"}
            </h1>
            <p className="text-sm text-gray-500">
              {mode === "signup"
                ? "Un compte pour retrouver ta progression partout."
                : "Connecte-toi pour retrouver ta progression sur tous tes appareils."}
            </p>
          </div>

          {/* Onglets Connexion / Inscription */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl mb-5">
            <button
              onClick={() => { setMode("login"); reset(); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === "login" ? "bg-white text-red-600 shadow" : "text-gray-500"
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => { setMode("signup"); reset(); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === "signup" ? "bg-white text-red-600 shadow" : "text-gray-500"
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Formulaire */}
          <div className="space-y-3 mb-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-red-500 outline-none text-base"
              autoFocus
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (mode === "login") handleLogin();
                  else handleSignup();
                }
              }}
              placeholder="Mot de passe"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-red-500 outline-none text-base"
            />

            {mode === "signup" && (
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSignup(); }}
                placeholder="Confirme le mot de passe"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-red-500 outline-none text-base"
              />
            )}

            {error && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>
            )}
            {info && (
              <div className="text-xs text-green-700 bg-green-50 p-2 rounded-lg">{info}</div>
            )}

            <button
              onClick={mode === "login" ? handleLogin : handleSignup}
              disabled={loading || !email.trim() || !password}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold shadow-lg hover:from-red-700 hover:to-orange-600 disabled:opacity-40 transition-all"
            >
              {loading
                ? "Patientez…"
                : mode === "login"
                ? "🔑 Se connecter"
                : "✨ Créer mon compte"}
            </button>
          </div>

          {/* Lien mot de passe oublié */}
          {mode === "login" && (
            <button
              onClick={() => { setMode("reset"); reset(); }}
              className="w-full text-xs text-gray-400 hover:text-red-500 mb-4"
            >
              Mot de passe oublié ?
            </button>
          )}

          {/* Séparateur */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">ou</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Magic link */}
          <button
            onClick={handleMagicLink}
            disabled={loading || !email.trim()}
            className="w-full py-3 rounded-xl bg-white border-2 border-gray-200 text-gray-700 font-bold hover:border-red-400 hover:text-red-600 disabled:opacity-40 transition-all mb-3"
          >
            📧 Recevoir un lien magique (sans mot de passe)
          </button>

          {/* Astuce */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 mb-4">
            💡 <b>Astuce</b> : le lien magique arrive par email. Ouvre-le sur <b>le même appareil</b>.
          </div>

          {/* Skip */}
          <button
            onClick={onSkip}
            className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 text-sm transition-colors"
          >
            Continuer sans compte (local seulement)
          </button>

          {onBack && (
            <button
              onClick={onBack}
              className="w-full mt-2 py-2 text-gray-400 text-xs hover:text-red-500"
            >
              ← Retour
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          🔒 Tes données sont stockées chez Supabase et protégées par ton email.
        </p>
      </div>
    </div>
  );
}
