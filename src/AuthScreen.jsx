import React, { useState } from "react";
import { signInWithEmail } from "./supabase.js";

export default function AuthScreen({ onSkip, onBack, onSuccess }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Entre un email valide");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signInWithEmail(email.trim());
      setSent(true);
      // Prévient App.jsx que le magic link a été envoyé
      if (onSuccess) onSuccess({ pending: true, email: email.trim() });
    } catch (e) {
      setError("Erreur : " + (e.message || "réessaye plus tard"));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {!sent ? (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-3">
                  语
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  Sauvegarde ton parcours
                </h1>
                <p className="text-sm text-gray-500">
                  Connecte-toi pour retrouver ta progression sur tous tes appareils.
                </p>
              </div>

              <div className="space-y-3 mb-5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  placeholder="ton@email.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-red-500 outline-none text-base"
                  autoFocus
                />
                {error && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                    {error}
                  </div>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={loading || !email.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold shadow-lg hover:from-red-700 hover:to-orange-600 disabled:opacity-40 transition-all"
                >
                  {loading ? "Envoi en cours…" : "📧 Recevoir le lien magique"}
                </button>
              </div>

              <div className="text-center text-xs text-gray-400 mb-4">
                Pas de mot de passe. Tu recevras un lien par email pour te connecter.
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 mb-4">
                💡 <b>Astuce</b> : ouvre l'email sur <b>le même appareil</b> pour que la connexion fonctionne automatiquement.
              </div>

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
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-6xl mb-4">📬</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Vérifie ta boîte mail !
              </h2>
              <p className="text-sm text-gray-600 mb-5">
                Un lien magique a été envoyé à <b className="text-red-600">{email}</b>.
                <br />
                Clique dessus pour te connecter.
              </p>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 mb-4">
                ⚠️ Pense à vérifier tes <b>spams</b> si tu ne vois rien après 1 minute.
                <br />
                📱 Ouvre le lien sur <b>le même appareil</b>.
              </div>

              <button
                onClick={onSkip}
                className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 text-sm transition-colors mb-2"
              >
                Continuer sans compte en attendant
              </button>

              <button
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                ← Utiliser un autre email
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          🔒 Tes données sont stockées chez Supabase (Europe) et protégées par ton email.
        </p>
      </div>
    </div>
  );
}
