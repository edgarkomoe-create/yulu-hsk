import React from "react";

// Affiché quand une fonctionnalité cloud demande d'être connecté.
export default function LoginGate({ title, text, onLogin }) {
  return (
    <div className="p-8 rounded-2xl border border-gray-200 bg-white shadow-sm text-center">
      <div className="text-4xl mb-2">☁️</div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">{text}</p>
      <button onClick={onLogin} className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow">
        Se connecter
      </button>
    </div>
  );
}
