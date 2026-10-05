import React, { useState, useRef, useMemo, useEffect } from "react";

// ============================== STUDIO IA — Concepteur de cours automatique ==============================

export default function Studio({ onPublish, existingLessons, geminiKey }) {
  const [step, setStep] = useState("upload");
  const [mode, setMode] = useState("text");
  const [file, setFile] = useState(null);
  const [rawText, setRawText] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [progressMsg, setProgressMsg] = useState("");
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchPreviews, setBatchPreviews] = useState([]);
  const [batchErrors, setBatchErrors] = useState([]);
  const [duplicateSource, setDuplicateSource] = useState(null);
  const [reviseTarget, setReviseTarget] = useState(null);
  const [conflictReport, setConflictReport] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const batchInputRef = useRef(null);

  const MAX_CHARS_FOR_AI = 30000;
  const MAX_PDF_SIZE = 15 * 1024 * 1024;
  const MAX_BATCH_FILES = 10;

  // ============================== DÉTECTION DE DOUBLONS ==============================
  const detectConflicts = (newPreview, existingLessons) => {
    if (!newPreview || !existingLessons || existingLessons.length === 0) {
      return { hasConflict: false, conflicts: [], newVocab: [], duplicateVocab: [], similarLesson: null, similarityScore: 0 };
    }

    const normalize = (s) => String(s || "").toLowerCase().trim();

    const newTitle = normalize(newPreview.lesson.titre);
    const newZh = normalize(newPreview.lesson.zh);

    let similarLesson = null;
    let maxSimScore = 0;
    for (const existing of existingLessons) {
      let score = 0;
      if (normalize(existing.titre) === newTitle) score += 50;
      else if (normalize(existing.titre).includes(newTitle) || newTitle.includes(normalize(existing.titre))) score += 25;
      if (normalize(existing.zh) === newZh) score += 50;
      else if (normalize(existing.zh).includes(newZh) || newZh.includes(normalize(existing.zh))) score += 30;

      if (score > maxSimScore) {
        maxSimScore = score;
        similarLesson = existing;
      }
    }

    const existingVocabMap = new Map();
    for (const lesson of existingLessons) {
      for (const section of lesson.sections || []) {
        for (const v of section.vocab || []) {
          const key = normalize(v.hanzi);
          if (!existingVocabMap.has(key)) {
            existingVocabMap.set(key, {
              lesson: lesson.id,
              lessonTitle: lesson.titre,
              pinyin: v.pinyin,
              fr: v.fr,
            });
          }
        }
      }
    }

    const newVocab = [];
    const duplicateVocab = [];
    const conflicts = [];

    for (const section of newPreview.sections || []) {
      for (const v of section.vocab || []) {
        const key = normalize(v.hanzi);
        if (existingVocabMap.has(key)) {
          const existing = existingVocabMap.get(key);
          duplicateVocab.push({
            hanzi: v.hanzi,
            pinyin: v.pinyin,
            existing,
            samePinyin: normalize(v.pinyin) === normalize(existing.pinyin),
            sameFr: normalize(v.fr) === normalize(existing.fr),
          });
          if (normalize(v.pinyin) !== normalize(existing.pinyin) || normalize(v.fr) !== normalize(existing.fr)) {
            conflicts.push({
              hanzi: v.hanzi,
              newPinyin: v.pinyin,
              newFr: v.fr,
              existingPinyin: existing.pinyin,
              existingFr: existing.fr,
              lessonId: existing.lesson,
              lessonTitle: existing.lessonTitle,
            });
          }
        } else {
          newVocab.push(v);
        }
      }
    }

    return {
      hasConflict: maxSimScore >= 50 || conflicts.length > 0,
      conflicts,
      newVocab,
      duplicateVocab,
      similarLesson: maxSimScore >= 50 ? similarLesson : null,
      similarityScore: maxSimScore,
    };
  };

  // ============================== FUSION AVEC LEÇON EXISTANTE ==============================
  const mergeLessons = (existingLesson, newPreview) => {
    if (!existingLesson || !newPreview) return newPreview;

    const normalize = (s) => String(s || "").toLowerCase().trim();

    const existingVocabSet = new Set();
    for (const section of existingLesson.sections || []) {
      for (const v of section.vocab || []) {
        existingVocabSet.add(normalize(v.hanzi));
      }
    }

    const newWords = [];
    for (const section of newPreview.sections || []) {
      for (const v of section.vocab || []) {
        if (!existingVocabSet.has(normalize(v.hanzi))) {
          newWords.push(v);
        }
      }
    }

    return {
      ...existingLesson,
      sections: [
        ...existingLesson.sections,
        ...(newWords.length > 0
          ? [
              {
                titre: "Compléments (fusion IA)",
                vocab: newWords,
              },
            ]
          : []),
      ],
      phrases: [
        ...(existingLesson.phrases || []),
        ...(newPreview.phrases || []).filter(
          (p) => !(existingLesson.phrases || []).some((ep) => normalize(ep.zh) === normalize(p.zh))
        ),
      ],
      pinyinNotes: [
        ...(existingLesson.pinyinNotes || []),
        ...(newPreview.pinyinNotes || []).filter(
          (n) => !(existingLesson.pinyinNotes || []).includes(n)
        ),
      ],
      quiz: [
        ...(existingLesson.quiz || []),
        ...(newPreview.quiz || []).filter(
          (q) => !(existingLesson.quiz || []).some((eq) => normalize(eq.question) === normalize(q.question))
        ),
      ],
    };
  };

  // ============================== VALIDATION DE COHÉRENCE ==============================
  const validateLesson = (lesson) => {
    const issues = [];
    if (!lesson) issues.push("Leçon vide");
    if (!lesson.lesson?.titre) issues.push("Titre manquant");
    if (!lesson.sections || lesson.sections.length === 0) issues.push("Aucune section de vocabulaire");
    else {
      const totalWords = lesson.sections.reduce((a, s) => a + (s.vocab?.length || 0), 0);
      if (totalWords === 0) issues.push("Aucun mot dans les sections");
      if (totalWords > 60) issues.push(`Trop de mots (${totalWords}), max conseillé : 50`);
    }
    if (!lesson.quiz || lesson.quiz.length === 0) issues.push("Aucune question de quiz");
    return { valid: issues.length === 0, issues };
  };

  // ============================== EXTRACTION PDF ==============================
  const extractPdfText = async (pdfFile) => {
    if (pdfFile.size > MAX_PDF_SIZE) {
      throw new Error(`PDF trop volumineux (${(pdfFile.size / 1024 / 1024).toFixed(1)} Mo). Maximum 15 Mo.`);
    }

    console.log("📄 Début extraction PDF:", pdfFile.name);
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log("📖 PDF ouvert, pages:", pdf.numPages);

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      setProgressMsg(`📄 Lecture page ${i} / ${pdf.numPages}…`);
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(" ");
        fullText += pageText + "\n\n";
      } catch (pageErr) {
        console.warn(`⚠️ Erreur page ${i}:`, pageErr);
      }
    }

    console.log("✅ PDF extrait:", fullText.length, "caractères");
    return fullText;
  };

  // ============================== PHOTO — Gemini Vision ==============================
  const analyzePhoto = async (photoFile) => {
    if (!geminiKey) throw new Error("no-key");
    if (photoFile.size > 10 * 1024 * 1024) {
      throw new Error("Image trop volumineuse (max 10 Mo).");
    }

    setProgressMsg("🖼️ Analyse de la photo par Gemini Vision…");

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(photoFile);
    });

    const mimeType = photoFile.type || "image/jpeg";

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        encodeURIComponent(geminiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "Transcris TOUT le texte visible dans cette image, sans rien commenter. Si c'est un cours de chinois, garde les caractères chinois, le pinyin et les traductions. Retourne uniquement le texte brut, ligne par ligne.",
                },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    const data = await res.json();
    if (data.error) throw new Error("Gemini Vision: " + (data.error.message || "erreur API"));
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts;
    if (!parts || !parts[0] || !parts[0].text) throw new Error("vision-failed");
    return parts[0].text.trim();
  };

  // ============================== LECTURE FICHIER ==============================
  const handleFile = async (f) => {
    setFile(f);
    setError("");
    setSuccessMsg("");
    setProgressMsg("");
    setRawText("");

    try {
      const name = f.name.toLowerCase();
      console.log("📁 Fichier reçu:", f.name, "taille:", f.size);

      if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
        const text = await f.text();
        setRawText(text);
        setSuccessMsg(`✅ ${text.length.toLocaleString()} caractères extraits du fichier texte`);
      } else if (name.endsWith(".html") || name.endsWith(".htm")) {
        const html = await f.text();
        const div = document.createElement("div");
        div.innerHTML = html;
        const text = div.innerText || div.textContent || "";
        setRawText(text);
        setSuccessMsg(`✅ ${text.length.toLocaleString()} caractères extraits (HTML)`);
      } else if (name.endsWith(".pdf")) {
        const text = await extractPdfText(f);
        setRawText(text);
        setSuccessMsg(`✅ PDF lu avec succès : ${text.length.toLocaleString()} caractères`);
      } else if (f.type.startsWith("image/")) {
        if (!geminiKey) {
          setError("🔑 Clé Gemini requise pour analyser les photos. Configure-la dans Prof IA (⚙️).");
          return;
        }
        const text = await analyzePhoto(f);
        setRawText(text);
        setSuccessMsg(`✅ Photo analysée : ${text.length.toLocaleString()} caractères reconnus`);
      } else {
        setError("❌ Format non supporté. Utilise .txt, .md, .pdf, .html ou une image.");
      }
    } catch (e) {
      console.error("❌ Erreur handleFile:", e);
      if (e.message === "no-key") {
        setError("🔑 Ajoute ta clé Gemini dans Prof IA (⚙️) pour analyser les images.");
      } else if (e.message && (e.message.includes("PDF") || e.message.includes("volumineux"))) {
        setError("❌ " + e.message);
      } else if (e.message && e.message.includes("Vision")) {
        setError("❌ Erreur Gemini Vision : " + e.message);
      } else {
        setError("❌ Impossible de lire ce fichier : " + (e.message || "erreur inconnue"));
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-red-500", "bg-red-50");
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  // ============================== PROMPT IA ==============================
  const buildPrompt = (source, nextId, kind = "new") => {
    const wasTruncated = source.length > MAX_CHARS_FOR_AI;
    const truncated = wasTruncated ? source.slice(0, MAX_CHARS_FOR_AI) : source;

    return `Tu es un concepteur pédagogique expert HSK 1 (débutant absolu, niveau A1) pour des apprenants francophones en Côte d'Ivoire.

${kind === "revise" ? "Voici une leçon existante à AMÉLIORER :" : "Voici le CONTENU BRUT d'un cours :"}

"""
${truncated}
"""

${wasTruncated ? "⚠️ Le document était long, seule une partie a été analysée.\n" : ""}

Ta mission : transformer ce contenu en une leçon YǔLù complète et structurée.

Réponds UNIQUEMENT avec du JSON valide (pas de markdown, pas de texte autour) :

{
  "lesson": {
    "id": ${nextId},
    "titre": "Leçon ${nextId}",
    "zh": "2 à 5 caractères chinois qui résument le thème",
    "pinyin": "pinyin du titre",
    "fr": "traduction française du titre"
  },
  "sections": [
    {
      "titre": "Nom de la section en français",
      "vocab": [
        { "hanzi": "你好", "pinyin": "nǐ hǎo", "fr": "Bonjour" }
      ]
    }
  ],
  "phrases": [
    { "zh": "你好，我是李明。", "pinyin": "Nǐ hǎo, wǒ shì Lǐ Míng.", "fr": "Bonjour, je suis Li Ming." }
  ],
  "pinyinNotes": ["Note pédagogique sur le pinyin"],
  "caracteres": ["Description d'un trait ou d'un caractère à étudier"],
  "quiz": [
    {
      "type": "Vocabulaire",
      "question": "Que signifie 你好 ?",
      "options": ["Bonjour", "Merci", "Au revoir", "Désolé"],
      "answer": 0,
      "explication": "你好 = littéralement « toi bien »"
    }
  ],
  "dialogues": [
    ["A", "你好！", "Nǐ hǎo!", "Bonjour !"],
    ["B", "你好！", "Nǐ hǎo!", "Bonjour !"]
  ]
}

CONTRAINTES :
- 2 à 5 sections de vocabulaire, 5 à 10 mots par section
- 3 à 5 phrases clés
- 3 à 6 notes de pinyin
- 2 à 4 notes sur les caractères
- 6 à 10 questions de quiz avec 4 options chacune (varie l'index : 0, 1, 2, 3)
- 1 à 2 dialogues de 3 à 6 répliques
- Vocabulaire HSK 1 uniquement
- Pinyin avec tons corrects

RÉPONDS UNIQUEMENT AVEC LE JSON.`;
  };

  // ============================== APPEL GEMINI ==============================
  const callGemini = async (source, kind = "new") => {
    if (!geminiKey) throw new Error("no-key");

    const nextId = Math.max(5, ...(existingLessons || []).map((l) => l.id || 5)) + 1;
    const prompt = buildPrompt(source, nextId, kind);

    console.log("🤖 Appel Gemini, longueur prompt:", prompt.length);

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        encodeURIComponent(geminiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 8192 },
        }),
      }
    );

    const data = await res.json();

    if (data.error) {
      console.error("❌ Erreur API Gemini:", data.error);
      throw new Error("Gemini API: " + (data.error.message || "erreur inconnue"));
    }

    const parts = (((data.candidates || [])[0] || {}).content || {}).parts;
    if (!parts || !parts[0] || !parts[0].text) throw new Error("empty-response");

    let txt = parts[0].text.trim();
    txt = txt.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    const s = txt.indexOf("{");
    const e = txt.lastIndexOf("}");
    if (s >= 0 && e > s) txt = txt.slice(s, e + 1);

    try {
      return JSON.parse(txt);
    } catch (jsonErr) {
      console.error("❌ Erreur parsing JSON:", jsonErr);
      throw new Error("Réponse IA invalide (JSON malformé). Réessaie.");
    }
  };

  // ============================== NORMALISATION ==============================
  const normalize = (data, id) => ({
    lesson: {
      id,
      titre: data.lesson?.titre || `Leçon ${id}`,
      zh: data.lesson?.zh || "汉语",
      pinyin: data.lesson?.pinyin || "",
      fr: data.lesson?.fr || "",
    },
    sections: (data.sections || [])
      .map((s) => ({
        titre: s.titre || "Vocabulaire",
        vocab: (s.vocab || []).filter((v) => v.hanzi),
      }))
      .filter((s) => s.vocab.length > 0),
    phrases: (data.phrases || []).filter((p) => p.zh),
    pinyinNotes: data.pinyinNotes || [],
    caracteres: data.caracteres || [],
    quiz: (data.quiz || [])
      .filter((q) => q.question && q.options && q.options.length >= 2)
      .map((q) => ({
        lesson: id,
        type: q.type || "Studio",
        question: q.question,
        options: q.options,
        answer: Number(q.answer) || 0,
        explication: q.explication || "",
      })),
    dialogues: data.dialogues || [],
  });

  // ============================== GÉNÉRATION ==============================
  const generate = async () => {
    const source = (rawText || pastedText).trim();
    if (!source) {
      setError("❌ Dépose un fichier ou colle le contenu du cours.");
      return;
    }
    if (!geminiKey) {
      setError("🔑 Configure ta clé API Gemini dans l'onglet Prof IA (⚙️).");
      return;
    }

    setError("");
    setSuccessMsg("");
    setConflictReport(null);
    setPendingPreview(null);
    setStep("analyzing");
    setProgressMsg("🤖 L'IA analyse ton cours…");

    try {
      const nextId = Math.max(5, ...(existingLessons || []).map((l) => l.id || 5)) + 1;
      const data = await callGemini(source, "new");
      const normalized = normalize(data, nextId);

      const validation = validateLesson(normalized);
      if (!validation.valid) {
        console.warn("⚠️ Leçon incomplète:", validation.issues);
      }

      const conflicts = detectConflicts(normalized, existingLessons);
      console.log("🔍 Analyse de conformité:", conflicts);

      if (conflicts.hasConflict) {
        setPendingPreview(normalized);
        setConflictReport(conflicts);
        setProgressMsg("");
        setStep("conflict");
      } else {
        setPreview(normalized);
        setProgressMsg("");
        setStep("preview");
      }
    } catch (e) {
      console.error("❌ Erreur generate:", e);
      let msg = "L'IA n'a pas pu générer. ";
      if (e.message === "no-key") msg += "Clé API manquante.";
      else if (e.message.includes("API")) msg += e.message;
      else if (e.message.includes("JSON")) msg += "Réponse malformée, réessaie.";
      else msg += "Vérifie ta clé (Prof IA ⚙️) et réessaie.";
      setError("❌ " + msg);
      setStep("upload");
      setProgressMsg("");
    }
  };

  // ============================== IMPORT EN MASSE ==============================
  const handleBatchFiles = async (files) => {
    if (!geminiKey) {
      setError("🔑 Clé API Gemini requise pour l'import en masse.");
      return;
    }
    if (files.length > MAX_BATCH_FILES) {
      setError(`⚠️ Maximum ${MAX_BATCH_FILES} fichiers à la fois.`);
      return;
    }
    setError("");
    setBatchFiles([...files]);
    setBatchPreviews([]);
    setBatchErrors([]);
    setSuccessMsg(`✅ ${files.length} fichier(s) prêt(s) à générer`);
  };

  const runBatch = async () => {
    if (!geminiKey) return setError("🔑 Clé API Gemini requise.");
    if (!batchFiles.length) return setError("❌ Sélectionne au moins 1 fichier.");

    setStep("analyzing");
    setSuccessMsg("");
    const results = [];
    const errors = [];

    for (let i = 0; i < batchFiles.length; i++) {
      const f = batchFiles[i];
      try {
        setProgressMsg(`📄 Fichier ${i + 1}/${batchFiles.length} : ${f.name} — lecture…`);
        let text = "";
        const name = f.name.toLowerCase();

        if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
          text = await f.text();
        } else if (name.endsWith(".pdf")) {
          text = await extractPdfText(f);
        } else if (f.type.startsWith("image/")) {
          text = await analyzePhoto(f);
        } else if (name.endsWith(".html")) {
          const html = await f.text();
          const div = document.createElement("div");
          div.innerHTML = html;
          text = div.innerText || "";
        } else {
          throw new Error("Format non supporté");
        }

        if (!text || !text.trim()) throw new Error("Fichier vide");

        setProgressMsg(`🤖 Fichier ${i + 1}/${batchFiles.length} — génération IA…`);
        const nextId = Math.max(5, ...(existingLessons || []).map((l) => l.id || 5)) + i + 1;
        const data = await callGemini(text, "new");
        const normalized = normalize(data, nextId);

        const conflicts = detectConflicts(normalized, [...(existingLessons || []), ...results]);
        if (conflicts.hasConflict) {
          errors.push({
            file: f.name,
            error: `Conflit détecté (${conflicts.conflicts.length} conflits, ${conflicts.duplicateVocab.length} doublons)`,
          });
          continue;
        }

        results.push(normalized);
      } catch (e) {
        console.error(`❌ Erreur fichier ${f.name}:`, e);
        errors.push({ file: f.name, error: e.message || "erreur inconnue" });
      }
    }

    setBatchPreviews(results);
    setBatchErrors(errors);
    setProgressMsg("");

    if (results.length === 0) {
      setError("❌ Aucune leçon n'a pu être générée.");
      setStep("upload");
      return;
    }

    setStep("batch-preview");
  };

  const publishBatch = () => {
    batchPreviews.forEach((p) => onPublish(p));
    setStep("published");
  };

  // ============================== DUPLICATION ==============================
  const runDuplicate = async () => {
    if (!duplicateSource) return setError("❌ Choisis une leçon à dupliquer.");
    if (!geminiKey) return setError("🔑 Clé API Gemini requise.");
    setStep("analyzing");
    try {
      const src = duplicateSource;
      const text = [
        `Leçon : ${src.titre} — ${src.zh} (${src.pinyin}) = ${src.fr}`,
        ...src.sections.flatMap((s) => [
          `Section : ${s.titre}`,
          ...s.vocab.map((v) => `${v.hanzi} ${v.pinyin} = ${v.fr}`),
        ]),
        ...(src.phrases || []).map((p) => `Phrase : ${p.zh} (${p.pinyin}) = ${p.fr}`),
      ].join("\n");

      setProgressMsg("🔄 L'IA crée une variante enrichie…");
      const nextId = Math.max(5, ...(existingLessons || []).map((l) => l.id || 5)) + 1;
      const data = await callGemini(
        text + "\n\nCrée une VARIANTE enrichie de cette leçon.",
        "new"
      );
      const normalized = normalize(data, nextId);

      const conflicts = detectConflicts(normalized, existingLessons);
      if (conflicts.hasConflict) {
        setPendingPreview(normalized);
        setConflictReport(conflicts);
        setProgressMsg("");
        setStep("conflict");
      } else {
        setPreview(normalized);
        setProgressMsg("");
        setStep("preview");
      }
    } catch (e) {
      setError("❌ Impossible de dupliquer : " + e.message);
      setStep("upload");
    }
  };

  // ============================== RÉVISION ==============================
  const runRevise = async () => {
    if (!reviseTarget) return setError("❌ Choisis une leçon à réviser.");
    if (!geminiKey) return setError("🔑 Clé API Gemini requise.");
    setStep("analyzing");
    try {
      const src = reviseTarget;
      const text = JSON.stringify(src);
      setProgressMsg("🔧 L'IA révise et améliore la leçon…");
      const data = await callGemini(text, "revise");
      setPreview(normalize(data, src.id));
      setProgressMsg("");
      setStep("preview");
    } catch (e) {
      setError("❌ Impossible de réviser : " + e.message);
      setStep("upload");
    }
  };

  // ============================== ÉDITION ==============================
  const updateLesson = (field, value) =>
    setPreview((p) => ({ ...p, lesson: { ...p.lesson, [field]: value } }));

  const updateVocab = (si, vi, field, value) =>
    setPreview((p) => {
      const next = JSON.parse(JSON.stringify(p));
      next.sections[si].vocab[vi][field] = value;
      return next;
    });

  const removeVocab = (si, vi) =>
    setPreview((p) => {
      const next = JSON.parse(JSON.stringify(p));
      next.sections[si].vocab.splice(vi, 1);
      return next;
    });

  const addVocab = (si) =>
    setPreview((p) => {
      const next = JSON.parse(JSON.stringify(p));
      next.sections[si].vocab.push({ hanzi: "", pinyin: "", fr: "" });
      return next;
    });

  const removeSection = (si) =>
    setPreview((p) => {
      const next = JSON.parse(JSON.stringify(p));
      next.sections.splice(si, 1);
      return next;
    });

  const addSection = () =>
    setPreview((p) => ({
      ...p,
      sections: [...p.sections, { titre: "Nouvelle section", vocab: [] }],
    }));

  const updateQuiz = (qi, field, value) =>
    setPreview((p) => {
      const next = JSON.parse(JSON.stringify(p));
      next.quiz[qi][field] = value;
      return next;
    });

  const removeQuiz = (qi) =>
    setPreview((p) => {
      const next = JSON.parse(JSON.stringify(p));
      next.quiz.splice(qi, 1);
      return next;
    });

  // ============================== EXPORT / IMPORT ==============================
  const exportJSON = () => {
    if (!preview) return;
    const blob = new Blob([JSON.stringify(preview, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yulu-${preview.lesson.titre.replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (jsonFile) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.lesson || !data.sections) throw new Error("invalid");
        setPreview(data);
        setStep("preview");
      } catch (err) {
        setError("❌ Fichier JSON invalide.");
      }
    };
    reader.readAsText(jsonFile);
  };

  // ============================== PUBLICATION ==============================
  const publish = () => {
    if (!preview) return;
    onPublish(preview);
    setStep("published");
  };

  const reset = () => {
    setFile(null);
    setRawText("");
    setPastedText("");
    setPreview(null);
    setBatchFiles([]);
    setBatchPreviews([]);
    setBatchErrors([]);
    setDuplicateSource(null);
    setReviseTarget(null);
    setConflictReport(null);
    setPendingPreview(null);
    setStep("upload");
    setError("");
    setSuccessMsg("");
    setProgressMsg("");
  };

  // ============================== RENDU ==============================
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎬</span>
          <div>
            <h3 className="text-xl font-bold">YǔLù Studio — Concepteur de cours automatique</h3>
            <p className="text-sm opacity-90">Dépose un PDF, une photo ou du texte — l'IA génère toute la leçon.</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-3 text-[10px]">
          {[
            ["upload", "1. Source"],
            ["analyzing", "2. Analyse"],
            ["conflict", "⚠️ Conflit"],
            ["preview", "3. Édition"],
            ["batch-preview", "4. Lot"],
            ["published", "5. Publié ✓"],
          ].map(([id, label], i) => (
            <div
              key={id}
              className={`px-3 py-1 rounded-full font-bold ${
                step === id
                  ? "bg-white text-purple-700"
                  : ["upload", "analyzing", "conflict", "preview", "batch-preview", "published"].indexOf(step) > i
                  ? "bg-white/30"
                  : "bg-white/10 opacity-60"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border-2 border-red-400 text-red-800 text-sm font-medium whitespace-pre-line">
          {error}
        </div>
      )}

      {/* Succès */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-green-50 border-2 border-green-400 text-green-800 text-sm font-bold">
          {successMsg}
        </div>
      )}

      {/* Progression */}
      {progressMsg && (
        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm font-medium">
          {progressMsg}
        </div>
      )}

      {/* ====================== ÉTAPE 1 : UPLOAD ====================== */}
      {step === "upload" && (
        <>
          <div className="flex flex-wrap gap-2">
            {[
              ["text", "📝 Texte"],
              ["pdf", "📄 PDF"],
              ["photo", "🖼️ Photo"],
              ["batch", "📦 Import en masse"],
              ["duplicate", "🔄 Dupliquer"],
              ["revise", "🔧 Réviser"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => { setMode(id); setFile(null); setRawText(""); setSuccessMsg(""); setError(""); }}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  mode === id
                    ? "bg-purple-600 text-white shadow-lg"
                    : "bg-white border border-gray-300 text-gray-700 hover:border-purple-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* TEXTE */}
          {mode === "text" && (
            <div className="p-5 rounded-2xl border border-gray-200 bg-white">
              <label className="font-bold text-gray-900 text-sm mb-2 block">📝 Colle le contenu de ton cours</label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={`Exemple :

Leçon 6 — Les couleurs (颜色)
红色 hóngsè : rouge
黄色 huángsè : jaune
...`}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm h-64 font-mono focus:border-purple-500 outline-none"
              />
              <div className="text-xs text-gray-400 mt-1">{pastedText.length.toLocaleString()} caractères</div>
              <button
                onClick={generate}
                disabled={!pastedText.trim()}
                className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-700 hover:to-pink-700 shadow-lg disabled:opacity-40"
              >
                ✨ Générer la leçon avec l'IA →
              </button>
            </div>
          )}

          {/* PDF */}
          {mode === "pdf" && (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("border-purple-500", "bg-purple-50");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("border-purple-500", "bg-purple-50");
                }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="p-10 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/40 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all"
              >
                <div className="text-5xl mb-3">📄</div>
                <div className="font-bold text-gray-900 mb-1">Dépose ton PDF ici</div>
                <div className="text-sm text-gray-500 mb-3">ou clique pour parcourir (max 15 Mo)</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden"
                />
              </div>

              {file && rawText && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">📄</span>
                        <b className="text-green-800 text-sm truncate">{file.name}</b>
                      </div>
                      <div className="text-xs text-green-700">
                        {(file.size / 1024).toFixed(0)} Ko · {rawText.length.toLocaleString()} caractères extraits
                      </div>
                    </div>
                    <button
                      onClick={generate}
                      disabled={!geminiKey}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-700 hover:to-pink-700 shadow-lg disabled:opacity-40 whitespace-nowrap"
                    >
                      ✨ Générer la leçon →
                    </button>
                  </div>
                  {!geminiKey && (
                    <div className="mt-3 text-xs text-red-600 font-bold">
                      ⚠️ Configure ta clé Gemini dans Prof IA (⚙️) pour continuer
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* PHOTO */}
          {mode === "photo" && (
            <>
              <div
                onDrop={handleDrop}
                className="p-10 rounded-2xl border-2 border-dashed border-pink-300 bg-pink-50/40 text-center cursor-pointer hover:border-pink-500 hover:bg-pink-50 transition-all"
                onClick={() => photoInputRef.current?.click()}
              >
                <div className="text-5xl mb-3">🖼️</div>
                <div className="font-bold text-gray-900 mb-1">Photo de ton cours manuscrit</div>
                <div className="text-sm text-gray-500 mb-3">Gemini Vision analyse l'image et transcrit le texte</div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden"
                />
                <div className="mt-3 text-xs text-pink-700">⚙️ Nécessite ta clé Gemini (Prof IA → ⚙️)</div>
              </div>

              {file && rawText && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">🖼️</span>
                        <b className="text-green-800 text-sm truncate">{file.name}</b>
                      </div>
                      <div className="text-xs text-green-700">
                        {rawText.length.toLocaleString()} caractères reconnus
                      </div>
                    </div>
                    <button
                      onClick={generate}
                      disabled={!geminiKey}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-700 hover:to-pink-700 shadow-lg disabled:opacity-40 whitespace-nowrap"
                    >
                      ✨ Générer la leçon →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* BATCH */}
          {mode === "batch" && (
            <div className="p-5 rounded-2xl border border-gray-200 bg-white">
              <label className="font-bold text-gray-900 text-sm mb-2 block">📦 Import en masse</label>
              <p className="text-xs text-gray-500 mb-3">
                Jusqu'à {MAX_BATCH_FILES} fichiers (.txt, .md, .pdf, images). Détection automatique des conflits.
              </p>
              <input
                ref={batchInputRef}
                type="file"
                accept=".txt,.md,.pdf,image/*,.html"
                multiple
                onChange={(e) => e.target.files && handleBatchFiles([...e.target.files])}
                className="hidden"
              />
              <button
                onClick={() => batchInputRef.current?.click()}
                className="w-full py-8 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50/40 hover:bg-purple-50 text-gray-700 font-bold"
              >
                📁 Choisir les fichiers ({batchFiles.length} sélectionné{batchFiles.length > 1 ? "s" : ""})
              </button>
              {batchFiles.length > 0 && (
                <>
                  <ul className="mt-3 space-y-1 text-xs text-gray-600 max-h-32 overflow-auto">
                    {batchFiles.map((f, i) => (
                      <li key={i}>📄 {f.name} ({(f.size / 1024).toFixed(0)} Ko)</li>
                    ))}
                  </ul>
                  <button
                    onClick={runBatch}
                    className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-lg"
                  >
                    ✨ Générer les {batchFiles.length} leçons
                  </button>
                </>
              )}
            </div>
          )}

          {/* DUPLICATE */}
          {mode === "duplicate" && (
            <div className="p-5 rounded-2xl border border-gray-200 bg-white">
              <label className="font-bold text-gray-900 text-sm mb-3 block">🔄 Dupliquer une leçon avec variations IA</label>
              <select
                value={duplicateSource?.id || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setDuplicateSource((existingLessons || []).find((l) => l.id === id) || null);
                }}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
              >
                <option value="">— Choisir une leçon à dupliquer —</option>
                {(existingLessons || []).map((l) => (
                  <option key={l.id} value={l.id}>
                    Leçon {l.id} · {l.titre} · {l.zh}
                  </option>
                ))}
              </select>
              <button
                onClick={runDuplicate}
                disabled={!duplicateSource}
                className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-lg disabled:opacity-40"
              >
                ✨ Créer une variante enrichie
              </button>
            </div>
          )}

          {/* REVISE */}
          {mode === "revise" && (
            <div className="p-5 rounded-2xl border border-gray-200 bg-white">
              <label className="font-bold text-gray-900 text-sm mb-3 block">🔧 Révise et améliore une leçon existante</label>
              <p className="text-xs text-gray-500 mb-3">
                L'IA reprend la leçon, corrige les erreurs, enrichit les exemples.
              </p>
              <select
                value={reviseTarget?.id || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setReviseTarget((existingLessons || []).find((l) => l.id === id) || null);
                }}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
              >
                <option value="">— Choisir une leçon à réviser —</option>
                {(existingLessons || []).map((l) => (
                  <option key={l.id} value={l.id}>
                    Leçon {l.id} · {l.titre}
                  </option>
                ))}
              </select>
              <button
                onClick={runRevise}
                disabled={!reviseTarget}
                className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-lg disabled:opacity-40"
              >
                🔧 Réviser avec l'IA
              </button>
            </div>
          )}

          {/* Import JSON */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
            <label className="font-bold text-gray-800 text-sm block mb-2">💾 Importer une leçon depuis un fichier JSON</label>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])}
              className="block w-full text-xs"
            />
            <p className="text-[10px] text-gray-500 mt-1">Partage de leçons entre appareils · format YǔLù</p>
          </div>
        </>
      )}

      {/* ====================== ÉTAPE 2 : ANALYSE ====================== */}
      {step === "analyzing" && (
        <div className="p-12 rounded-2xl bg-white border border-purple-200 text-center">
          <div className="text-6xl mb-4 animate-pulse">🤖</div>
          <div className="text-lg font-bold text-gray-900 mb-2">L'IA conçoit ta leçon…</div>
          <div className="text-sm text-gray-500 mb-6">{progressMsg || "Analyse en cours"}</div>
          <div className="max-w-xs mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-600 rounded-full"
              style={{ animation: "indeterminate 1.5s ease-in-out infinite", width: "40%" }}
            />
          </div>
          <style>{`@keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }`}</style>
        </div>
      )}

      {/* ====================== ÉTAPE 2.5 : CONFLIT ====================== */}
      {step === "conflict" && conflictReport && pendingPreview && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400">
            <div className="flex items-start gap-3">
              <span className="text-4xl">⚠️</span>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-amber-900 mb-2">
                  {conflictReport.similarLesson ? "Leçon similaire détectée !" : "Conflits de vocabulaire détectés"}
                </h3>
                <p className="text-sm text-amber-800">
                  Cette nouvelle leçon partage du contenu avec une ou plusieurs leçons existantes.
                  Choisis comment procéder :
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {conflictReport.similarLesson && (
              <div className="p-5 rounded-2xl bg-white border-2 border-amber-200">
                <h4 className="font-bold text-amber-900 mb-2">🔍 Leçon similaire</h4>
                <div className="p-3 rounded-xl bg-amber-50">
                  <div className="font-bold text-gray-900">
                    Leçon {conflictReport.similarLesson.id} · {conflictReport.similarLesson.titre}
                  </div>
                  <div className="text-sm text-amber-700">
                    {conflictReport.similarLesson.zh} ({conflictReport.similarLesson.pinyin})
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {conflictReport.similarLesson.sections?.reduce((a, s) => a + (s.vocab?.length || 0), 0)} mots existants
                  </div>
                </div>
              </div>
            )}

            <div className="p-5 rounded-2xl bg-white border-2 border-blue-200">
              <h4 className="font-bold text-blue-900 mb-2">📊 Analyse du contenu</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Mots nouveaux :</span>
                  <b className="text-green-600">{conflictReport.newVocab.length}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mots déjà vus :</span>
                  <b className="text-amber-600">{conflictReport.duplicateVocab.length}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Conflits réels :</span>
                  <b className="text-red-600">{conflictReport.conflicts.length}</b>
                </div>
              </div>
            </div>
          </div>

          {conflictReport.conflicts.length > 0 && (
            <div className="p-5 rounded-2xl bg-white border-2 border-red-200">
              <h4 className="font-bold text-red-900 mb-3">⚔️ Conflits à résoudre ({conflictReport.conflicts.length})</h4>
              <div className="space-y-2 max-h-48 overflow-auto">
                {conflictReport.conflicts.slice(0, 10).map((c, i) => (
                  <div key={i} className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
                    <div className="font-bold text-gray-900 text-lg">{c.hanzi}</div>
                    <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                      <div>
                        <span className="text-gray-500">Nouveau :</span>{" "}
                        <b className="text-blue-700">{c.newPinyin}</b> — {c.newFr}
                      </div>
                      <div>
                        <span className="text-gray-500">Existant :</span>{" "}
                        <b className="text-amber-700">{c.existingPinyin}</b> — {c.existingFr}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      Conflit avec Leçon {c.lessonId} · {c.lessonTitle}
                    </div>
                  </div>
                ))}
                {conflictReport.conflicts.length > 10 && (
                  <div className="text-xs text-gray-500 text-center">
                    … et {conflictReport.conflicts.length - 10} autres conflits
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-5 rounded-2xl bg-white border-2 border-gray-200">
            <h4 className="font-bold text-gray-900 mb-3">🎬 Que veux-tu faire ?</h4>
            <div className="grid md:grid-cols-3 gap-3">
              {conflictReport.similarLesson && (
                <button
                  onClick={() => {
                    const merged = mergeLessons(conflictReport.similarLesson, pendingPreview);
                    setPreview(merged);
                    setConflictReport(null);
                    setPendingPreview(null);
                    setStep("preview");
                    setSuccessMsg(`✅ Leçon fusionnée avec Leçon ${conflictReport.similarLesson.id}`);
                  }}
                  className="p-4 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-left hover:from-blue-600 hover:to-indigo-700 shadow-lg transition-all"
                >
                  <div className="text-2xl mb-1">🔀</div>
                  <div className="font-bold">Fusionner</div>
                  <div className="text-xs opacity-90 mt-1">
                    Ajouter uniquement les {conflictReport.newVocab.length} mots nouveaux à la leçon existante
                  </div>
                </button>
              )}

              <button
                onClick={() => {
                  setPreview(pendingPreview);
                  setConflictReport(null);
                  setPendingPreview(null);
                  setStep("preview");
                  setSuccessMsg("⚠️ Leçon créée avec doublons — vérifie bien avant publication");
                }}
                className="p-4 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white text-left hover:from-amber-600 hover:to-orange-700 shadow-lg transition-all"
              >
                <div className="text-2xl mb-1">🟡</div>
                <div className="font-bold">Créer quand même</div>
                <div className="text-xs opacity-90 mt-1">
                  Ignorer les conflits et publier cette leçon telle quelle
                </div>
              </button>

              <button
                onClick={() => {
                  setConflictReport(null);
                  setPendingPreview(null);
                  setStep("upload");
                }}
                className="p-4 rounded-xl bg-gray-100 text-gray-700 text-left hover:bg-gray-200 transition-all"
              >
                <div className="text-2xl mb-1">🔴</div>
                <div className="font-bold">Annuler</div>
                <div className="text-xs text-gray-500 mt-1">
                  Retourner en arrière et modifier le contenu source
                </div>
              </button>
            </div>
          </div>

          <details className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <summary className="cursor-pointer font-bold text-gray-700 text-sm">
              👁️ Voir la nouvelle leçon générée ({pendingPreview.sections?.reduce((a, s) => a + s.vocab.length, 0)} mots)
            </summary>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <b>{pendingPreview.lesson.titre}</b> · {pendingPreview.lesson.zh} ({pendingPreview.lesson.pinyin})
              </div>
              {pendingPreview.sections.map((s, i) => (
                <div key={i} className="pl-3 border-l-2 border-purple-300">
                  <div className="font-medium text-gray-700">{s.titre}</div>
                  <div className="text-xs text-gray-500">
                    {s.vocab.map((v) => `${v.hanzi} (${v.pinyin})`).join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* ====================== ÉTAPE 3 : PREVIEW ====================== */}
      {step === "preview" && preview && (
        <>
          <div className="p-5 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✨</span>
              <div>
                <b className="text-green-800">Leçon prête à publier ! Vérifie et édite si besoin.</b>
                <div className="text-xs text-green-600">
                  {preview.sections.reduce((a, s) => a + s.vocab.length, 0)} mots · {preview.quiz.length} quiz · {preview.phrases.length} phrases
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-gray-200 bg-white">
            <h4 className="font-bold text-gray-900 mb-3">📌 Titre de la leçon</h4>
            <div className="grid md:grid-cols-4 gap-2">
              <input
                value={preview.lesson.titre}
                onChange={(e) => updateLesson("titre", e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold"
              />
              <input
                value={preview.lesson.zh}
                onChange={(e) => updateLesson("zh", e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-lg font-bold"
              />
              <input
                value={preview.lesson.pinyin}
                onChange={(e) => updateLesson("pinyin", e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
              <input
                value={preview.lesson.fr}
                onChange={(e) => updateLesson("fr", e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
          </div>

          {preview.sections.map((section, si) => (
            <div key={si} className="p-5 rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between mb-3">
                <input
                  value={section.titre}
                  onChange={(e) => {
                    const next = JSON.parse(JSON.stringify(preview));
                    next.sections[si].titre = e.target.value;
                    setPreview(next);
                  }}
                  className="font-bold text-gray-900 text-base border-b border-transparent hover:border-gray-300 focus:border-purple-500 outline-none flex-1"
                />
                <button onClick={() => removeSection(si)} className="text-red-500 hover:text-red-700 text-sm px-2">
                  🗑️
                </button>
              </div>
              <div className="space-y-2">
                {section.vocab.map((v, vi) => (
                  <div key={vi} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      value={v.hanzi}
                      onChange={(e) => updateVocab(si, vi, "hanzi", e.target.value)}
                      className="col-span-3 px-2 py-1.5 rounded border border-gray-200 text-lg font-bold"
                    />
                    <input
                      value={v.pinyin}
                      onChange={(e) => updateVocab(si, vi, "pinyin", e.target.value)}
                      className="col-span-3 px-2 py-1.5 rounded border border-gray-200 text-sm"
                    />
                    <input
                      value={v.fr}
                      onChange={(e) => updateVocab(si, vi, "fr", e.target.value)}
                      className="col-span-5 px-2 py-1.5 rounded border border-gray-200 text-sm"
                    />
                    <button onClick={() => removeVocab(si, vi)} className="col-span-1 text-red-400 hover:text-red-600 text-sm">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => addVocab(si)} className="mt-2 text-xs text-purple-600 hover:underline font-medium">
                + Ajouter un mot
              </button>
            </div>
          ))}

          <button
            onClick={addSection}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-purple-300 text-purple-600 font-bold text-sm hover:bg-purple-50"
          >
            + Ajouter une section de vocabulaire
          </button>

          {preview.quiz.length > 0 && (
            <div className="p-5 rounded-2xl border border-purple-200 bg-purple-50">
              <h4 className="font-bold text-purple-900 mb-3">🎯 Questions de quiz ({preview.quiz.length})</h4>
              <div className="space-y-3">
                {preview.quiz.map((q, qi) => (
                  <div key={qi} className="p-3 bg-white rounded-lg border border-purple-200">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <input
                        value={q.question}
                        onChange={(e) => updateQuiz(qi, "question", e.target.value)}
                        className="flex-1 font-medium text-sm border-b border-transparent hover:border-gray-300 focus:border-purple-500 outline-none"
                      />
                      <button onClick={() => removeQuiz(qi)} className="text-red-400 hover:text-red-600 text-sm">
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className={`flex items-center gap-1.5 p-1.5 rounded cursor-pointer ${
                            q.answer === oi ? "bg-green-100 border border-green-400" : "bg-gray-50"
                          }`}
                        >
                          <input
                            type="radio"
                            checked={q.answer === oi}
                            onChange={() => updateQuiz(qi, "answer", oi)}
                            className="accent-green-600"
                          />
                          <input
                            value={opt}
                            onChange={(e) => {
                              const next = JSON.parse(JSON.stringify(preview));
                              next.quiz[qi].options[oi] = e.target.value;
                              setPreview(next);
                            }}
                            className="flex-1 bg-transparent border-none outline-none text-xs"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="sticky bottom-4 flex flex-wrap gap-2 p-3 rounded-2xl bg-white shadow-2xl border-2 border-purple-300">
            <button onClick={reset} className="px-5 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200">
              ← Recommencer
            </button>
            <button onClick={exportJSON} className="px-5 py-3 rounded-xl bg-white border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50">
              💾 Export JSON
            </button>
            <button onClick={generate} className="px-5 py-3 rounded-xl bg-white border-2 border-purple-300 text-purple-700 font-bold hover:bg-purple-50">
              🔄 Régénérer
            </button>
            <button
              onClick={publish}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-base hover:from-green-600 hover:to-emerald-700 shadow-lg"
            >
              ✅ Publier dans le catalogue
            </button>
          </div>
        </>
      )}

      {/* ====================== ÉTAPE 4 : BATCH PREVIEW ====================== */}
      {step === "batch-preview" && (
        <div className="p-5 rounded-2xl border border-gray-200 bg-white">
          <h4 className="font-bold text-gray-900 mb-3">📦 {batchPreviews.length} leçon(s) générée(s)</h4>

          {batchErrors.length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-800">
              <b>⚠️ {batchErrors.length} fichier(s) ignoré(s) :</b>
              <ul className="mt-1 ml-4 list-disc">
                {batchErrors.map((e, i) => (
                  <li key={i}>
                    <b>{e.file}</b> — {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-auto">
            {batchPreviews.map((p, i) => (
              <div key={i} className="p-3 rounded-lg border border-gray-200 text-sm">
                <div className="font-bold">
                  {p.lesson.titre} · {p.lesson.zh} ({p.lesson.pinyin})
                </div>
                <div className="text-xs text-gray-500">
                  {p.sections.reduce((a, s) => a + s.vocab.length, 0)} mots · {p.quiz.length} quiz
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={reset} className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold">
              ← Recommencer
            </button>
            <button
              onClick={publishBatch}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg"
            >
              ✅ Publier les {batchPreviews.length} leçons
            </button>
          </div>
        </div>
      )}

      {/* ====================== ÉTAPE 5 : PUBLIÉ ====================== */}
      {step === "published" && (
        <div className="p-10 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Leçon(s) publiée(s) !</h3>
          <p className="text-gray-600 mb-5 max-w-md mx-auto">
            <b>{preview?.lesson.titre || `${batchPreviews.length} leçons`}</b> ajoutée(s) au catalogue.
            <br />
            <span className="text-sm text-gray-500">Recharge l'app pour les voir dans le parcours, les fiches et les jeux.</span>
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={reset}
              className="px-6 py-3 rounded-xl bg-white border-2 border-green-400 text-green-700 font-bold hover:bg-green-50"
            >
              ➕ Créer une autre leçon
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow"
            >
              🔄 Recharger maintenant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
