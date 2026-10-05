import React, { useState, useEffect, useRef } from "react";

// ============================== ANIMATIONS CSS ==============================
const GLOBAL_STYLES = `
  @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
  @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.5); } 50% { box-shadow: 0 0 0 20px rgba(220,38,38,0); } }
  @keyframes inkDrop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
  @keyframes slideInLeft { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes slideInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes bounceSoft { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }

  .anim-fadeUp { animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) both; }
  .anim-fadeIn { animation: fadeIn 1s ease both; }
  .anim-float { animation: float 4s ease-in-out infinite; }
  .anim-pulse-glow { animation: pulseGlow 2s ease-out infinite; }
  .anim-slide-left { animation: slideInLeft 0.7s cubic-bezier(0.22,1,0.36,1) both; }
  .anim-slide-right { animation: slideInRight 0.7s cubic-bezier(0.22,1,0.36,1) both; }
  .anim-bounce-soft { animation: bounceSoft 2.5s ease-in-out infinite; }
  .anim-ink-drop { animation: inkDrop 1s ease-out; }

  .text-gradient-red { background: linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #f59e0b 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
  .bg-paper { background-color: #fefaf5; background-image: radial-gradient(circle at 20% 50%, rgba(220,38,38,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(234,88,12,0.04) 0%, transparent 50%); }

  .card-hover { transition: all 0.35s cubic-bezier(0.22,1,0.36,1); }
  .card-hover:hover { transform: translateY(-6px); box-shadow: 0 20px 40px -12px rgba(220,38,38,0.25); }

  .btn-primary {
    background: linear-gradient(135deg, #dc2626, #ea580c);
    transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
    position: relative; overflow: hidden;
  }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 15px 30px -8px rgba(220,38,38,0.5); }
  .btn-primary::after {
    content: ""; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    transition: left 0.6s;
  }
  .btn-primary:hover::after { left: 100%; }

  .brush-stroke { position: relative; display: inline-block; }
  .brush-stroke::before {
    content: ""; position: absolute; bottom: 4px; left: 0; right: 0; height: 12px;
    background: linear-gradient(90deg, rgba(220,38,38,0.25), rgba(234,88,12,0.25));
    border-radius: 6px; z-index: -1;
  }

  .delay-1 { animation-delay: 0.1s; }
  .delay-2 { animation-delay: 0.2s; }
  .delay-3 { animation-delay: 0.3s; }
  .delay-4 { animation-delay: 0.4s; }
  .delay-5 { animation-delay: 0.5s; }
  .delay-6 { animation-delay: 0.6s; }
  .delay-7 { animation-delay: 0.7s; }
  .delay-8 { animation-delay: 0.8s; }
`;

// ============================== HOOK REVEAL ON SCROLL ==============================
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, delay = 0, className = "" }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: `all 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// ============================== CONTENU ==============================
const STEPS = [
  {
    icon: "🌱",
    title: "Écoute, répète, comprends",
    desc: "Tu découvres tes premiers mots avec la voix native, tu répètes à voix haute, et tu vois immédiatement si tu prononces bien.",
    points: ["Vocabulaire illustré", "Audio lent + normal", "Correction instantanée"],
  },
  {
    icon: "🎮",
    title: "Joue pour ancrer",
    desc: "Memory, phrases à reconstituer, défis chrono — chaque jeu renforce ta mémoire sans que tu t'en rendes compte.",
    points: ["Memory des caractères", "Quiz express 60s", "Gagne des pièces Sagesse"],
  },
  {
    icon: "🏆",
    title: "Parle avec confiance",
    desc: "Tu enchaînes les leçons, tu débloques les défis finaux, et un jour tu te surprends à penser en chinois.",
    points: ["Parcours débloqué étape par étape", "Badges & niveaux", "Professeur IA personnel"],
  },
];

const TESTIMONIALS = [
  {
    quote: "Je pensais que le chinois était impossible. En 3 semaines avec YǔLù, je peux saluer, me présenter et commander un café. Le prof IA m'aide à 23h quand j'ai une question !",
    name: "Awa K.",
    role: "Étudiante en commerce · Abidjan",
    avatar: "🌸",
  },
  {
    quote: "La prononciation corrigée a tout changé pour moi. J'avais peur de mal parler devant les Chinois du marché de Treichville — maintenant je lance des 你好 avec confiance !",
    name: "Yao D.",
    role: "Commerçant · Yopougon",
    avatar: "🦁",
  },
  {
    quote: "5 minutes dans le taxi, 5 minutes le soir. En 2 mois, j'ai fini HSK 1. Mes collègues chinois sont impressionnés. Et chaque pièce gagnée va à la cagnotte solidaire.",
    name: "Fatou T.",
    role: "Cadre bancaire · Plateau",
    avatar: "🎓",
  },
];

const IMPACT_CARDS = [
  { icon: "🍎", title: "Santé & Nutrition", desc: "L'urgence de vivre." },
  { icon: "📚", title: "Éducation & Inclusion", desc: "Le pouvoir de savoir." },
  { icon: "🌱", title: "Solutions Durables", desc: "Innover pour préserver." },
  { icon: "🎭", title: "Identité & Culture", desc: "S'ancrer pour s'élever." },
];

const DEMO_FEATURES = [
  { icon: "🎙️", title: "Reconnaissance vocale", desc: "Prononce et reçois ta note sur 100" },
  { icon: "🧑‍🏫", title: "Professeur IA 24/7", desc: "Pose toutes tes questions, il répond en français" },
  { icon: "🎵", title: "Défi des tons", desc: "Distingue mā, má, mǎ, mà comme un natif" },
];

// ============================== COMPOSANT PRINCIPAL ==============================
export default function Landing({ onStart, progress }) {
  const [scrollY, setScrollY] = useState(0);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [demoStep, setDemoStep] = useState(0);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_STYLES;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCurrentTestimonial((c) => (c + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setDemoStep((s) => (s + 1) % 3), 3000);
    return () => clearInterval(t);
  }, []);

  const heroOpacity = Math.max(0, 1 - scrollY / 500);
  const heroTranslate = scrollY * 0.3;

  return (
    <div className="bg-paper min-h-screen">
      {/* ============ NAV FLOTTANTE ============ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 px-4 py-3 transition-all"
        style={{
          background: scrollY > 50 ? "rgba(254,250,245,0.92)" : "transparent",
          backdropFilter: scrollY > 50 ? "blur(12px)" : "none",
          boxShadow: scrollY > 50 ? "0 4px 20px -8px rgba(0,0,0,0.08)" : "none",
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              语
            </div>
            <div>
              <div className="font-bold text-gray-900 leading-none">YǔLù 语路</div>
              <div className="text-[10px] text-gray-500">Campus chinois HSK</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#parcours" className="hover:text-red-600 transition-colors">Parcours</a>
            <a href="#temoignages" className="hover:text-red-600 transition-colors">Témoignages</a>
            <a href="#impact" className="hover:text-red-600 transition-colors">Impact</a>
          </div>
          <button onClick={onStart} className="btn-primary px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-md">
            {progress?.xp > 0 ? "Continuer →" : "Commencer gratuitement →"}
          </button>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute top-20 -left-20 w-72 h-72 rounded-full bg-red-100 opacity-40 blur-3xl anim-float" />
        <div className="absolute top-40 -right-20 w-96 h-96 rounded-full bg-orange-100 opacity-40 blur-3xl anim-float" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-yellow-100 opacity-30 blur-3xl anim-float" style={{ animationDelay: "2s" }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div style={{ opacity: heroOpacity, transform: `translateY(${heroTranslate}px)` }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-xs font-bold text-red-700 mb-5 anim-fadeUp">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                🇨🇮 Fait en Côte d'Ivoire · Gratuit pour tous
              </div>

              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-[1.1] mb-5 anim-fadeUp delay-1">
                Ton premier mot<br />en chinois ouvre<br />
                <span className="text-gradient-red brush-stroke">un nouveau monde.</span>
              </h1>

              <p className="text-lg text-gray-600 mb-7 leading-relaxed anim-fadeUp delay-2 max-w-lg">
                <b className="text-gray-900">YǔLù 语路</b> n'est pas qu'une app. C'est ta route vers l'Asie —
                5 minutes par jour, un professeur IA qui ne dort jamais, et une communauté qui apprend avec toi.
                <span className="block mt-2 text-sm text-gray-500 italic">
                  你好 nǐ hǎo — ça commence maintenant.
                </span>
              </p>

              <div className="flex flex-wrap gap-3 mb-8 anim-fadeUp delay-3">
                <button onClick={onStart} className="btn-primary px-7 py-4 rounded-2xl text-white font-bold text-base shadow-lg anim-pulse-glow">
                  🎯 Démarrer la Leçon 1 — gratuit
                </button>
                <a href="#parcours" className="px-7 py-4 rounded-2xl bg-white border-2 border-gray-200 text-gray-700 font-bold text-base hover:border-red-300 transition-all">
                  Voir le parcours ↓
                </a>
              </div>

              <div className="flex items-center gap-5 anim-fadeUp delay-4">
                <div className="flex -space-x-2">
                  {["🦁", "🐼", "🎓", "🥷", "🐉"].map((e, i) => (
                    <div key={i} className="w-9 h-9 rounded-full bg-gradient-to-br from-red-100 to-orange-100 border-2 border-white flex items-center justify-center text-lg shadow">
                      {e}
                    </div>
                  ))}
                </div>
                <div className="text-sm">
                  <div className="font-bold text-gray-900">+2 400 apprenants</div>
                  <div className="text-gray-500 text-xs">rejoignent chaque mois · 4.9 ⭐</div>
                </div>
              </div>
            </div>

            <div className="relative anim-slide-right delay-2">
              <div className="relative bg-white rounded-3xl shadow-2xl p-6 border border-gray-100 anim-float">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">LEÇON 1 · EN COURS</span>
                  <span className="text-xs text-gray-400">1/5</span>
                </div>
                <div className="text-center py-4">
                  <div className="text-7xl font-bold text-gray-900 mb-3 anim-ink-drop">你好</div>
                  <div className="text-xl text-red-600 font-semibold">Nǐ hǎo</div>
                  <div className="text-sm text-gray-500 italic">Bonjour !</div>
                </div>
                <div className="flex justify-center gap-2 mt-4">
                  <button className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition">🔊 Écouter</button>
                  <button className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition">🐢 Lent</button>
                </div>
                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i <= 1 ? "bg-green-500" : "bg-gray-200"}`} />
                    ))}
                  </div>
                  <div className="text-xs font-bold text-gray-700">+5 XP ⚡</div>
                </div>
              </div>

              <div className="absolute -top-4 -left-4 bg-white rounded-2xl shadow-xl px-4 py-3 anim-float" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <div className="text-xs font-bold text-gray-900">12 jours</div>
                    <div className="text-[10px] text-gray-500">de série</div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -right-4 bg-white rounded-2xl shadow-xl px-4 py-3 anim-float" style={{ animationDelay: "1s" }}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <div className="text-xs font-bold text-gray-900">Niveau 3</div>
                    <div className="text-[10px] text-gray-500">280 XP</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-16 anim-fadeIn delay-5">
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <span className="text-xs">Découvre ton parcours</span>
              <div className="w-6 h-10 rounded-full border-2 border-gray-300 flex justify-center pt-2">
                <div className="w-1 h-2 rounded-full bg-red-500 anim-bounce-soft" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS BAND ============ */}
      <section className="py-14 px-4 bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { n: "5 min", l: "par jour suffisent" },
            { n: "150+", l: "mots HSK 1" },
            { n: "24/7", l: "professeur IA" },
            { n: "100%", l: "gratuit pour apprendre" },
          ].map((s, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div>
                <div className="text-3xl md:text-4xl font-bold mb-1">{s.n}</div>
                <div className="text-sm opacity-90">{s.l}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ 3 ACTES ============ */}
      <section id="parcours" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-sm font-bold text-red-600 uppercase tracking-widest">Ton histoire commence ici</span>
              <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mt-3 mb-4">
                3 étapes pour transformer<br />
                <span className="text-gradient-red">« bonjour » en conversation</span>
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Comme Awa, comme Yao, comme des milliers d'Ivoiriens — tu vas découvrir que le chinois
                n'est pas si difficile quand on apprend avec le bon rythme et la bonne méthode.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <Reveal key={i} delay={i * 0.15}>
                <div className="card-hover bg-white rounded-3xl p-7 border border-gray-100 shadow-lg relative overflow-hidden h-full">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-50 to-transparent rounded-full -mr-10 -mt-10" />
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4">
                      {step.icon}
                    </div>
                    <div className="text-xs font-bold text-red-600 mb-2">ÉTAPE {i + 1}</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">{step.desc}</p>
                    <ul className="space-y-2">
                      {step.points.map((p, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DÉMO INTERACTIVE ============ */}
      <section className="py-20 px-4 bg-gradient-to-b from-white to-red-50/30">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <Reveal>
            <div>
              <span className="text-sm font-bold text-red-600 uppercase tracking-widest">Vois par toi-même</span>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-3 mb-5">
                L'app qui <span className="text-gradient-red">t'écoute</span>,<br />
                te corrige et t'encourage.
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Pas de cours ennuyeux. Tu apprends en jouant, en parlant, en écoutant — comme un enfant
                apprendrait sa langue maternelle. Et notre IA te corrige instantanément.
              </p>
              <div className="space-y-3">
                {DEMO_FEATURES.map((f, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      demoStep === i ? "bg-white shadow-md border-l-4 border-red-500" : "bg-transparent opacity-60"
                    }`}
                  >
                    <span className="text-2xl">{f.icon}</span>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{f.title}</div>
                      <div className="text-xs text-gray-500">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="relative">
              <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-100">
                <div className="text-xs font-bold text-gray-400 mb-3">🎙️ PRONONCIATION EN DIRECT</div>
                <div className="text-center py-8">
                  <div className="text-6xl font-bold text-gray-900 mb-4">谢谢</div>
                  <div className="text-lg text-red-600 font-semibold mb-1">xièxie</div>
                  <div className="text-sm text-gray-500 italic mb-5">merci</div>
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-3xl shadow-lg anim-pulse-glow">
                    🎙️
                  </div>
                  <div className="mt-4 text-xs text-gray-500">Clique pour prononcer</div>
                </div>
                <div className="mt-4 p-3 rounded-xl bg-green-50 border border-green-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-green-700">Entendu : xièxie ✓</span>
                    <span className="text-lg font-bold text-green-600">92%</span>
                  </div>
                  <div className="h-1.5 bg-green-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: "92%" }} />
                  </div>
                  <div className="text-xs text-green-700 mt-1">⭐⭐⭐ Excellent ! Continue !</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ TÉMOIGNAGES ============ */}
      <section id="temoignages" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <span className="text-sm font-bold text-red-600 uppercase tracking-widest">Ils ont commencé comme toi</span>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-3">
                Des histoires qui <span className="text-gradient-red">changent des vies</span>
              </h2>
            </div>
          </Reveal>

          <div className="relative bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-gray-100">
            <div className="text-5xl text-red-200 absolute top-6 left-8 font-serif">"</div>
            <div key={currentTestimonial} className="anim-fadeIn">
              <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6 italic">
                {TESTIMONIALS[currentTestimonial].quote}
              </p>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center text-2xl">
                  {TESTIMONIALS[currentTestimonial].avatar}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{TESTIMONIALS[currentTestimonial].name}</div>
                  <div className="text-sm text-gray-500">{TESTIMONIALS[currentTestimonial].role}</div>
                  <div className="text-yellow-500 text-sm mt-0.5">{"⭐".repeat(5)}</div>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-2 mt-8">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentTestimonial(i)}
                  className={`h-2 rounded-full transition-all ${i === currentTestimonial ? "w-8 bg-red-500" : "w-2 bg-gray-300"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ IMPACT FONDATION ============ */}
      <section id="impact" className="py-20 px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-red-500 opacity-10 blur-3xl anim-float" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-orange-500 opacity-10 blur-3xl anim-float" style={{ animationDelay: "1.5s" }} />

        <div className="max-w-6xl mx-auto relative">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-sm font-bold text-rose-400 uppercase tracking-widest">❤️ Sauvons Nos Vies</span>
              <h2 className="text-3xl md:text-5xl font-bold mt-3 mb-4">
                Chaque mot appris<br />
                <span className="text-gradient-red">nourrit un futur.</span>
              </h2>
              <p className="text-gray-300 max-w-2xl mx-auto leading-relaxed">
                15% de nos revenus soutiennent le programme <b>Sauvons Nos Vies</b> de la VIE Foundation :
                santé, éducation, solutions durables et culture. Apprendre devient un acte solidaire.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-4 gap-4">
            {IMPACT_CARDS.map((c, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur card-hover h-full">
                  <div className="text-3xl mb-3">{c.icon}</div>
                  <div className="font-bold mb-1">{c.title}</div>
                  <div className="text-xs text-gray-400">{c.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.4}>
            <div className="mt-10 text-center">
              <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-3xl">🤝</span>
                <div className="text-left">
                  <div className="font-bold">Cagnotte communautaire en direct</div>
                  <div className="text-sm text-gray-400">
                    Déjà <b className="text-rose-400">{(progress?.pot || 0) + 128} pièces Sagesse</b> offertes par la communauté
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ CTA FINAL ============ */}
      <section className="py-20 px-4 bg-paper">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <div className="text-6xl mb-6 anim-bounce-soft">🇨🇳</div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-5">
              Ton voyage commence<br />
              <span className="text-gradient-red">par un seul mot.</span>
            </h2>
            <p className="text-gray-600 mb-8 max-w-xl mx-auto leading-relaxed">
              Rejoins YǔLù 语路, apprends à ton rythme, et fais partie de cette génération ivoirienne
              qui parle au monde. Gratuit, sans carte bancaire, pour toujours.
            </p>
            <button onClick={onStart} className="btn-primary px-10 py-5 rounded-2xl text-white font-bold text-lg shadow-2xl anim-pulse-glow">
              🚀 Commencer la Leçon 1 maintenant
            </button>
            <div className="mt-5 text-xs text-gray-400">
              ✓ Aucune inscription requise · ✓ Fonctionne hors ligne · ✓ Installable sur ton téléphone
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="py-10 px-4 border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white text-sm font-bold">语</div>
            <span>YǔLù 语路 — Campus chinois HSK</span>
          </div>
          <div className="text-center md:text-right">
            <div>Propulsé par <b className="text-gray-700">Kimatey Enterprise</b> · 加油！</div>
            <div className="text-xs mt-1">« Chaque mot compte. Chaque vie mérite un futur. » ❤️</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
