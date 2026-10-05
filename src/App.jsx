import React, { useState, useMemo, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Studio from "./Studio.jsx";
import Landing from "./Landing.jsx";
import Onboarding from "./Onboarding.jsx";
import AuthScreen from "./AuthScreen.jsx";
import AdminPanel from "./AdminPanel.jsx";
import {
  supabase,
  getCurrentUser,
  signOut,
  syncProgressToCloud,
  loadProgressFromCloud,
  saveDonationToCloud,
} from "./supabase.js";

// ============================== FALLBACK GEMINI AUTOMATIQUE ==============================
const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-flash-latest",
];

async function callGeminiWithFallback(body, apiKey, isJSON = true) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      console.log(`🤖 App : tentative avec ${model}…`);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
          encodeURIComponent(apiKey),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (data.error) {
        console.warn(`⚠️ ${model} échoué :`, data.error.message);
        lastError = new Error(data.error.message || "erreur API");
        continue;
      }
      const parts = (((data.candidates || [])[0] || {}).content || {}).parts;
      if (!parts || !parts[0] || !parts[0].text) {
        lastError = new Error("réponse vide");
        continue;
      }
      console.log(`✅ App : réponse reçue de ${model}`);
      let txt = parts[0].text.trim();
      if (isJSON) {
        txt = txt.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
        const s = txt.indexOf("{");
        const e = txt.lastIndexOf("}");
        if (s >= 0 && e > s) txt = txt.slice(s, e + 1);
        return JSON.parse(txt);
      }
      return txt;
    } catch (e) {
      console.warn(`⚠️ ${model} erreur :`, e.message);
      lastError = e;
    }
  }
  throw lastError || new Error("Tous les modèles Gemini sont indisponibles");
}

// ============================== DONNÉES DES COURS ==============================

const LESSONS = [
  {
    id: 1,
    titre: "Leçon 1",
    zh: "你好",
    pinyin: "Nǐ hǎo",
    fr: "Bonjour !",
    sections: [
      {
        titre: "Salutations",
        vocab: [
          { hanzi: "你好", pinyin: "nǐ hǎo", fr: "Bonjour" },
          { hanzi: "您好", pinyin: "nín hǎo", fr: "Bonjour (poli, marque de respect)" },
          { hanzi: "你们好", pinyin: "nǐmen hǎo", fr: "Bonjour à tous" },
          { hanzi: "老师好", pinyin: "lǎoshī hǎo", fr: "Bonjour professeur" },
          { hanzi: "同学们好", pinyin: "tóngxuémen hǎo", fr: "Bonjour les étudiants" },
          { hanzi: "对不起", pinyin: "duìbuqǐ", fr: "Désolé" },
          { hanzi: "没关系", pinyin: "méiguānxi", fr: "Ce n'est pas grave" },
        ],
      },
      {
        titre: "Se présenter",
        vocab: [
          { hanzi: "我是……", pinyin: "wǒ shì...", fr: "Je suis..." },
          { hanzi: "你 / 您", pinyin: "nǐ / nín", fr: "tu / vous (poli)" },
          { hanzi: "他 / 她", pinyin: "tā / tā", fr: "il / elle" },
          { hanzi: "我们", pinyin: "wǒmen", fr: "nous" },
          { hanzi: "你们", pinyin: "nǐmen", fr: "vous (pluriel)" },
          { hanzi: "他们 / 她们", pinyin: "tāmen", fr: "ils / elles" },
        ],
      },
      {
        titre: "La famille 👨‍👩‍👧‍👦",
        vocab: [
          { hanzi: "爸爸", pinyin: "bàba", fr: "père" },
          { hanzi: "妈妈", pinyin: "māma", fr: "mère" },
          { hanzi: "哥哥", pinyin: "gēge", fr: "grand frère" },
          { hanzi: "弟弟", pinyin: "dìdi", fr: "petit frère" },
          { hanzi: "姐姐", pinyin: "jiějie", fr: "grande sœur" },
          { hanzi: "妹妹", pinyin: "mèimei", fr: "petite sœur" },
          { hanzi: "爷爷", pinyin: "yéye", fr: "grand-père" },
          { hanzi: "奶奶", pinyin: "nǎinai", fr: "grand-mère" },
          { hanzi: "婆婆", pinyin: "pópo", fr: "belle-mère / grand-mère" },
        ],
      },
      {
        titre: "Boire & aimer 🥤",
        vocab: [
          { hanzi: "喝", pinyin: "hē", fr: "boire" },
          { hanzi: "咖啡", pinyin: "kāfēi", fr: "café" },
          { hanzi: "可乐", pinyin: "kělè", fr: "cola" },
          { hanzi: "水", pinyin: "shuǐ", fr: "eau" },
          { hanzi: "茶", pinyin: "chá", fr: "thé" },
          { hanzi: "啤酒", pinyin: "píjiǔ", fr: "bière" },
          { hanzi: "我爱喝……", pinyin: "Wǒ ài hē...", fr: "J'aime boire..." },
          { hanzi: "你呢？", pinyin: "nǐ ne?", fr: "Et toi ?" },
        ],
      },
      {
        titre: "Nombres 0–10",
        vocab: [
          { hanzi: "零", pinyin: "líng", fr: "0 — zéro" },
          { hanzi: "一", pinyin: "yī", fr: "1 — un" },
          { hanzi: "二", pinyin: "èr", fr: "2 — deux" },
          { hanzi: "三", pinyin: "sān", fr: "3 — trois" },
          { hanzi: "四", pinyin: "sì", fr: "4 — quatre" },
          { hanzi: "五", pinyin: "wǔ", fr: "5 — cinq" },
          { hanzi: "六", pinyin: "liù", fr: "6 — six" },
          { hanzi: "七", pinyin: "qī", fr: "7 — sept" },
          { hanzi: "八", pinyin: "bā", fr: "8 — huit" },
          { hanzi: "九", pinyin: "jiǔ", fr: "9 — neuf" },
          { hanzi: "十", pinyin: "shí", fr: "10 — dix" },
        ],
      },
    ],
    phrases: [
      { zh: "你好，我是戴李敏。", pinyin: "Nǐ hǎo, wǒ shì Dài Lǐmǐn.", fr: "Bonjour, je suis DAI Limin." },
      { zh: "我爱喝咖啡。", pinyin: "Wǒ ài hē kāfēi.", fr: "J'aime boire du café." },
      { zh: "下课！谢谢大家！", pinyin: "Xiàkè! Xièxie dàjiā!", fr: "La classe est terminée. Merci à tous !" },
    ],
    pinyinNotes: [
      "Une syllabe = initiale + finale + ton (ex. nǐ = n + i + 3e ton).",
      "Initiales : b p m f · d t n l · g k h · j q x.",
      "Finales simples : a o e i u ü er.",
      "4 tons : ā (plat, comme « la » en musique) · á (interrogateur, « hein ? ») · ǎ (voix abaissée) · à (sec, « zut ! »).",
      "Règle du 3e ton : 3e ton + 3e ton → on prononce 2e ton + 3e ton (nǐ hǎo → ní hǎo). On écrit nǐ hǎo mais on le dit ní hǎo !",
      "Les mois : chiffre + 月 yuè (一月 janvier ... 十二月 décembre).",
    ],
    caracteres: [
      "Traits de base : 横 héng (horizontal), 竖 shù (vertical), 撇 piě (chute à gauche), 捺 nà (chute à droite), 点 diǎn (point).",
      "Caractères vus : 一 (un), 二 (deux), 三 (trois), 十 (dix), 八 (huit), 人 (personne), 大 (grand), 天 (ciel), 不 (ne...pas), 六 (six).",
    ],
  },
  {
    id: 2,
    titre: "Leçon 2",
    zh: "谢谢你",
    pinyin: "Xièxie nǐ",
    fr: "Merci !",
    sections: [
      {
        titre: "Politesse 🙏",
        vocab: [
          { hanzi: "谢谢", pinyin: "xièxie", fr: "Merci" },
          { hanzi: "谢谢你", pinyin: "xièxie nǐ", fr: "Merci à toi" },
          { hanzi: "不客气", pinyin: "bú kèqi", fr: "Je t'en prie" },
          { hanzi: "不谢", pinyin: "bú xiè", fr: "Pas besoin de remercier" },
          { hanzi: "再见", pinyin: "zàijiàn", fr: "Au revoir" },
          { hanzi: "明天见", pinyin: "míngtiān jiàn", fr: "À demain" },
          { hanzi: "星期一见", pinyin: "xīngqī yī jiàn", fr: "À lundi" },
        ],
      },
      {
        titre: "La semaine 📅",
        vocab: [
          { hanzi: "星期一", pinyin: "xīngqī yī", fr: "lundi" },
          { hanzi: "星期二", pinyin: "xīngqī èr", fr: "mardi" },
          { hanzi: "星期三", pinyin: "xīngqī sān", fr: "mercredi" },
          { hanzi: "星期四", pinyin: "xīngqī sì", fr: "jeudi" },
          { hanzi: "星期五", pinyin: "xīngqī wǔ", fr: "vendredi" },
          { hanzi: "星期六", pinyin: "xīngqī liù", fr: "samedi" },
          { hanzi: "星期日 / 星期天", pinyin: "xīngqī rì / tiān", fr: "dimanche" },
        ],
      },
      {
        titre: "Poser des questions ❓",
        vocab: [
          { hanzi: "这", pinyin: "zhè", fr: "ceci" },
          { hanzi: "这是……", pinyin: "Zhè shì...", fr: "C'est..." },
          { hanzi: "这是什么？", pinyin: "Zhè shì shénme?", fr: "Qu'est-ce que c'est ?" },
          { hanzi: "什么", pinyin: "shénme", fr: "quoi / quel" },
          { hanzi: "怎么读？", pinyin: "Zěnme dú?", fr: "Comment lire / prononcer ?" },
        ],
      },
      {
        titre: "Nationalité & métier 🌍",
        vocab: [
          { hanzi: "中国", pinyin: "Zhōngguó", fr: "Chine" },
          { hanzi: "科特迪瓦", pinyin: "Kētèdíwǎ", fr: "Côte d'Ivoire" },
          { hanzi: "我是中国人。", pinyin: "Wǒ shì Zhōngguó rén.", fr: "Je suis chinois." },
          { hanzi: "我是科特迪瓦人。", pinyin: "Wǒ shì Kētèdíwǎ rén.", fr: "Je suis ivoirien." },
          { hanzi: "老师", pinyin: "lǎoshī", fr: "professeur" },
          { hanzi: "学生", pinyin: "xuésheng", fr: "étudiant(e)" },
        ],
      },
      {
        titre: "Nombres 11–99",
        vocab: [
          { hanzi: "十一", pinyin: "shíyī", fr: "11 — onze" },
          { hanzi: "十二", pinyin: "shí'èr", fr: "12 — douze" },
          { hanzi: "二十", pinyin: "èrshí", fr: "20 — vingt" },
          { hanzi: "三十三", pinyin: "sānshí sān", fr: "33 — trente-trois" },
          { hanzi: "四十", pinyin: "sìshí", fr: "40 — quarante" },
        ],
      },
      {
        titre: "Couleurs 🎨",
        vocab: [
          { hanzi: "红色", pinyin: "hóngsè", fr: "rouge" },
          { hanzi: "黄色", pinyin: "huángsè", fr: "jaune" },
          { hanzi: "白色", pinyin: "báisè", fr: "blanc" },
          { hanzi: "绿色", pinyin: "lǜsè", fr: "vert" },
          { hanzi: "橘色", pinyin: "júsè", fr: "orange" },
        ],
      },
    ],
    phrases: [
      { zh: "谢谢！—— 不客气！", pinyin: "Xièxie! — Bú kèqi!", fr: "Merci ! — Je t'en prie !" },
      { zh: "再见！—— 再见！", pinyin: "Zàijiàn! — Zàijiàn!", fr: "Au revoir ! — Au revoir !" },
      { zh: "现在上课。", pinyin: "Xiànzài shàngkè.", fr: "On commence le cours." },
    ],
    pinyinNotes: [
      "Nouvelles initiales : z c s (« dzé, tsé, cé ») et zh ch sh r (« dj, tcheu, cheu, je »).",
      "Finales nasales : an ian uan üan · en uen(un) in ün · ang iang uang · eng ueng ing ong iong.",
      "Abréviations : iou→iu, uei→ui, uen→un (ex. niú, shuǐ, Lúndūn).",
      "Le ton se marque sur la voyelle prononcée bouche la plus ouverte : a > o > e > i > u > ü (exception : iu → sur le u).",
      "Ton neutre : court et léger, non marqué (妈妈 māma, 谢谢 xièxie, 名字 míngzi).",
      "Modulation de 不 : bù devient bú devant un 4e ton (bú shì, bú kèqi, bú xiè).",
    ],
    caracteres: [
      "Nouveaux traits : 横折 héngzhé (rotation horizontale), 竖折 shùzhé, 竖钩 shùgōu (crochet vertical).",
      "Caractères vus : 口 (bouche), 山 (montagne), 小 (petit), 不 (ne...pas), 八 (huit), 人 (personne).",
    ],
  },
  {
    id: 3,
    titre: "Leçon 3",
    zh: "你叫什么名字？",
    pinyin: "Nǐ jiào shénme míngzi?",
    fr: "Comment t'appelles-tu ?",
    sections: [
      {
        titre: "Demander le nom 🙋",
        vocab: [
          { hanzi: "叫", pinyin: "jiào", fr: "s'appeler / appeler" },
          { hanzi: "名字", pinyin: "míngzi", fr: "nom" },
          { hanzi: "什么", pinyin: "shénme", fr: "quoi / quel" },
          { hanzi: "你叫什么名字？", pinyin: "Nǐ jiào shénme míngzi?", fr: "Comment t'appelles-tu ?" },
          { hanzi: "我叫……", pinyin: "Wǒ jiào...", fr: "Je m'appelle..." },
          { hanzi: "他/她叫……", pinyin: "Tā jiào...", fr: "Il / Elle s'appelle..." },
        ],
      },
      {
        titre: "Nom de famille",
        vocab: [
          { hanzi: "姓", pinyin: "xìng", fr: "nom de famille" },
          { hanzi: "你姓什么？", pinyin: "Nǐ xìng shénme?", fr: "Quel est ton nom de famille ?" },
          { hanzi: "您贵姓？", pinyin: "Nín guìxìng?", fr: "Votre nom, s'il vous plaît ? (très poli)" },
          { hanzi: "我姓……", pinyin: "Wǒ xìng...", fr: "Mon nom de famille est..." },
          { hanzi: "姓名", pinyin: "xìngmíng", fr: "nom complet (écrit)" },
        ],
      },
      {
        titre: "Être & demander l'identité",
        vocab: [
          { hanzi: "是", pinyin: "shì", fr: "être" },
          { hanzi: "你是学生吗？", pinyin: "Nǐ shì xuésheng ma?", fr: "Es-tu étudiant ?" },
          { hanzi: "我不是学生，我是老师。", pinyin: "Wǒ bú shì xuésheng, wǒ shì lǎoshī.", fr: "Je ne suis pas étudiant, je suis professeur." },
          { hanzi: "笔", pinyin: "bǐ", fr: "stylo" },
          { hanzi: "书", pinyin: "shū", fr: "livre" },
          { hanzi: "汉语书", pinyin: "Hànyǔ shū", fr: "livre de chinois" },
        ],
      },
    ],
    phrases: [
      { zh: "你叫什么名字？—— 我叫李月。", pinyin: "Nǐ jiào shénme míngzi? — Wǒ jiào Lǐ Yuè.", fr: "Comment t'appelles-tu ? — Je m'appelle Li Yue." },
      { zh: "大家好！我叫……我是科特迪瓦人。", pinyin: "Dàjiā hǎo! Wǒ jiào... Wǒ shì Kētèdíwǎ rén.", fr: "Bonjour à tous ! Je m'appelle... Je suis ivoirien." },
    ],
    pinyinNotes: [
      "Aspiration : b/p, d/t, g/k, j/q, z/c, zh/ch — le premier est non aspiré, le second aspiré (expiré).",
      "Après j, q, x : le ü perd son tréma → ju, qu, xu (jǐ, qù, xuě). Le tréma reste après n et l : nǚ, lǜ.",
      "j q x ne se combinent jamais avec u ni les finales en u-.",
      "Structure de phrase : Sujet + Verbe + Objet (你叫什么名字？).",
    ],
    caracteres: [
      "Révision : 一二三十人八大小不天山口.",
      "Astuce du cours : pour un nom chinois, on choisit nom de famille + prénom selon la phonétique du nom français et une bonne signification (ex. 姚智杰 Yáo Zhìjié).",
    ],
  },
  {
    id: 4,
    titre: "Leçon 4",
    zh: "她是我的汉语老师。",
    pinyin: "Tā shì wǒ de hànyǔ lǎoshī.",
    fr: "C'est mon professeur de chinois.",
    sections: [
      {
        titre: "Le possessif 的",
        vocab: [
          { hanzi: "的", pinyin: "de", fr: "particule possessive (ton neutre)" },
          { hanzi: "我的", pinyin: "wǒ de", fr: "mon / ma / mes" },
          { hanzi: "你的", pinyin: "nǐ de", fr: "ton / ta / tes" },
          { hanzi: "他的 / 她的", pinyin: "tā de", fr: "son / sa / ses" },
          { hanzi: "我们的", pinyin: "wǒmen de", fr: "notre / nos" },
          { hanzi: "你们的", pinyin: "nǐmen de", fr: "votre / vos" },
          { hanzi: "他们的 / 她们的", pinyin: "tāmen de", fr: "leur / leurs" },
        ],
      },
      {
        titre: "Demander qui 🤔",
        vocab: [
          { hanzi: "谁", pinyin: "shéi", fr: "qui" },
          { hanzi: "你是谁？", pinyin: "Nǐ shì shéi?", fr: "Qui es-tu ?" },
          { hanzi: "她是谁？", pinyin: "Tā shì shéi?", fr: "Qui est-elle ?" },
          { hanzi: "谁是李月？", pinyin: "Shéi shì Lǐ Yuè?", fr: "Qui est Li Yue ?" },
          { hanzi: "哪", pinyin: "nǎ", fr: "quel / laquelle" },
          { hanzi: "汉语", pinyin: "Hànyǔ", fr: "le chinois (langue)" },
          { hanzi: "汉语老师", pinyin: "hànyǔ lǎoshī", fr: "professeur de chinois" },
        ],
      },
      {
        titre: "Relations proches (exception)",
        vocab: [
          { hanzi: "同学", pinyin: "tóngxué", fr: "camarade de classe" },
          { hanzi: "朋友", pinyin: "péngyou", fr: "ami" },
          { hanzi: "我同学", pinyin: "wǒ tóngxué", fr: "mon camarade (的 non utilisé)" },
          { hanzi: "你朋友", pinyin: "nǐ péngyou", fr: "ton ami (的 non utilisé)" },
        ],
      },
      {
        titre: "Pays 🌐",
        vocab: [
          { hanzi: "国", pinyin: "guó", fr: "pays" },
          { hanzi: "中国", pinyin: "Zhōngguó", fr: "Chine" },
          { hanzi: "美国", pinyin: "Měiguó", fr: "États-Unis" },
          { hanzi: "法国", pinyin: "Fǎguó", fr: "France" },
          { hanzi: "英国", pinyin: "Yīngguó", fr: "Royaume-Uni" },
          { hanzi: "德国", pinyin: "Déguó", fr: "Allemagne" },
          { hanzi: "韩国", pinyin: "Hánguó", fr: "Corée du Sud" },
          { hanzi: "泰国", pinyin: "Tàiguó", fr: "Thaïlande" },
          { hanzi: "日本", pinyin: "Rìběn", fr: "Japon" },
          { hanzi: "科特迪瓦", pinyin: "Kētèdíwǎ", fr: "Côte d'Ivoire" },
          { hanzi: "贝宁", pinyin: "Bèiníng", fr: "Bénin" },
          { hanzi: "喀麦隆", pinyin: "Kāmàilóng", fr: "Cameroun" },
          { hanzi: "马里", pinyin: "Mǎlǐ", fr: "Mali" },
          { hanzi: "加纳", pinyin: "Jiānà", fr: "Ghana" },
          { hanzi: "多哥", pinyin: "Duōgē", fr: "Togo" },
        ],
      },
      {
        titre: "Nationalité & objets 🎒",
        vocab: [
          { hanzi: "你是哪国人？", pinyin: "Nǐ shì nǎ guó rén?", fr: "De quelle nationalité es-tu ?" },
          { hanzi: "请问", pinyin: "qǐngwèn", fr: "excusez-moi / s'il vous plaît (très poli)" },
          { hanzi: "书", pinyin: "shū", fr: "livre" },
          { hanzi: "笔", pinyin: "bǐ", fr: "stylo" },
          { hanzi: "手机", pinyin: "shǒujī", fr: "téléphone" },
          { hanzi: "本子", pinyin: "běnzi", fr: "cahier" },
          { hanzi: "这是谁的书？", pinyin: "Zhè shì shéi de shū?", fr: "À qui est ce livre ?" },
          { hanzi: "这是我的手机。", pinyin: "Zhè shì wǒ de shǒujī.", fr: "C'est mon téléphone." },
        ],
      },
      {
        titre: "Relations & politesse 🤝",
        vocab: [
          { hanzi: "同学", pinyin: "tóngxué", fr: "camarade de classe" },
          { hanzi: "朋友", pinyin: "péngyou", fr: "ami" },
          { hanzi: "好朋友", pinyin: "hǎo péngyou", fr: "bons amis" },
          { hanzi: "男朋友", pinyin: "nán péngyou", fr: "petit ami" },
          { hanzi: "女朋友", pinyin: "nǚ péngyou", fr: "petite amie" },
          { hanzi: "也", pinyin: "yě", fr: "aussi (toujours devant le verbe)" },
          { hanzi: "他也是科特迪瓦人。", pinyin: "Tā yě shì Kētèdíwǎ rén.", fr: "Il est aussi ivoirien." },
          { hanzi: "很高兴认识你！", pinyin: "Hěn gāoxìng rènshi nǐ!", fr: "Ravi de faire ta connaissance !" },
        ],
      },
    ],
    phrases: [
      { zh: "她是谁？—— 她是我的汉语老师，她叫李月。", pinyin: "Tā shì shéi? — Tā shì wǒ de hànyǔ lǎoshī, tā jiào Lǐ Yuè.", fr: "Qui est-elle ? — Elle est mon professeur de chinois, elle s'appelle Li Yue." },
      { zh: "这是我的书。", pinyin: "Zhè shì wǒ de shū.", fr: "C'est mon livre." },
      { zh: "请问，你是哪国人？—— 我是美国人，你呢？—— 我是中国人。", pinyin: "Qǐngwèn, nǐ shì nǎ guó rén? — Wǒ shì Měiguó rén, nǐ ne? — Wǒ shì Zhōngguó rén.", fr: "Excuse-moi, tu es de quel pays ? — Je suis américain, et toi ? — Je suis chinois." },
    ],
    pinyinNotes: [
      "Orthographe avec y et w : i→yi (yī, yīn, yīng) · ia/ie/ian→ya/ye/yan · u→wu · ua/uan→wa/wan · ü→yu (yu, yue, yuan).",
      "Discrimination zh / ch / sh / r : zhīdào (savoir), chídào (être en retard), shuōhuà (parler), rè (chaud).",
      "的 se place entre le possesseur et le possédé : 我 + 的 + 书 = mon livre.",
      "Avec un proche (famille, 同学, 朋友), 的 peut être omis : 我(的)妈妈, 我(的)同学.",
      "Nationalité : pays + 人 = 中国人, 科特迪瓦人. Question : 你是哪国人 ？",
    ],
    caracteres: [
      "Nouveaux traits : 横折钩 héngzhégōu (门 mén, 月 yuè) · 卧钩 wògōu (心 xīn, 您 nín).",
      "Caractères vus : 月 (lune), 心 (cœur), 中 (milieu), 人 (personne).",
    ],
  },
  {
    id: 5,
    titre: "Leçon 5",
    zh: "她女儿今年二十岁。",
    pinyin: "Tā nǚ'ér jīnnián èrshí suì.",
    fr: "Sa fille a vingt ans cette année.",
    sections: [
      {
        titre: "Famille & maison 🏠",
        vocab: [
          { hanzi: "家", pinyin: "jiā", fr: "famille ; maison" },
          { hanzi: "家人", pinyin: "jiārén", fr: "membre de la famille" },
          { hanzi: "这是我的家人。", pinyin: "Zhè shì wǒ jiārén.", fr: "Voici ma famille." },
          { hanzi: "女儿", pinyin: "nǚ'ér", fr: "fille" },
          { hanzi: "孩子", pinyin: "háizi", fr: "enfant" },
          { hanzi: "今年", pinyin: "jīnnián", fr: "cette année" },
          { hanzi: "岁", pinyin: "suì", fr: "ans (âge)" },
        ],
      },
      {
        titre: "Avoir & ne pas avoir 💰",
        vocab: [
          { hanzi: "有", pinyin: "yǒu", fr: "avoir" },
          { hanzi: "没有", pinyin: "méiyǒu", fr: "ne pas avoir" },
          { hanzi: "你有哥哥吗？", pinyin: "Nǐ yǒu gēge ma?", fr: "As-tu un grand frère ?" },
          { hanzi: "我没有哥哥。", pinyin: "Wǒ méiyǒu gēge.", fr: "Je n'ai pas de grand frère." },
          { hanzi: "钱", pinyin: "qián", fr: "argent" },
          { hanzi: "我没有钱。", pinyin: "Wǒ méiyǒu qián.", fr: "Je n'ai pas d'argent." },
          { hanzi: "知道", pinyin: "zhīdào", fr: "savoir" },
          { hanzi: "我不知道。", pinyin: "Wǒ bù zhīdào.", fr: "Je ne sais pas." },
        ],
      },
      {
        titre: "Les classificateurs 🔢",
        vocab: [
          { hanzi: "口", pinyin: "kǒu", fr: "classificateur : personnes de la famille" },
          { hanzi: "个", pinyin: "gè", fr: "classificateur : personnes en général" },
          { hanzi: "本", pinyin: "běn", fr: "classificateur : livres, cahiers" },
          { hanzi: "我家有三口人。", pinyin: "Wǒ jiā yǒu sān kǒu rén.", fr: "Il y a trois personnes dans ma famille." },
          { hanzi: "两本书", pinyin: "liǎng běn shū", fr: "deux livres" },
          { hanzi: "一个汉语老师", pinyin: "yí gè Hànyǔ lǎoshī", fr: "un professeur de chinois" },
        ],
      },
      {
        titre: "两 ou 二 ? 2️⃣",
        vocab: [
          { hanzi: "两", pinyin: "liǎng", fr: "deux (quantité : 两个孩子)" },
          { hanzi: "二", pinyin: "èr", fr: "deux (compter : 2, 12, 22…)" },
          { hanzi: "她有两个哥哥。", pinyin: "Tā yǒu liǎng gè gēge.", fr: "Elle a deux grands frères." },
        ],
      },
      {
        titre: "Combien ? ❓",
        vocab: [
          { hanzi: "几", pinyin: "jǐ", fr: "combien (quantité de 0 à 10)" },
          { hanzi: "你家有几口人？", pinyin: "Nǐ jiā yǒu jǐ kǒu rén?", fr: "Combien de personnes dans ta famille ?" },
          { hanzi: "你有几个汉语老师？", pinyin: "Nǐ yǒu jǐ gè Hànyǔ lǎoshī?", fr: "Combien de professeurs de chinois as-tu ?" },
        ],
      },
    ],
    phrases: [
      { zh: "我家有四口人，爸爸、妈妈、妹妹和我。", pinyin: "Wǒ jiā yǒu sì kǒu rén, bàba, māma, mèimei hé wǒ.", fr: "Ma famille a quatre personnes : papa, maman, ma petite sœur et moi." },
      { zh: "她有两个哥哥，你呢？—— 我没有哥哥。", pinyin: "Tā yǒu liǎng gè gēge, nǐ ne? — Wǒ méiyǒu gēge.", fr: "Elle a deux grands frères, et toi ? — Je n'ai pas de grand frère." },
      { zh: "我女儿今年二十岁。", pinyin: "Wǒ nǚ'ér jīnnián èrshí suì.", fr: "Ma fille a vingt ans cette année." },
    ],
    pinyinNotes: [
      "Nombres 0–100 : on combine — 二十 èrshí (20), 三十三 sānshí sān (33), 九十九 jiǔshí jiǔ (99).",
      "Suffixe rétroflexe : er s'attache à la syllabe précédente — 哪儿 nǎr (où), 小孩儿 xiǎoháir (enfant), 饭馆儿 fànguǎnr (restaurant). À l'écrit on ajoute 儿.",
      "Marque de division : quand une syllabe commence par a, o ou e, on écrit l'apostrophe ' — pí'ǎo (veste), jī'è (faim), Xī'ān (Xi'an).",
      "有 yǒu (avoir) se nie avec 没有 : 我没有笔 Wǒ méiyǒu bǐ (je n'ai pas de stylo).",
      "也 yě (aussi) se place toujours devant le verbe : 他也是学生 Tā yě shì xuésheng.",
    ],
    caracteres: [
      "Nouveaux traits : 竖弯钩 shùwāngōu (七 qī, 儿 ér) · 横折弯钩 héngzhéwāngōu (九 jiǔ, 几 jǐ).",
      "Caractères vus : 七 (sept), 儿 (fils / suffixe rétroflexe), 九 (neuf), 几 (combien), 国 (pays).",
    ],
  },
];

// ============================== QUIZ ==============================
const QUIZ = [
  { lesson: 1, type: "Traduction", question: "Comment dit-on « Bonjour » en chinois ?", options: ["你好 nǐ hǎo", "谢谢 xièxie", "再见 zàijiàn", "对不起 duìbuqǐ"], answer: 0, explication: "你好 nǐ hǎo = littéralement « toi bien »." },
  { lesson: 1, type: "Vocabulaire", question: "Que signifie 爸爸 bàba ?", options: ["père", "mère", "grand frère", "grand-père"], answer: 0 },
  { lesson: 1, type: "Vocabulaire", question: "Que signifie 姐姐 jiějie ?", options: ["grande sœur", "petite sœur", "mère", "belle-mère"], answer: 0 },
  { lesson: 1, type: "Vocabulaire", question: "Comment dit-on « petit frère » ?", options: ["弟弟 dìdi", "哥哥 gēge", "妹妹 mèimei", "爷爷 yéye"], answer: 0 },
  { lesson: 1, type: "Vocabulaire", question: "喝 hē kāfēi signifie…", options: ["boire du café", "boire du cola", "boire du thé", "boire de l'eau"], answer: 0 },
  { lesson: 1, type: "Nombres", question: "Quelle est la valeur de 六 ？", options: ["6", "9", "4", "8"], answer: 0 },
  { lesson: 1, type: "Nombres", question: "Comment s'écrit « 10 » en caractères ?", options: ["十", "一", "九", "百"], answer: 0 },
  { lesson: 1, type: "Nombres", question: "零 líng = ?", options: ["0", "1", "10", "7"], answer: 0 },
  { lesson: 1, type: "Politesse", question: "On répond « ce n'est pas grave » à « désolé » par…", options: ["没关系 méiguānxi", "不客气 búkèqi", "你好 nǐ hǎo", "再见 zàijiàn"], answer: 0 },
  { lesson: 1, type: "Pinyin", question: "Comment dit-on « Bonjour professeur » ?", options: ["老师好 lǎoshī hǎo", "同学们好 tóngxuémen hǎo", "您好 nín hǎo", "你们好 nǐmen hǎo"], answer: 0 },
  { lesson: 1, type: "Tons", question: "Combien de tons de base existe-t-il en mandarin ?", options: ["4 (+ le ton neutre)", "3", "5 seulement", "2"], answer: 0 },
  { lesson: 1, type: "Tons", question: "nǐ hǎo s'écrit avec deux 3e tons. Comment le prononce-t-on ?", options: ["ní hǎo (2e ton + 3e ton)", "nì hào", "nī hǎo", "on ne change rien"], answer: 0 },
  { lesson: 1, type: "Pinyin", question: "Dans la syllabe 好 hǎo, quelle est la finale ?", options: ["ao", "h", "a", "o + h"], answer: 0 },
  { lesson: 1, type: "Vocabulaire", question: "« Et toi ? » se dit…", options: ["你呢？ nǐ ne?", "你好 nǐ hǎo", "什么 shénme", "再见 zàijiàn"], answer: 0 },
  { lesson: 2, type: "Politesse", question: "Que répond-on à 谢谢 xièxie (merci) ?", options: ["不客气 bú kèqi", "没关系 méiguānxi", "你好 nǐ hǎo", "对不起 duìbuqǐ"], answer: 0 },
  { lesson: 2, type: "Vocabulaire", question: "再见 zàijiàn signifie…", options: ["au revoir", "à demain", "merci", "bonjour"], answer: 0 },
  { lesson: 2, type: "Vocabulaire", question: "« À demain » se dit…", options: ["明天见 míngtiān jiàn", "星期一见 xīngqī yī jiàn", "再见 zàijiàn", "今天见 jīntiān jiàn"], answer: 0 },
  { lesson: 2, type: "Semaine", question: "星期三 xīngqī sān = ?", options: ["mercredi", "mardi", "jeudi", "samedi"], answer: 0 },
  { lesson: 2, type: "Semaine", question: "Comment dit-on « samedi » ?", options: ["星期六 xīngqī liù", "星期五 xīngqī wǔ", "星期日 xīngqī rì", "星期四 xīngqī sì"], answer: 0 },
  { lesson: 2, type: "Nombres", question: "Comment dit-on 11 ?", options: ["十一 shíyī", "二十 èrshí", "九 jiǔ", "十二 shí'èr"], answer: 0 },
  { lesson: 2, type: "Nombres", question: "三十 sānshí = ?", options: ["30", "13", "33", "300"], answer: 0 },
  { lesson: 2, type: "Questions", question: "« Qu'est-ce que c'est ? » se dit…", options: ["这是什么？ Zhè shì shénme?", "你是谁？ Nǐ shì shéi?", "怎么读？ Zěnme dú?", "你好吗？ Nǐ hǎo ma?"], answer: 0 },
  { lesson: 2, type: "Nationalité", question: "« Je suis ivoirien » se dit…", options: ["我是科特迪瓦人。", "我是中国人。", "我叫科特迪瓦。", "我是汉语。"], answer: 0 },
  { lesson: 2, type: "Pinyin", question: "Quelle est l'abréviation correcte de iou ?", options: ["iu (ex. niú)", "ui", "un", "iou reste entier"], answer: 0 },
  { lesson: 2, type: "Pinyin", question: "Sur quelle voyelle se marque le ton dans shuǐ (eau) ?", options: ["u (car uei → ui)", "i", "e", "sur les deux"], answer: 0 },
  { lesson: 2, type: "Tons", question: "Devant un 4e ton, 不 bù se prononce…", options: ["bú (2e ton), ex. bú shì", "bǔ (3e ton)", "bū (1er ton)", "il ne change jamais"], answer: 0 },
  { lesson: 2, type: "Tons", question: "Lequel de ces mots a un ton neutre (non marqué) ?", options: ["妈妈 māma", "咖啡 kāfēi", "你好 nǐ hǎo", "水 shuǐ"], answer: 0 },
  { lesson: 2, type: "Vocabulaire", question: "学生 xuésheng = ?", options: ["étudiant(e)", "professeur", "école", "camarade"], answer: 0 },
  { lesson: 3, type: "Grammaire", question: "Comment demande-t-on le nom de quelqu'un ?", options: ["你叫什么名字？", "你是谁？", "你姓什么？", "这是什么？"], answer: 0 },
  { lesson: 3, type: "Grammaire", question: "« Je m'appelle Edgar » se dit…", options: ["我叫 Edgar。", "我是 Edgar。", "我的 Edgar。", "Edgar 叫我。"], answer: 0 },
  { lesson: 3, type: "Grammaire", question: "Quelle est la structure de base d'une phrase chinoise ?", options: ["Sujet + Verbe + Objet", "Verbe + Sujet + Objet", "Sujet + Objet + Verbe", "peu importe"], answer: 0 },
  { lesson: 3, type: "Politesse", question: "您贵姓？ Nín guìxìng? est une façon…", options: ["très polie de demander le nom de famille", "de dire au revoir", "de remercier", "de s'excuser"], answer: 0 },
  { lesson: 3, type: "Pinyin", question: "Après j, q, x, le ü s'écrit…", options: ["sans tréma : ju, qu, xu", "toujours avec tréma", "avec un w", "il n'existe pas"], answer: 0 },
  { lesson: 3, type: "Pinyin", question: "Dans nǚ (féminin), le tréma est-il conservé après n ?", options: ["Oui, on garde le tréma après n et l", "Non, on l'enlève", "Oui mais seulement après l", "Le mot n'existe pas"], answer: 0 },
  { lesson: 3, type: "Vocabulaire", question: "名字 míngzi = ?", options: ["nom", "nom de famille", "prénom seulement", "nationalité"], answer: 0 },
  { lesson: 3, type: "Vocabulaire", question: "Quelle paire correspond à « non aspiré / aspiré » ?", options: ["b / p", "p / b", "m / n", "j / zh"], answer: 0 },
  { lesson: 3, type: "Grammaire", question: "笔 bǐ est…", options: ["un stylo", "un livre", "un tableau", "une chaise"], answer: 0 },
  { lesson: 3, type: "Tons", question: "汉语书 Hànyǔ shū signifie…", options: ["livre de chinois", "professeur de chinois", "langue chinoise", "école chinoise"], answer: 0 },
  { lesson: 4, type: "Grammaire", question: "Où se place 的 de dans une phrase possessive ?", options: ["Entre le possesseur et le possédé", "À la fin de la phrase", "Devant le possesseur", "N'importe où"], answer: 0 },
  { lesson: 4, type: "Grammaire", question: "« mon professeur de chinois » se dit…", options: ["我的汉语老师", "我老师汉语", "汉语我的老师", "老师我的汉语"], answer: 0 },
  { lesson: 4, type: "Grammaire", question: "Comment dit-on « Qui est-il ? »", options: ["他是谁？", "谁是他？", "他是哪？", "他什么？"], answer: 0 },
  { lesson: 4, type: "Grammaire", question: "« Qui est Li Yue ? » (accent sur l'identité) se dit…", options: ["谁是李月？", "李月是谁？", "李月什么？", "谁是名字？"], answer: 0 },
  { lesson: 4, type: "Grammaire", question: "« mon camarade de classe » se dit…", options: ["我同学 (sans 的)", "我的同学 obligatoire", "同学我", "的同学"], answer: 0 },
  { lesson: 4, type: "Vocabulaire", question: "汉语 Hànyǔ = ?", options: ["la langue chinoise", "un professeur chinois", "la Chine", "un livre"], answer: 0 },
  { lesson: 4, type: "Vocabulaire", question: "哪 nǎ sert à…", options: ["poser une question de choix (« quel »)", "demander l'identité (« qui »)", "demander une chose (« quoi »)", "saluer"], answer: 0 },
  { lesson: 4, type: "Pinyin", question: "Comment s'écrit la syllabe ü quand elle est seule ?", options: ["yu", "u", "ü reste ü", "wu"], answer: 0 },
  { lesson: 4, type: "Pinyin", question: "ue → s'écrit…", options: ["we (ex. wen)", "ue reste ue", "ve", "uei"], answer: 0 },
  { lesson: 4, type: "Vocabulaire", question: "美国 Měiguó = ?", options: ["États-Unis", "Chine", "Japon", "Corée du Sud"], answer: 0 },
  { lesson: 4, type: "Grammaire", question: "Comment rend-on « Es-tu étudiant ? » ?", options: ["你是学生吗？", "你是学生？没有。", "你是学生什么？", "学生是你吗？"], answer: 0 },
  { lesson: 4, type: "Caractères", question: "月 représente…", options: ["la lune", "le cœur", "la porte", "le milieu"], answer: 0 },
  { lesson: 4, type: "Caractères", question: "Quel caractère utilise le trait 卧钩 wògōu ?", options: ["心 xīn (cœur)", "山 shān (montagne)", "口 kǒu (bouche)", "十 shí (dix)"], answer: 0 },
  { lesson: 4, type: "Politesse", question: "请问 qǐngwèn signifie…", options: ["excusez-moi / s'il vous plaît", "au revoir", "merci", "je ne sais pas"], answer: 0 },
  { lesson: 4, type: "Grammaire", question: "« De quelle nationalité es-tu ? » se dit…", options: ["你是哪国人？", "你是谁？", "你叫什么名字？", "你有几个老师？"], answer: 0 },
  { lesson: 4, type: "Vocabulaire", question: "法国 Fǎguó = ?", options: ["France", "Royaume-Uni", "Allemagne", "Thaïlande"], answer: 0 },
  { lesson: 4, type: "Vocabulaire", question: "英国 Yīngguó = ?", options: ["Royaume-Uni", "États-Unis", "Japon", "Corée du Sud"], answer: 0 },
  { lesson: 4, type: "Vocabulaire", question: "男朋友 nán péngyou = ?", options: ["petit ami", "ami", "petite amie", "camarade"], answer: 0 },
  { lesson: 4, type: "Vocabulaire", question: "手机 shǒujī = ?", options: ["téléphone", "stylo", "cahier", "livre"], answer: 0 },
  { lesson: 4, type: "Grammaire", question: "Où se place 也 yě (aussi) ?", options: ["Devant le verbe", "Après le verbe", "En début de phrase", "N'importe où"], answer: 0 },
  { lesson: 4, type: "Grammaire", question: "« À qui est ce livre ? » se dit…", options: ["这是谁的书？", "这是什么书？", "谁的这是书？", "这是几本书？"], answer: 0 },
  { lesson: 4, type: "Politesse", question: "很高兴认识你 ！ signifie…", options: ["Ravi de faire ta connaissance !", "Au revoir, à demain !", "Excuse-moi !", "Merci beaucoup !"], answer: 0 },
  { lesson: 4, type: "Grammaire", question: "Devant un proche (妈妈， 同学， 朋友)， la particule 的…", options: ["peut être omise : 我妈妈", "est obligatoire", "se met devant le possesseur", "devient 得"], answer: 0 },
  { lesson: 5, type: "Vocabulaire", question: "家 jiā signifie…", options: ["famille ; maison", "argent", "école", "enfant"], answer: 0 },
  { lesson: 5, type: "Grammaire", question: "« J'ai un grand frère » se dit…", options: ["我有哥哥。", "我是哥哥。", "我叫哥哥。", "我的哥哥。"], answer: 0 },
  { lesson: 5, type: "Grammaire", question: "Comment nie-t-on 有 yǒu (avoir) ?", options: ["没有 méiyǒu", "不有 bù yǒu", "是有 shì yǒu", "没是 méi shì"], answer: 0 },
  { lesson: 5, type: "Grammaire", question: "Quel classificateur compte les personnes de la famille ?", options: ["口 kǒu", "个 gè", "本 běn", "岁 suì"], answer: 0 },
  { lesson: 5, type: "Grammaire", question: "Quel classificateur convient pour les livres ?", options: ["本 běn", "口 kǒu", "个 gè", "都一样"], answer: 0 },
  { lesson: 5, type: "Grammaire", question: "« deux enfants » se dit…", options: ["两个孩子", "二孩子", "两个口", "二个孩子"], answer: 0 },
  { lesson: 5, type: "Grammaire", question: "« Combien y a-t-il de personnes dans ta famille ? » se dit…", options: ["你家有几口人？", "你家有几个人？", "你是什么家？", "你家是谁？"], answer: 0 },
  { lesson: 5, type: "Vocabulaire", question: "几 jǐ sert à demander…", options: ["une quantité de 0 à 10", "l'identité d'une personne", "un prix en argent", "l'heure"], answer: 0 },
  { lesson: 5, type: "Vocabulaire", question: "女儿 nǚ'ér = ?", options: ["fille", "fils", "mère", "enfant"], answer: 0 },
  { lesson: 5, type: "Vocabulaire", question: "二十岁 èrshí suì = ?", options: ["vingt ans", "vingt personnes", "vingt livres", "vingt euros"], answer: 0 },
  { lesson: 5, type: "Pinyin", question: "哪儿 nǎr illustre…", options: ["le suffixe rétroflexe (er attaché)", "le ton neutre", "l'apostrophe de division", "l'abréviation iu"], answer: 0 },
  { lesson: 5, type: "Pinyin", question: "Dans pí'ǎo (veste), l'apostrophe sert à…", options: ["séparer deux syllabes quand la 2e commence par a, o ou e", "marquer un ton", "indiquer le pluriel", "allonger la voyelle"], answer: 0 },
  { lesson: 5, type: "Nombres", question: "九十九 = ?", options: ["99", "89", "999", "19"], answer: 0 },
];

// ============================== DIALOGUES ==============================
const DIALOGUES = {
  1: [
    ["A", "你好！", "Nǐ hǎo!", "Bonjour !"],
    ["B", "你好！", "Nǐ hǎo!", "Bonjour !"],
    ["A", "对不起！", "Duìbuqǐ!", "Désolé !"],
    ["B", "没关系！", "Méiguānxi!", "Ce n'est pas grave !"],
  ],
  2: [
    ["A", "谢谢你！", "Xièxie nǐ!", "Merci !"],
    ["B", "不客气！", "Bú kèqi!", "Je t'en prie !"],
    ["A", "再见！", "Zàijiàn!", "Au revoir !"],
    ["B", "再见！", "Zàijiàn!", "Au revoir !"],
  ],
  3: [
    ["A", "你叫什么名字？", "Nǐ jiào shénme míngzi?", "Comment t'appelles-tu ?"],
    ["B", "我叫李月。", "Wǒ jiào Lǐ Yuè.", "Je m'appelle Li Yue."],
    ["A", "你姓什么？", "Nǐ xìng shénme?", "Quel est ton nom de famille ?"],
    ["B", "我姓李。", "Wǒ xìng Lǐ.", "Mon nom de famille est Li."],
  ],
  4: [
    ["A", "请问，你是哪国人？", "Qǐngwèn, nǐ shì nǎ guó rén?", "Excuse-moi, de quelle nationalité es-tu ?"],
    ["B", "我是美国人，你呢？", "Wǒ shì Měiguó rén, nǐ ne?", "Je suis américain, et toi ?"],
    ["A", "我是中国人。", "Wǒ shì Zhōngguó rén.", "Je suis chinois."],
    ["B", "她是谁？", "Tā shì shéi?", "Qui est-elle ?"],
    ["A", "她是我的汉语老师，她叫李月。很高兴认识你！", "Tā shì wǒ de hànyǔ lǎoshī, tā jiào Lǐ Yuè. Hěn gāoxìng rènshi nǐ!", "Elle est mon professeur de chinois, elle s'appelle Li Yue. Ravi de te connaître !"],
  ],
  5: [
    ["A", "你有哥哥吗？", "Nǐ yǒu gēge ma?", "As-tu un grand frère ?"],
    ["B", "我有两个哥哥，你呢？", "Wǒ yǒu liǎng gè gēge, nǐ ne?", "J'ai deux grands frères, et toi ?"],
    ["A", "我没有哥哥。", "Wǒ méiyǒu gēge.", "Je n'ai pas de grand frère."],
    ["B", "你家有几口人？", "Nǐ jiā yǒu jǐ kǒu rén?", "Combien de personnes dans ta famille ?"],
    ["A", "我家有四口人，爸爸、妈妈、妹妹和我。", "Wǒ jiā yǒu sì kǒu rén, bàba, māma, mèimei hé wǒ.", "Ma famille a quatre personnes : papa, maman, ma petite sœur et moi."],
  ],
};

const TONS = [
  { t: 1, pinyin: "mā", zh: "妈", fr: "mère", desc: "1er ton — plat et long, comme « la » en musique", shape: "—" },
  { t: 2, pinyin: "má", zh: "麻", fr: "fibre", desc: "2e ton — montant, interrogateur : « hein ? »", shape: "/" },
  { t: 3, pinyin: "mǎ", zh: "马", fr: "cheval", desc: "3e ton — la voix descend puis remonte, son grave", shape: "V" },
  { t: 4, pinyin: "mà", zh: "骂", fr: "insulter", desc: "4e ton — bref et descendant : « zut ! »", shape: "\\" },
];

const TONE_QUIZ = [
  { s: "mā", zh: "妈", m: "mère", t: 1 },
  { s: "má", zh: "麻", m: "fibre", t: 2 },
  { s: "mǎ", zh: "马", m: "cheval", t: 3 },
  { s: "mà", zh: "骂", m: "insulter", t: 4 },
  { s: "yī", zh: "一", m: "un", t: 1 },
  { s: "sān", zh: "三", m: "trois", t: 1 },
  { s: "qī", zh: "七", m: "sept", t: 1 },
  { s: "bā", zh: "八", m: "huit", t: 1 },
  { s: "shí", zh: "十", m: "dix", t: 2 },
  { s: "chá", zh: "茶", m: "thé", t: 2 },
  { s: "nǐ", zh: "你", m: "tu", t: 3 },
  { s: "hǎo", zh: "好", m: "bien", t: 3 },
  { s: "wǔ", zh: "五", m: "cinq", t: 3 },
  { s: "jiǔ", zh: "九", m: "neuf", t: 3 },
  { s: "sì", zh: "四", m: "quatre", t: 4 },
  { s: "liù", zh: "六", m: "six", t: 4 },
  { s: "èr", zh: "二", m: "deux", t: 4 },
  { s: "mèi", zh: "妹", m: "petite sœur", t: 4 },
];

const GUIDE_INITIALES = [
  ["jī", "j", "comme le « j » de « jeep » (anglais)"],
  ["qī", "q", "entre « ts » et « tch » — « chinchin »"],
  ["xī", "x", "proche du « ch » français, langue tirée en arrière"],
  ["zǐ", "z", "comme « dze »"],
  ["cì", "c", "comme « tse »"],
  ["sān", "s", "comme le « c » de « cela »"],
  ["zhōng", "zh", "comme le « j » de « jean » (anglais)"],
  ["chá", "ch", "comme « cheu »"],
  ["shí", "sh", "comme le « ch » de « chaud »"],
  ["rì", "r", "comme le « j » de « jeux »"],
  ["hē", "h", "comme le « h » anglais, proche du « r » français"],
  ["bā", "b", "comme « b » mais moins expiré"],
  ["pó", "p", "comme « p » mais plus expiré"],
  ["dì", "d", "comme « d » mais moins expiré"],
  ["tā", "t", "comme « t » mais plus expiré"],
  ["gē", "g", "comme « g » mais moins expiré"],
  ["kě", "k", "comme « k » mais plus expiré"],
  ["nǐ", "n", "comme « n »"],
  ["lǎo", "l", "comme « l »"],
  ["fēi", "f", "comme « f »"],
  ["mā", "m", "comme « m »"],
];

const GUIDE_FINALES = [
  ["hǎo", "ao", "comme « ow » de « now » (anglais)"],
  ["shuǐ", "ui (uei)", "comme « ouais »"],
  ["xièxie", "ie", "comme le « yé » de « noyé »"],
  ["jiā", "ia", "comme le « ya » de « yaya »"],
  ["huā", "ua", "comme « oua »"],
  ["huǒ", "uo", "comme « ouo »"],
  ["yuè", "üe", "comme le « ué » de « huée »"],
  ["mǎi", "ai", "comme « aille »"],
  ["mèi", "ei", "comme le « é » de « hé »"],
  ["tóu", "ou", "comme le « ou » de « loup »"],
  ["piào", "iao", "un « i » + « ao »"],
  ["xiūxi", "iu (iou)", "comme « yo » de « yoyo »"],
  ["sān", "an", "comme le « an » de « âne », sans insister sur le n"],
  ["jīntiān", "ian", "comme le « ien » de « la tienne »"],
  ["yuán", "uan", "comme le « ouan » de « douanne »"],
  ["hěn", "en", "comme le « en » de « gène »"],
  ["xīn", "in", "comme le « in » de « mine »"],
  ["qún", "ün", "comme « une », sans insister sur le ne"],
  ["shàng", "ang", "comme dans « langue »"],
  ["dēng", "eng", "comme le « en » de « taken » (anglais)"],
  ["tīng", "ing", "comme « ing » de « camping », sans le g"],
  ["tóng", "ong", "comme le « on » de « long »"],
];

const CHARS = [
  { c: "一", p: "yī", m: "un", n: 1, tip: "Un seul héng (—), de gauche à droite." },
  { c: "二", p: "èr", m: "deux", n: 2, tip: "Héng court, puis héng long, de haut en bas." },
  { c: "三", p: "sān", m: "trois", n: 3, tip: "Trois héng, de haut en bas, celui du milieu le plus court." },
  { c: "十", p: "shí", m: "dix", n: 2, tip: "D'abord héng (—), puis shù (｜) : 先横后竖 ." },
  { c: "八", p: "bā", m: "huit", n: 2, tip: "Piě (gauche) puis nà (droite) : 先撇后捺 ." },
  { c: "人", p: "rén", m: "personne", n: 2, tip: "Piě puis nà, en partant du sommet." },
  { c: "大", p: "dà", m: "grand", n: 3, tip: "Héng, puis piě, puis nà." },
  { c: "天", p: "tiān", m: "ciel", n: 4, tip: "Deux héng, puis piě et nà." },
  { c: "六", p: "liù", m: "six", n: 4, tip: "Diǎn (point), héng, piě, diǎn." },
  { c: "不", p: "bù", m: "ne...pas", n: 4, tip: "Héng, piě, shù, diǎn." },
  { c: "口", p: "kǒu", m: "bouche", n: 3, tip: "Shù, héngzhé (ㄱ), puis héng qui ferme en bas — 先外后内再封口 ." },
  { c: "山", p: "shān", m: "montagne", n: 3, tip: "Shù du milieu, puis le côté gauche, puis la base." },
  { c: "小", p: "xiǎo", m: "petit", n: 3, tip: "Shùgōu (crochet vertical), puis piě, puis diǎn." },
  { c: "月", p: "yuè", m: "lune", n: 4, tip: "Piě, héngzhégōu, puis deux petits héng à l'intérieur." },
  { c: "心", p: "xīn", m: "cœur", n: 4, tip: "Diǎn, wògōu (crochet couché), puis deux diǎn." },
  { c: "中", p: "zhōng", m: "milieu", n: 4, tip: "Le 口 d'abord, puis le shù vertical au milieu." },
  { c: "门", p: "mén", m: "porte", n: 3, tip: "Diǎn, shù, héngzhégōu." },
  { c: "女", p: "nǚ", m: "femme", n: 3, tip: "3 traits : mémorise bien le tracé global, il sert dans 你 et 好." },
  { c: "你", p: "nǐ", m: "tu", n: 7, tip: "7 traits : 亻à gauche (2 traits), puis 尔 à droite." },
  { c: "好", p: "hǎo", m: "bien", n: 6, tip: "女 à gauche, 子 à droite — de gauche à droite (先左后右)." },
  { c: "我", p: "wǒ", m: "je", n: 7, tip: "7 traits, de gauche à droite. Le plus difficile du niveau — écris-le souvent !" },
  { c: "七", p: "qī", m: "sept", n: 2, tip: "Héng, puis shùwāngōu (crochet courbé vertical)." },
  { c: "九", p: "jiǔ", m: "neuf", n: 2, tip: "Piě, puis héngzhéwāngōu (crochet courbé à rotation horizontale)." },
  { c: "几", p: "jǐ", m: "combien", n: 2, tip: "Piě, puis héngzhéwāngōu — même famille que 九." },
  { c: "国", p: "guó", m: "pays", n: 8, tip: "Le carré 囗 d'abord (extérieur), puis 玉 à l'intérieur, on ferme en bas — 先外后内再封口 ." },
];

// ============================== PROGRESSION ==============================
const STORE_KEY = "hsk1-campus-chinois-v1";
const TONE_COLORS = ["#dc2626", "#ea580c", "#16a34a", "#2563eb"];
const CATALOG_KEY = "hsk1-catalog-v1";

function loadCustomCatalog() {
  try {
    const raw = JSON.parse(localStorage.getItem(CATALOG_KEY) || "{}");
    const lessons = Array.isArray(raw.lessons) ? raw.lessons : [];
    const quiz = Array.isArray(raw.quiz) ? raw.quiz : [];
    const nextId = 6;
    lessons.forEach((l, i) => { if (!l.id) l.id = nextId + i; });
    return { lessons, quiz, vocab: raw.vocab || [] };
  } catch (e) {
    return { lessons: [], quiz: [], vocab: [] };
  }
}
const CUSTOM_CATALOG = loadCustomCatalog();
const ALL_LESSONS = [...LESSONS, ...CUSTOM_CATALOG.lessons];
const ALL_QUIZ = [...QUIZ, ...CUSTOM_CATALOG.quiz];

(CUSTOM_CATALOG.vocab || []).forEach((v) => {
  const les = ALL_LESSONS.find((l) => l.id === v.lesson);
  if (les) les.sections.push({ titre: "Vocabulaire (ajouté)", vocab: [{ hanzi: v.hanzi, pinyin: v.pinyin, fr: v.fr }] });
});

const ALL_VOCAB = ALL_LESSONS.flatMap((l) =>
  l.sections.flatMap((s) => s.vocab.map((v) => ({ ...v, lesson: l.id })))
).filter((v) => !v.hanzi.includes("……") && !v.hanzi.includes("/"));

const SETTINGS_KEY = "hsk1-settings-v1";
const MISSES_KEY = "hsk1-misses-v1";
const PRON_KEY = "hsk1-pron-v1";
const GEMINI_KEY_STORE = "hsk1-gemini-key";
const WAVE_LINK_STORE = "hsk1-wave-link";
const WAVE_DEFAULT_LINK = "https://pay.wave.com/m/M_ci_lPtTUkiLSpYn/c/ci/";
const ADMIN_PIN = "2026";
const FREE_AI_PER_DAY = 5;

function getSettings() {
  try { return Object.assign({ aiFreePerDay: 5, billingOn: false }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); }
  catch (e) { return { aiFreePerDay: 5, billingOn: false }; }
}
function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {} }
function noteMiss(question) {
  try {
    const m = JSON.parse(localStorage.getItem(MISSES_KEY) || "{}");
    m[question] = (m[question] || 0) + 1;
    localStorage.setItem(MISSES_KEY, JSON.stringify(m));
  } catch (e) {}
}
function getMisses() { try { return JSON.parse(localStorage.getItem(MISSES_KEY) || "{}"); } catch (e) { return {}; } }
function recordPron(hanzi, score) {
  try {
    const h = JSON.parse(localStorage.getItem(PRON_KEY) || "{}");
    const prev = h[hanzi] || { tries: 0, best: 0, first: null };
    h[hanzi] = {
      tries: prev.tries + 1,
      best: Math.max(prev.best, score),
      last: score,
      first: prev.first == null ? score : prev.first,
    };
    localStorage.setItem(PRON_KEY, JSON.stringify(h));
    return h[hanzi];
  } catch (e) {
    return { tries: 1, best: score, last: score, first: score };
  }
}
function getPronHist() { try { return JSON.parse(localStorage.getItem(PRON_KEY) || "{}"); } catch (e) { return {}; } }
async function askGeminiJSON(prompt, apiKey) {
  return callGeminiWithFallback(
    { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } },
    apiKey,
    true
  );
}

const NODES = [];
for (let l = 1; l <= ALL_LESSONS.length; l++) {
  NODES.push({ id: "L" + l + "-vocab", lesson: l, type: "vocab", label: "Vocabulaire", icon: "📖", xp: 5 });
  NODES.push({ id: "L" + l + "-quiz", lesson: l, type: "quiz", label: "Quiz écrit", icon: "🎯", xp: 10 });
  NODES.push({ id: "L" + l + "-oral", lesson: l, type: "oral", label: "Écoute", icon: "🎧", xp: 10 });
  NODES.push({ id: "L" + l + "-tons", lesson: l, type: "tons", label: "Tons", icon: "🎵", xp: 8 });
  NODES.push({ id: "L" + l + "-ecrit", lesson: l, type: "ecrit", label: "Écriture", icon: "✍️", xp: 8 });
  NODES.push({ id: "L" + l + "-boss", lesson: l, type: "boss", label: "Défi final", icon: "🏆", xp: 15 });
}

const BADGES = [
  { id: "start", label: "Premier pas", icon: "🌱", test: (p) => Object.keys(p.nodes).length >= 1 },
  { id: "perfect", label: "Sans faute", icon: "💯", test: (p) => Object.values(p.nodes).some((n) => (n.best || 0) >= 100) },
  { id: "streak3", label: "Série de 3 jours", icon: "🔥", test: (p) => computeStreak(p.history) >= 3 },
  { id: "streak7", label: "Série de 7 jours", icon: "☄️", test: (p) => computeStreak(p.history) >= 7 },
  { id: "lesson1", label: "Leçon 1 finie", icon: "🥇", test: (p) => (p.nodes["L1-boss"] || {}).done },
  { id: "xp300", label: "300 XP", icon: "⚡", test: (p) => p.xp >= 300 },
  { id: "champion", label: "HSK 1 Champion", icon: "👑", test: (p) => [1, 2, 3, 4, 5].every((l) => (p.nodes["L" + l + "-boss"] || {}).done) },
  { id: "coin1", label: "Premières pièces", icon: "🪙", test: (p) => (p.coins || 0) + (p.spent || 0) >= 10 },
  { id: "pot50", label: "Cagnotte solidaire", icon: "🤝", test: (p) => (p.pot || 0) >= 50 },
  { id: "donor", label: "Donateur · Fondation", icon: "❤️", test: (p) => !!p.donor },
  { id: "curieux", label: "Élève du professeur IA", icon: "🧑‍🏫", test: (p) => (p.aiCount || 0) >= 10 },
];

function todayKey() { return new Date().toISOString().slice(0, 10); }

function computeStreak(history) {
  const keys = Object.keys(history).filter((k) => (history[k] || 0) > 0).sort().reverse();
  if (!keys.length) return 0;
  const fmt = (d) => d.toISOString().slice(0, 10);
  const today = fmt(new Date());
  const yesterday = fmt(new Date(Date.now() - 86400000));
  if (keys[0] !== today && keys[0] !== yesterday) return 0;
  const set = new Set(keys);
  let cursor = keys[0];
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    const c = new Date(cursor + "T00:00:00Z");
    c.setUTCDate(c.getUTCDate() - 1);
    cursor = c.toISOString().slice(0, 10);
  }
  return streak;
}

function starsFor(st) {
  if (!st) return 0;
  const b = st.best || 0;
  if (b >= 90) return 3;
  if (b >= 75) return 2;
  if (b >= 60) return 1;
  return st.done ? 1 : 0;
}

function useProgress() {
  const [progress, setProgress] = useState(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { xp: 0, history: {}, nodes: {}, goal: 40, coins: 0, pot: 0, donor: false };
  });

  // Écoute l'event de chargement cloud
  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) setProgress(JSON.parse(raw));
      } catch (e) {}
    };
    window.addEventListener("hsk1-cloud-loaded", handler);
    return () => window.removeEventListener("hsk1-cloud-loaded", handler);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) {}
  }, [progress]);

  const addXp = (amount) => {
    if (amount <= 0) return;
    setProgress((p) => {
      const k = todayKey();
      return { ...p, xp: p.xp + amount, history: { ...p.history, [k]: (p.history[k] || 0) + amount } };
    });
  };

  const completeNode = (id, pct) => {
    const def = NODES.find((n) => n.id === id);
    if (!def) return;
    setProgress((p) => {
      const prev = p.nodes[id] || {};
      const isNew = !prev.done;
      const nodes = { ...p.nodes, [id]: { done: true, best: Math.max(prev.best || 0, pct || 0) } };
      const gain = isNew ? def.xp : Math.round(def.xp * 0.25);
      const k = todayKey();
      return { ...p, xp: p.xp + gain, history: { ...p.history, [k]: (p.history[k] || 0) + gain }, nodes };
    });
  };

  const setGoal = (g) => setProgress((p) => ({ ...p, goal: g }));

  const addCoins = (amount) => {
    if (amount <= 0) return;
    setProgress((p) => {
      const solidary = Math.ceil(amount / 5);
      return { ...p, coins: (p.coins || 0) + amount, pot: (p.pot || 0) + solidary };
    });
  };

  const donateCoins = (amount) => {
    if ((progress.coins || 0) < amount) return;
    setProgress((p) => ({ ...p, coins: Math.max(0, (p.coins || 0) - amount), pot: (p.pot || 0) + amount }));
  };

  const spendCoins = (amount) => {
    if ((progress.coins || 0) < amount) return false;
    setProgress((p) => ({ ...p, coins: Math.max(0, (p.coins || 0) - amount), spent: (p.spent || 0) + amount }));
    return true;
  };

  const buyAvatar = (emoji, price) => {
    if ((progress.coins || 0) < price) return false;
    setProgress((p) => ({
      ...p,
      coins: Math.max(0, (p.coins || 0) - price),
      spent: (p.spent || 0) + price,
      avatar: emoji,
      owned: [...(p.owned || []), emoji],
    }));
    return true;
  };

  const setDonor = (v) => setProgress((p) => ({ ...p, donor: v }));
  const addDonation = (d) => setProgress((p) => ({ ...p, donations: [...(p.donations || []), d] }));

  const registerAI = () =>
    setProgress((p) => {
      const k = todayKey();
      const cur = p.ai && p.ai.date === k ? p.ai.count : 0;
      return { ...p, ai: { date: k, count: cur + 1 }, aiCount: (p.aiCount || 0) + 1 };
    });

  const aiUsedToday = progress.ai && progress.ai.date === todayKey() ? progress.ai.count : 0;

  return { progress, addXp, completeNode, setGoal, addCoins, donateCoins, spendCoins, buyAvatar, setDonor, addDonation, registerAI, aiUsedToday };
}

// ============================== AUDIO v2 ==============================
let _cachedVoice = null;
let _voiceLoadPromise = null;

function loadVoices() {
  return new Promise((resolve) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return resolve([]);
    const existing = synth.getVoices();
    if (existing.length) return resolve(existing);
    const handler = () => { synth.removeEventListener("voiceschanged", handler); resolve(synth.getVoices()); };
    synth.addEventListener("voiceschanged", handler);
    setTimeout(() => resolve(synth.getVoices()), 1500);
  });
}

async function pickBestChineseVoice() {
  if (_cachedVoice) return _cachedVoice;
  if (_voiceLoadPromise) return _voiceLoadPromise;
  _voiceLoadPromise = (async () => {
    const voices = await loadVoices();
    if (!voices.length) return null;
    const priorities = [
      (v) => v.lang === "zh-CN" && /Google/i.test(v.name),
      (v) => v.lang === "zh-CN" && /Microsoft (Xiaoxiao|Yunxi|Xiaoyi|Huihui|Kangkang|Yaoyao)/i.test(v.name),
      (v) => v.lang === "zh-CN" && /Ting-?Ting|Mei-?Jia|Sin-?ji|Li-?mu/i.test(v.name),
      (v) => v.lang === "zh-CN" || v.lang === "zh_CN",
      (v) => v.lang && v.lang.toLowerCase().startsWith("zh"),
    ];
    for (const test of priorities) {
      const found = voices.find(test);
      if (found) {
        _cachedVoice = found;
        console.log("🎙️ Voix chinoise sélectionnée :", found.name, "(", found.lang, ")");
        return found;
      }
    }
    console.warn("⚠️ Aucune voix chinoise trouvée.");
    return null;
  })();
  return _voiceLoadPromise;
}

async function speak(text, rate) {
  try {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return false;
    const cleanText = String(text).replace(/……/g, "").replace(/[…]/g, "").replace(/\s+/g, " ").trim();
    if (!cleanText) return false;
    synth.cancel();
    await new Promise((r) => setTimeout(r, 60));
    const voice = await pickBestChineseVoice();
    const u = new SpeechSynthesisUtterance(cleanText);
    u.lang = voice ? voice.lang : "zh-CN";
    u.rate = rate != null ? rate : 0.85;
    u.pitch = 1.0;
    u.volume = 1.0;
    if (voice) u.voice = voice;
    u.onerror = (e) => { if (e.error && e.error !== "interrupted" && e.error !== "canceled") console.warn("TTS :", e.error); };
    synth.speak(u);
    return true;
  } catch (e) { return false; }
}

function preloadVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => pickBestChineseVoice();
  setTimeout(() => pickBestChineseVoice(), 300);
}

function EcouterBtn({ text, slow, label }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    const ok = await speak(text, slow ? 0.45 : 0.85);
    setLoading(false);
    if (ok) {
      setPlaying(true);
      const dur = Math.max(800, String(text).length * 320);
      setTimeout(() => setPlaying(false), dur);
    }
  };
  const base = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all active:scale-95 disabled:opacity-60";
  const style = slow
    ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-400"
    : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400";
  return (
    <button onClick={handleClick} disabled={loading} className={`${base} ${style} ${playing ? "ring-2 ring-offset-1 ring-red-300 animate-pulse" : ""}`}>
      {loading ? <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <span>{slow ? "🐢" : "🔊"}</span>}
      <span>{label || (slow ? "lent" : "écouter")}</span>
    </button>
  );
}

function VoiceDiagnostic() {
  const [info, setInfo] = useState(null);
  const run = async () => {
    const voices = await loadVoices();
    const zh = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("zh"));
    const best = await pickBestChineseVoice();
    setInfo({ total: voices.length, chinese: zh.length, best: best ? `${best.name} (${best.lang})` : null });
  };
  return (
    <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs">
      <button onClick={run} className="font-bold text-gray-700 hover:text-red-600">🔍 Diagnostic vocal</button>
      {info && (
        <div className="mt-2 text-gray-600 space-y-1">
          <div>Voix totales : <b>{info.total}</b> · Voix chinoises : <b className={info.chinese > 0 ? "text-green-600" : "text-red-600"}>{info.chinese}</b></div>
          {info.best && <div className="text-green-700">✓ Meilleure voix : <b>{info.best}</b></div>}
        </div>
      )}
    </div>
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================== NAV ==============================
const NAV = [
  ["parcours", "🗺️ Parcours"],
  ["express", "⏱️ Express"],
  ["jeux", "🎮 Jeux"],
  ["prof", "🧑‍🏫 Prof IA"],
  ["fiches", "📖 Fiches"],
  ["quiz", "🎯 Quiz"],
  ["oral", "🎧 Oral"],
  ["pronon", "🗣️ Prononcer"],
  ["ecrit", "✍️ Écrit"],
  ["phonetique", "🔊 Phonétique"],
  ["defi", "⚡ Défi"],
  ["progres", "📈 Progrès"],
  ["don", "❤️ Fondation"],
];

function Header({ active, onNav, progress, onHome, cloudUser, onLogout, onLogin }) {
  const level = Math.floor(progress.xp / 100) + 1;
  const into = progress.xp % 100;
  const streak = computeStreak(progress.history);
  const todayXp = progress.history[todayKey()] || 0;
  const goalPct = Math.min(100, Math.round((todayXp / (progress.goal || 40)) * 100));
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <button
          onClick={onHome}
          className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center text-2xl shadow-md hover:scale-110 transition-transform"
          title="Retour à l'accueil"
        >
          {progress.avatar || "中"}
        </button>
        <div className="mr-auto">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">YǔLù 语路 — Campus chinois HSK</h1>
          <p className="text-xs md:text-sm text-gray-500">Chaque mot compte · chaque vie mérite un futur ❤️ VIE Foundation</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Indicateur cloud */}
          {cloudUser ? (
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl bg-green-50 border border-green-300 text-center hover:bg-green-100 transition-colors"
              title={`Connecté : ${cloudUser.email} — cliquer pour se déconnecter`}
            >
              <div className="text-sm font-bold text-green-600">☁️</div>
              <div className="text-[10px] text-green-700">sync</div>
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-300 text-center hover:bg-red-100 transition-colors"
              title="Se connecter pour synchroniser"
            >
              <div className="text-sm font-bold text-red-600">☁️</div>
              <div className="text-[10px] text-red-700">connexion</div>
            </button>
          )}
          <div className="px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-center">
            <div className="text-sm font-bold text-orange-600">🔥 {streak}</div>
            <div className="text-[10px] text-orange-500">jours</div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
            <div className="text-sm font-bold text-indigo-600">⚡ {progress.xp}</div>
            <div className="text-[10px] text-indigo-500">XP total</div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-yellow-50 border border-yellow-300 text-center">
            <div className="text-sm font-bold text-yellow-600">🪙 {progress.coins || 0}</div>
            <div className="text-[10px] text-yellow-600">pièces</div>
          </div>
          {progress.donor && (
            <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-300 text-center">
              <div className="text-sm font-bold text-rose-600">❤️</div>
              <div className="text-[10px] text-rose-500">donateur</div>
            </div>
          )}
          <div className="px-3 py-1.5 rounded-xl bg-gray-900 text-center">
            <div className="text-sm font-bold text-amber-300">Niv. {level}</div>
            <div className="w-20 h-1.5 bg-gray-700 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-amber-300 rounded-full" style={{ width: into + "%" }} />
            </div>
          </div>
        </div>
      </div>
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
        <span>🎯 Objectif du jour : <b className="text-gray-700">{todayXp} / {progress.goal || 40} XP</b></span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${goalPct >= 100 ? "bg-green-500" : "bg-red-500"}`} style={{ width: goalPct + "%" }} />
        </div>
        {goalPct >= 100 && <span className="text-green-600 font-bold">✅ atteint !</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 pb-px">
        {NAV.map(([id, label]) => (
          <button key={id} onClick={() => onNav(id)} className={`px-3 py-2 rounded-t-lg font-medium text-xs md:text-sm transition-colors ${active === id ? "bg-red-600 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{label}</button>
        ))}
      </div>
    </div>
  );
}

function LessonChips({ value, onChange, allLabel }) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {allLabel && (
        <button onClick={() => onChange("all")} className={`px-4 py-2 rounded-full text-sm font-medium border ${value === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300"}`}>{allLabel}</button>
      )}
      {ALL_LESSONS.map((l) => (
        <button key={l.id} onClick={() => onChange(l.id)} className={`px-4 py-2 rounded-full text-sm font-medium border ${value === l.id ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-700 border-gray-300"}`}>{l.titre} · {l.zh}</button>
      ))}
    </div>
  );
}

function Fiche({ vocab, index }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button onClick={() => setFlipped(!flipped)} className="text-left p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-red-300 transition-all cursor-pointer">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-semibold text-gray-900">{vocab.hanzi}</div>
          <div className="text-sm text-red-600 font-medium mt-0.5">{vocab.pinyin}</div>
          <div className={`text-sm text-gray-600 mt-1 transition-opacity ${flipped ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>{vocab.fr}</div>
        </div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">{index + 1}</span>
      </div>
    </button>
  );
}

function Fiches({ presetLesson, onReviewDone }) {
  const [lessonId, setLessonId] = useState(presetLesson != null ? presetLesson : 1);
  const lesson = ALL_LESSONS.find((l) => l.id === lessonId);
  return (
    <div>
      <LessonChips value={lessonId} onChange={setLessonId} />
      {onReviewDone && (
        <button onClick={() => onReviewDone(100)} className="mb-4 w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow">✅ J'ai révisé cette leçon — valider (+5 XP)</button>
      )}
      <div className="rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 p-6 mb-6 shadow">
        <div className="text-white">
          <div className="text-3xl font-bold">{lesson.zh}</div>
          <div className="text-lg opacity-90">{lesson.pinyin} — {lesson.fr}</div>
        </div>
      </div>
      {lesson.sections.map((s) => (
        <div key={s.titre} className="mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-red-600 rounded-full inline-block" />
            {s.titre}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {s.vocab.map((v, i) => (<Fiche key={v.hanzi + i} vocab={v} index={i} />))}
          </div>
        </div>
      ))}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="p-5 rounded-xl border border-blue-200 bg-blue-50">
          <h4 className="font-bold text-blue-900 mb-2">🗣️ Phrases clés</h4>
          <ul className="space-y-3">
            {lesson.phrases.map((p, i) => (
              <li key={i} className="text-sm">
                <div className="font-semibold text-gray-900">{p.zh}</div>
                <div className="text-blue-700">{p.pinyin}</div>
                <div className="text-gray-600 italic">{p.fr}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-5 rounded-xl border border-amber-200 bg-amber-50">
          <h4 className="font-bold text-amber-900 mb-2">🔤 Pinyin & règles</h4>
          <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
            {lesson.pinyinNotes.map((n, i) => (<li key={i}>{n}</li>))}
          </ul>
        </div>
      </div>
      <div className="p-5 rounded-xl border border-green-200 bg-green-50 mb-4">
        <h4 className="font-bold text-green-900 mb-2">✍️ Caractères</h4>
        <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
          {lesson.caracteres.map((c, i) => (<li key={i}>{c}</li>))}
        </ul>
      </div>
    </div>
  );
}

function Quiz({ presetLesson, onDone }) {
  const [lessonFilter, setLessonFilter] = useState(presetLesson != null ? presetLesson : "all");
  const [mode, setMode] = useState(presetLesson != null ? "play" : "setup");
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState([]);

  const pool = useMemo(
    () => (lessonFilter === "all" ? ALL_QUIZ : ALL_QUIZ.filter((q) => q.lesson === lessonFilter)),
    [lessonFilter]
  );

  const start = () => {
    setQuestions(shuffle(pool).slice(0, Math.min(pool.length, 10)));
    setCurrent(0); setSelected(null); setScore(0); setWrong([]); setMode("play");
  };

  useEffect(() => {
    if (presetLesson != null && mode === "play" && questions.length === 0) start();
  }, [mode, questions.length, presetLesson]);

  const answer = (i) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === questions[current].answer) setScore((s) => s + 1);
    else { setWrong((w) => [...w, questions[current]]); noteMiss(questions[current].question); }
  };

  const next = () => {
    if (current + 1 >= questions.length) setMode("done");
    else { setCurrent((c) => c + 1); setSelected(null); }
  };

  if (mode === "setup") {
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl border border-gray-200 bg-white shadow">
        <h3 className="text-xl font-bold text-gray-900 mb-1">Choisis ta leçon</h3>
        <p className="text-sm text-gray-500 mb-4">10 questions au hasard · {ALL_QUIZ.length} questions</p>
        <LessonChips value={lessonFilter} onChange={setLessonFilter} allLabel="Toutes" />
        <button onClick={start} className="w-full py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow">Commencer le quiz 🎯</button>
      </div>
    );
  }

  if (mode === "done") {
    const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const msg = pct === 100 ? "完美！Parfait ! 🏆" : pct >= 70 ? "很好！Très bien ! 👏" : pct >= 50 ? "继续加油！Continue ! 💪" : "再复习一下！Révise ! 📖";
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl border border-gray-200 bg-white shadow">
        <div className="text-center mb-5">
          <div className="text-5xl font-bold" style={{ color: TONE_COLORS[3] }}>{score}/{questions.length}</div>
          <div className="text-lg font-medium text-gray-700 mt-1">{msg}</div>
        </div>
        {wrong.length > 0 && (
          <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200">
            <div className="font-bold text-red-800 text-sm mb-2">À revoir :</div>
            <ul className="space-y-2">
              {wrong.map((q, i) => (
                <li key={i} className="text-sm text-gray-700">
                  <span className="font-medium">{q.question}</span>
                  <div className="text-red-700">✔ {q.options[q.answer]}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {onDone && (
            <button onClick={() => onDone(pct)} className="w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow">✅ Valider cette étape (+XP)</button>
          )}
          <div className="flex gap-2">
            <button onClick={start} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700">Refaire 🔁</button>
            <button onClick={() => setMode("setup")} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200">Changer de leçon</button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const answered = selected !== null;
  const correct = selected === q.answer;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-3 text-sm text-gray-500">
        <span>Question {current + 1} / {questions.length}</span>
        <span className="font-medium text-gray-700">Score : {score}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full mb-5">
        <div className="h-2 bg-red-600 rounded-full transition-all" style={{ width: `${((current + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>
      <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow">
        <span className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 mb-3">Leçon {q.lesson} · {q.type}</span>
        <div className="text-lg font-semibold text-gray-900 mb-5">{q.question}</div>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            let cls = "border-gray-200 bg-white hover:border-red-400";
            if (answered) {
              if (i === q.answer) cls = "border-green-500 bg-green-50";
              else if (i === selected) cls = "border-red-400 bg-red-50";
              else cls = "border-gray-200 bg-white opacity-50";
            }
            return (<button key={i} onClick={() => answer(i)} disabled={answered} className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${cls}`}>{opt}</button>);
          })}
        </div>
        {answered && (
          <div className="mt-4">
            <div className={`text-sm font-bold mb-2 ${correct ? "text-green-700" : "text-red-700"}`}>{correct ? "✓ 对！Correct !" : `✗ 不对 — réponse : ${q.options[q.answer]}`}</div>
            <button onClick={next} className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition">
              {current + 1 >= questions.length ? "Voir le résultat →" : "Question suivante →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EcouteRepete() {
  const [lessonId, setLessonId] = useState(1);
  const lesson = ALL_LESSONS.find((l) => l.id === lessonId);
  const items = lesson.sections.flatMap((s) => s.vocab);
  const customDialogues = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("hsk1-dialogues-custom-v1") || "{}"); } catch (e) { return {}; }
  }, [lessonId]);
  const dialoguesForLesson = customDialogues[lessonId] || DIALOGUES[lessonId] || [];
  return (
    <div>
      <LessonChips value={lessonId} onChange={setLessonId} />
      <p className="text-sm text-gray-500 mb-4">🗣️ Écoute chaque mot, puis <b>répète à voix haute</b> en imitant le ton.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
        {items.map((v, i) => (
          <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div>
              <div className="text-xl font-semibold text-gray-900">{v.hanzi}</div>
              <div className="text-xs text-red-600 font-medium">{v.pinyin}</div>
              <div className="text-xs text-gray-500">{v.fr}</div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <EcouterBtn text={v.hanzi} />
              <EcouterBtn text={v.hanzi} slow />
            </div>
          </div>
        ))}
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-3">🎭 Dialogues</h3>
      <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50 space-y-2 mb-4">
        {dialoguesForLesson.map((line, i) => (
          <div key={i} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg ${line[0] === "A" ? "bg-white border border-indigo-100" : "bg-indigo-100"}`}>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{line[0]}</span>
              <div>
                <div className="font-semibold text-gray-900">{line[1]}</div>
                <div className="text-xs text-indigo-700">{line[2]}</div>
                <div className="text-xs text-gray-500 italic">{line[3]}</div>
              </div>
            </div>
            <EcouterBtn text={line[1]} />
          </div>
        ))}
        <EcouterBtn text={dialoguesForLesson.map((l) => l[1]).join("，")} label="tout le dialogue" />
      </div>
    </div>
  );
}

function QuizEcoute({ presetLesson, onDone }) {
  const [lessonFilter, setLessonFilter] = useState(presetLesson != null ? presetLesson : "all");
  const [mode, setMode] = useState(presetLesson != null ? "play" : "setup");
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);

  const pool = useMemo(
    () => (lessonFilter === "all" ? ALL_VOCAB : ALL_VOCAB.filter((v) => v.lesson === lessonFilter)),
    [lessonFilter]
  );

  const start = () => {
    const picked = shuffle(pool).slice(0, Math.min(pool.length, 10));
    const qs = picked.map((it) => {
      const distract = shuffle(pool.filter((x) => x.hanzi !== it.hanzi)).slice(0, 3);
      const opts = shuffle([it, ...distract]);
      return { item: it, opts, answer: opts.findIndex((o) => o.hanzi === it.hanzi) };
    });
    setQuestions(qs); setCurrent(0); setSelected(null); setScore(0); setMode("play");
  };

  useEffect(() => {
    if (presetLesson != null && mode === "play" && questions.length === 0) start();
  }, [mode, questions.length, presetLesson]);

  useEffect(() => {
    if (mode === "play" && questions.length > 0) speak(questions[current].item.hanzi);
  }, [mode, current, questions]);

  const answer = (i) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === questions[current].answer) setScore((s) => s + 1);
  };

  const next = () => {
    if (current + 1 >= questions.length) setMode("done");
    else { setCurrent((c) => c + 1); setSelected(null); }
  };

  if (mode === "setup") {
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl border border-gray-200 bg-white shadow">
        <h3 className="text-xl font-bold text-gray-900 mb-1">Quiz d'écoute 👂</h3>
        <p className="text-sm text-gray-500 mb-4">Tu entends un mot — choisis ce que tu as entendu.</p>
        <LessonChips value={lessonFilter} onChange={setLessonFilter} allLabel="Toutes" />
        <button onClick={start} className="w-full py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow">Commencer 🎧</button>
      </div>
    );
  }

  if (mode === "done") {
    const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl border border-gray-200 bg-white shadow text-center">
        <div className="text-5xl font-bold text-blue-600 mb-2">{score}/{questions.length}</div>
        <p className="text-gray-600 mb-5">{pct >= 80 ? "听力很好！Excellente oreille ! 👏" : "继续听！Continue à écouter 🎧"}</p>
        <div className="flex flex-col gap-2">
          {onDone && (
            <button onClick={() => onDone(pct)} className="w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow">✅ Valider cette étape (+XP)</button>
          )}
          <div className="flex gap-2">
            <button onClick={start} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700">Refaire 🔁</button>
            <button onClick={() => setMode("setup")} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200">Changer de leçon</button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const answered = selected !== null;
  const correct = selected === q.answer;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-3 text-sm text-gray-500">
        <span>Question {current + 1} / {questions.length}</span>
        <span className="font-medium text-gray-700">Score : {score}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full mb-5">
        <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${((current + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>
      <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow text-center">
        <p className="text-sm text-gray-500 mb-3">🎧 Écoute bien…</p>
        <button onClick={() => speak(q.item.hanzi)} className="w-24 h-24 rounded-full bg-blue-600 text-white text-4xl shadow-lg hover:bg-blue-700 mx-auto mb-5">🔊</button>
        <div className="space-y-2">
          {q.opts.map((opt, i) => {
            let cls = "border-gray-200 bg-white hover:border-red-400";
            if (answered) {
              if (i === q.answer) cls = "border-green-500 bg-green-50";
              else if (i === selected) cls = "border-red-400 bg-red-50";
              else cls = "border-gray-200 bg-white opacity-50";
            }
            return (<button key={i} onClick={() => answer(i)} disabled={answered} className={`w-full px-4 py-3 rounded-xl border text-sm font-medium transition-all ${cls}`}><span className="text-lg">{opt.hanzi}</span><span className="text-red-600 ml-2">{opt.pinyin}</span></button>);
          })}
        </div>
        {answered && (
          <div className="mt-4">
            <div className={`text-sm font-bold mb-2 ${correct ? "text-green-700" : "text-red-700"}`}>{correct ? "✓ 对！Correct !" : "✗ La bonne réponse était en vert."}</div>
            <button onClick={next} className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800">
              {current + 1 >= questions.length ? "Résultat →" : "Suivant →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Oral({ presetLesson, onDone }) {
  const [mode, setMode] = useState("repeter");
  if (presetLesson != null) return <QuizEcoute presetLesson={presetLesson} onDone={onDone} />;
  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setMode("repeter")} className={`px-4 py-2 rounded-full text-sm font-medium border ${mode === "repeter" ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-700 border-gray-300"}`}>🔁 Écoute & répète</button>
        <button onClick={() => setMode("quiz")} className={`px-4 py-2 rounded-full text-sm font-medium border ${mode === "quiz" ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-700 border-gray-300"}`}>👂 Quiz d'écoute</button>
      </div>
      {mode === "repeter" ? <EcouteRepete /> : <QuizEcoute />}
      <p className="mt-8 text-xs text-gray-400 text-center">ℹ️ Le son utilise la voix chinoise de ton appareil.</p>
    </div>
  );
}

function QuizTons({ onDone }) {
  const [qs, setQs] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);

  const start = () => {
    setQs(shuffle(TONE_QUIZ).slice(0, 10));
    setCurrent(0); setSelected(null); setScore(0); setStarted(true);
  };

  useEffect(() => {
    if (started && qs.length > 0 && current < qs.length) speak(qs[current].zh);
  }, [started, current, qs]);

  if (!started) {
    return (<button onClick={start} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow">S'entraîner aux tons 🎵</button>);
  }

  if (current >= qs.length) {
    const pct = qs.length > 0 ? Math.round((score / qs.length) * 100) : 0;
    return (
      <div className="text-center">
        <div className="text-3xl font-bold text-blue-600 mb-1">{score}/{qs.length} ({pct}%)</div>
        <div className="text-sm text-gray-500 mb-3">{pct >= 80 ? "Très bonne oreille ! 🎵" : "Continue ! 💪"}</div>
        <div className="flex gap-2 justify-center">
          <button onClick={start} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">Refaire 🔁</button>
          {onDone && (<button onClick={() => onDone(pct)} className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700">✅ Valider (+XP)</button>)}
        </div>
      </div>
    );
  }

  const q = qs[current];
  const answered = selected !== null;

  return (
    <div className="max-w-md mx-auto p-5 rounded-2xl border border-blue-200 bg-white shadow">
      <div className="text-center mb-4">
        <p className="text-sm text-gray-500 mb-2">🎧 Écoute : quel ton ?</p>
        <button onClick={() => speak(q.zh)} className="w-16 h-16 rounded-full bg-blue-600 text-white text-2xl shadow-lg hover:bg-blue-700">🔊</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {["1er ton (—)", "2e ton (/)", "3e ton (V)", "4e ton (\\)"].map((label, i) => {
          let cls = "border-gray-200 bg-white hover:border-blue-400";
          if (answered) {
            if (i + 1 === q.t) cls = "border-green-500 bg-green-50";
            else if (i + 1 === selected) cls = "border-red-400 bg-red-50";
            else cls = "border-gray-200 bg-white opacity-50";
          }
          return (
            <button key={i} onClick={() => { if (answered) return; setSelected(i + 1); if (i + 1 === q.t) setScore((s) => s + 1); }} className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all ${cls}`}>{label}</button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{q.zh} <span className="text-red-600">{q.s}</span></div>
          <div className="text-xs text-gray-500 mb-3">{q.m} · ton {q.t}</div>
          <button onClick={() => { setCurrent((c) => c + 1); setSelected(null); }} className="w-full py-2.5 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 text-sm">Suivant →</button>
        </div>
      )}
    </div>
  );
}

function Phonetique() {
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-blue-600 rounded-full inline-block" />
        Les 4 tons 🎵
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {TONS.map((t) => (
          <div key={t.t} className="p-4 rounded-xl border bg-white shadow-sm" style={{ borderColor: TONE_COLORS[t.t - 1] }}>
            <div className="text-3xl font-bold" style={{ color: TONE_COLORS[t.t - 1] }}>{t.pinyin} <span className="text-gray-400 text-xl">{t.shape}</span></div>
            <div className="text-xl font-semibold text-gray-900 mt-1">{t.zh}</div>
            <div className="text-xs text-gray-500">{t.fr}</div>
            <div className="text-xs text-gray-600 mt-1 mb-2">{t.desc}</div>
            <EcouterBtn text={t.zh} />
          </div>
        ))}
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-blue-600 rounded-full inline-block" />
        Quiz des tons 👂
      </h3>
      <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50 mb-8">
        <QuizTons />
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-blue-600 rounded-full inline-block" />
        Initiales 🔤
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-8">
        {GUIDE_INITIALES.map(([pinyin, init, hint], i) => (
          <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div>
              <span className="font-bold text-blue-700">{init}</span>
              <span className="ml-2 font-semibold text-gray-900">{pinyin}</span>
              <div className="text-xs text-gray-500">{hint}</div>
            </div>
            <EcouterBtn text={pinyin} />
          </div>
        ))}
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-blue-600 rounded-full inline-block" />
        Finales 🎼
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-8">
        {GUIDE_FINALES.map(([word, fin, hint], i) => (
          <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div>
              <span className="font-bold text-blue-700">{fin}</span>
              <span className="ml-2 font-semibold text-gray-900">{word}</span>
              <div className="text-xs text-gray-500">{hint}</div>
            </div>
            <EcouterBtn text={word} />
          </div>
        ))}
      </div>
      <div className="mt-8 mb-4 max-w-lg mx-auto">
        <VoiceDiagnostic />
      </div>
      <p className="text-xs text-gray-400 text-center">💡 Rappels : 3e ton + 3e ton → 2e ton + 3e ton · 不 bù devient bú devant 4e ton.</p>
    </div>
  );
}

function TracePad({ ch }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const paintBg = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.moveTo(0, 0); ctx.lineTo(w, h);
    ctx.moveTo(w, 0); ctx.lineTo(0, h);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.fillStyle = "rgba(239,68,68,0.16)"; ctx.font = "190px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(ch, w / 2, h / 2 + 10);
    ctx.strokeStyle = "#111827"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
  };

  useEffect(() => { paintBg(); }, [ch]);

  const pos = (e) => {
    const cv = canvasRef.current;
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)];
  };

  const down = (e) => {
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke();
  };

  const up = () => { drawing.current = false; };

  return (
    <div className="text-center">
      <canvas ref={canvasRef} width={300} height={300}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        className="rounded-xl border-2 border-gray-300 bg-white shadow-inner touch-none mx-auto"
        style={{ width: "100%", maxWidth: 300 }}
      />
      <button onClick={paintBg} className="mt-3 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200">🧽 Effacer</button>
    </div>
  );
}

function Ecrit({ onDone }) {
  const [chIdx, setChIdx] = useState(0);
  const ch = CHARS[chIdx];
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-green-600 rounded-full inline-block" />
          Choisis un caractère ({CHARS.length})
        </h3>
        <div className="grid grid-cols-6 gap-2 mb-5">
          {CHARS.map((c, i) => (
            <button key={i} onClick={() => setChIdx(i)} className={`aspect-square rounded-lg border text-2xl font-semibold transition-all ${i === chIdx ? "bg-green-600 text-white border-green-600 shadow scale-105" : "bg-white text-gray-800 border-gray-300 hover:border-green-500"}`}>{c.c}</button>
          ))}
        </div>
        <div className="p-4 rounded-xl border border-green-200 bg-green-50 text-sm text-gray-700 space-y-1.5">
          <div className="font-bold text-green-900 mb-1">📏 Règles d'ordre des traits</div>
          <div>• 先横后竖 : 十</div>
          <div>• 先撇后捺 : 人, 八</div>
          <div>• 从上到下 : 三</div>
          <div>• 先左后右 : 你, 好</div>
          <div>• 先外后内再封口 : 口</div>
        </div>
      </div>
      <div>
        <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow">
          <div className="text-center mb-3">
            <div className="text-6xl font-semibold text-gray-900 leading-none mb-2">{ch.c}</div>
            <div className="text-red-600 font-bold">{ch.pinyin}</div>
            <div className="text-sm text-gray-500">{ch.m} · {ch.n} trait{ch.n > 1 ? "s" : ""}</div>
          </div>
          <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">✏️ <b>Ordre :</b> {ch.tip}</div>
          <TracePad ch={ch.c} />
          <div className="flex gap-2 mt-3">
            <button onClick={() => setChIdx((i) => (i - 1 + CHARS.length) % CHARS.length)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 text-sm">← Précédent</button>
            <button onClick={() => setChIdx((i) => (i + 1) % CHARS.length)} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 text-sm">Suivant →</button>
          </div>
          {onDone && (
            <button onClick={() => onDone(100)} className="mt-3 w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow text-sm">✅ Valider (+8 XP)</button>
          )}
        </div>
      </div>
    </div>
  );
}

function BossChallenge({ lesson, onDone }) {
  const [runId, setRunId] = useState(0);
  const questions = useMemo(() => shuffle(ALL_QUIZ.filter((q) => q.lesson === lesson)).slice(0, 10), [lesson, runId]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => {
      setTimeLeft((s) => { if (s <= 1) { setFinished(true); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [finished]);

  const answer = (i) => {
    if (selected !== null || finished) return;
    setSelected(i);
    if (i === questions[current].answer) setScore((s) => s + 1);
    else noteMiss(questions[current].question);
  };

  const next = () => {
    if (current + 1 >= questions.length) setFinished(true);
    else { setCurrent((c) => c + 1); setSelected(null); }
  };

  if (finished) {
    const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const passed = pct >= 70;
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl border border-gray-200 bg-white shadow text-center">
        <div className="text-6xl mb-2">{passed ? "🏆" : "💪"}</div>
        <div className="text-4xl font-bold text-gray-900 mb-1">{score}/{questions.length}</div>
        <div className="text-sm text-gray-500 mb-4">Score : {pct}% · Seuil : 70%</div>
        {passed ? (
          <>
            <div className="text-green-700 font-bold mb-4">🎉 恭喜！Bravo !</div>
            {onDone && <button onClick={() => onDone(pct)} className="w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow">✅ Valider (+15 XP)</button>}
          </>
        ) : (
          <>
            <div className="text-gray-600 mb-4 text-sm">Révise et reviens ! 加油！</div>
            <button onClick={() => { setRunId((r) => r + 1); setCurrent(0); setSelected(null); setScore(0); setTimeLeft(120); setFinished(false); }} className="w-full py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700">🔁 Recommencer</button>
          </>
        )}
      </div>
    );
  }

  const q = questions[current];
  const answered = selected !== null;
  const timePct = (timeLeft / 120) * 100;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="text-gray-500">Question {current + 1} / {questions.length}</span>
        <span className={`font-bold ${timeLeft <= 20 ? "text-red-600" : "text-gray-700"}`}>⏱️ {timeLeft}s</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full mb-4">
        <div className={`h-2 rounded-full transition-all ${timeLeft <= 20 ? "bg-red-500" : "bg-gray-800"}`} style={{ width: timePct + "%" }} />
      </div>
      <div className="p-6 rounded-2xl border-2 border-amber-300 bg-amber-50 shadow">
        <div className="text-center text-xs font-bold text-amber-700 mb-3">🏆 DÉFI FINAL — LEÇON {lesson}</div>
        <div className="text-lg font-semibold text-gray-900 mb-5">{q.question}</div>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            let cls = "border-gray-200 bg-white hover:border-amber-500";
            if (answered) {
              if (i === q.answer) cls = "border-green-500 bg-green-50";
              else if (i === selected) cls = "border-red-400 bg-red-50";
              else cls = "border-gray-200 bg-white opacity-50";
            }
            return (<button key={i} onClick={() => answer(i)} disabled={answered} className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${cls}`}>{opt}</button>);
          })}
        </div>
        {answered && (
          <div className="mt-4">
            <div className={`text-sm font-bold mb-2 ${selected === q.answer ? "text-green-700" : "text-red-700"}`}>{selected === q.answer ? "✓ 对！" : `✗ Réponse : ${q.options[q.answer]}`}</div>
            <button onClick={next} className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800">
              {current + 1 >= questions.length ? "Résultat →" : "Suivant →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DefiEclair({ unlockedLessons, addXp }) {
  const pool = useMemo(() => ALL_QUIZ.filter((q) => unlockedLessons.includes(q.lesson)), [unlockedLessons]);
  const [status, setStatus] = useState("setup");
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef(null);
  const flashRef = useRef(null);
  const rewardRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (flashRef.current) clearTimeout(flashRef.current);
    };
  }, []);

  const start = () => {
    if (pool.length < 4) return;
    setQuestions(shuffle(pool));
    setCurrent(0); setSelected(null); setScore(0); setTimeLeft(60);
    rewardRef.current = false;
    setStatus("play");
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((s) => { if (s <= 1) { clearInterval(timerRef.current); setStatus("done"); return 0; } return s - 1; });
    }, 1000);
  };

  useEffect(() => {
    if (status === "done" && !rewardRef.current) {
      rewardRef.current = true;
      if (score > 0) addXp(score * 2);
    }
  }, [status, score, addXp]);

  if (status === "setup" || pool.length < 4) {
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl border-2 border-purple-300 bg-purple-50 shadow text-center">
        <div className="text-5xl mb-2">⚡</div>
        <h3 className="text-xl font-bold text-purple-900 mb-2">Défi éclair — 60 secondes !</h3>
        <p className="text-sm text-gray-600 mb-1">Questions sur les leçons débloquées : {unlockedLessons.join(", ")}.</p>
        <p className="text-sm text-gray-500 mb-4">+2 XP par bonne réponse</p>
        <button onClick={start} className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 shadow">Démarrer ⏱️</button>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="max-w-lg mx-auto p-6 rounded-2xl border border-gray-200 bg-white shadow text-center">
        <div className="text-5xl mb-2">{score >= 15 ? "🚀" : score >= 8 ? "👏" : "💪"}</div>
        <div className="text-4xl font-bold text-purple-700 mb-1">{score} bonnes réponses</div>
        <div className="text-sm text-gray-500 mb-4">+{score * 2} XP ⚡</div>
        <button onClick={start} className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700">Rejouer 🔁</button>
      </div>
    );
  }

  const q = questions[current] || questions[0];
  const answered = selected !== null;

  const answer = (i) => {
    if (answered) return;
    setSelected(i);
    if (i === q.answer) setScore((s) => s + 1);
    else noteMiss(q.question);
    flashRef.current = setTimeout(() => {
      if (current + 1 >= questions.length) setQuestions((old) => [...old, ...shuffle(pool).slice(0, 5)]);
      setCurrent((c) => c + 1);
      setSelected(null);
    }, 650);
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="text-gray-500">⚡ Score : {score}</span>
        <span className={`font-bold ${timeLeft <= 10 ? "text-red-600 animate-pulse" : "text-purple-700"}`}>⏱️ {timeLeft}s</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full mb-4">
        <div className={`h-2 rounded-full ${timeLeft <= 10 ? "bg-red-500" : "bg-purple-600"}`} style={{ width: (timeLeft / 60) * 100 + "%" }} />
      </div>
      <div className="p-6 rounded-2xl border-2 border-purple-300 bg-white shadow">
        <span className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 mb-3">Leçon {q.lesson} · {q.type}</span>
        <div className="text-lg font-semibold text-gray-900 mb-5">{q.question}</div>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            let cls = "border-gray-200 bg-white hover:border-purple-500";
            if (answered) {
              if (i === q.answer) cls = "border-green-500 bg-green-50";
              else if (i === selected) cls = "border-red-400 bg-red-50";
              else cls = "border-gray-200 bg-white opacity-50";
            }
            return (<button key={i} onClick={() => answer(i)} disabled={answered} className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${cls}`}>{opt}</button>);
          })}
        </div>
      </div>
    </div>
  );
}

function NodeButton({ node, st, unlocked, isNext, onClick }) {
  const stars = starsFor(st);
  let circleCls = "bg-white text-gray-700 border-gray-300";
  let icon = node.icon;
  if (st && st.done) { circleCls = "bg-green-500 text-white border-green-600"; }
  else if (!unlocked) { circleCls = "bg-gray-200 text-gray-400 border-gray-300"; icon = "🔒"; }
  else if (isNext) { circleCls = "bg-red-600 text-white border-red-700 ring-4 ring-red-200 animate-pulse"; }
  else { circleCls = "bg-red-50 text-red-600 border-red-300"; }
  return (
    <button onClick={unlocked ? onClick : undefined} disabled={!unlocked} className="flex flex-col items-center gap-1 shrink-0 group">
      <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-2xl shadow-sm transition-all ${circleCls} ${unlocked ? "hover:scale-110 cursor-pointer" : "cursor-not-allowed"}`}>
        {st && st.done ? "✅" : icon}
      </div>
      <div className="text-[10px] font-medium text-gray-600 w-16 text-center leading-tight">{node.label}</div>
      <div className="text-[10px]">{stars > 0 ? "⭐".repeat(stars) : unlocked ? <span className="text-gray-400">+{node.xp} XP</span> : ""}</div>
    </button>
  );
}

function Parcours({ progress, onLaunch }) {
  const nodeStateById = (id) => progress.nodes[id];
  const isDone = (id) => (progress.nodes[id] || {}).done;
  const nextIdx = NODES.findIndex((n) => !isDone(n.id));
  const nextNode = nextIdx >= 0 ? NODES[nextIdx] : null;
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return { zh: "早上好", py: "zǎoshang hǎo", e: "🌅" };
    if (h < 18) return { zh: "下午好", py: "xiàwǔ hǎo", e: "🌤️" };
    return { zh: "晚上好", py: "wǎnshàng hǎo", e: "🌙" };
  }, []);

  return (
    <div>
      <div className="mb-4 p-3 rounded-xl bg-white border border-gray-200 flex items-center gap-3 shadow-sm">
        <span className="text-2xl">{greeting.e}</span>
        <div>
          <span className="font-bold text-gray-900">{greeting.zh}</span>
          <span className="text-sm text-gray-400 ml-2">{greeting.py} !</span>
        </div>
      </div>
      {nextNode && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 text-white shadow flex items-center gap-3">
          <span className="text-3xl">{nextNode.icon}</span>
          <div className="flex-1">
            <div className="text-xs opacity-80">🎯 Prochaine étape</div>
            <div className="font-bold">Leçon {nextNode.lesson} · {nextNode.label} (+{nextNode.xp} XP)</div>
          </div>
          <button onClick={() => onLaunch(nextNode)} className="px-4 py-2 rounded-xl bg-white text-red-600 font-bold text-sm hover:bg-red-50">Commencer →</button>
        </div>
      )}
      {!nextNode && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow text-center">
          <div className="text-xl font-bold">👑 Parcours terminé !</div>
        </div>
      )}
      {ALL_LESSONS.map((l) => {
        const idxs = NODES.map((n, i) => ({ n, i })).filter((x) => x.n.lesson === l.id);
        const doneCount = idxs.filter((x) => isDone(x.n.id)).length;
        const pct = Math.round((doneCount / idxs.length) * 100);
        return (
          <div key={l.id} className="mb-5 p-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white font-bold flex items-center justify-center">{l.id}</div>
              <div className="flex-1">
                <div className="font-bold text-gray-900">{l.titre} · {l.zh}</div>
                <div className="text-xs text-gray-500">{l.pinyin} — {l.fr}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-700">{doneCount}/{idxs.length}</div>
                <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: pct + "%" }} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-2 pt-1">
              {idxs.map(({ n, i }, j) => (
                <React.Fragment key={n.id}>
                  {j > 0 && <div className={`h-1 w-6 md:w-10 rounded-full shrink-0 ${isDone(NODES[i - 1].id) ? "bg-green-400" : "bg-gray-300"}`} />}
                  <NodeButton node={n} st={nodeStateById(n.id)} unlocked={i === 0 || isDone(NODES[i - 1].id)} isNext={nextIdx === i} onClick={() => onLaunch(n)} />
                </React.Fragment>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PHRASES_DU_JOUR = [
  { zh: "我喝咖啡。", py: "Wǒ hē kāfēi.", fr: "Je bois du café." },
  { zh: "我家有五口人。", py: "Wǒ jiā yǒu wǔ kǒu rén.", fr: "Il y a cinq personnes dans ma famille." },
  { zh: "你是哪国人？", py: "Nǐ shì nǎ guó rén?", fr: "De quel pays es-tu ?" },
  { zh: "我有两个哥哥。", py: "Wǒ yǒu liǎng gè gēge.", fr: "J'ai deux grands frères." },
  { zh: "我爸爸是老师。", py: "Wǒ bàba shì lǎoshī.", fr: "Mon papa est professeur." },
  { zh: "很高兴认识你！", py: "Hěn gāoxìng rènshi nǐ!", fr: "Ravi de te connaître !" },
  { zh: "今天我学习汉语。", py: "Jīntiān wǒ xuéxí hànyǔ.", fr: "Aujourd'hui j'étudie le chinois." },
];

const SENTENCES = [
  { zh: "我喝咖啡。", py: "Wǒ hē kāfēi.", fr: "Je bois du café.", tokens: ["我", "喝", "咖啡"] },
  { zh: "我家有五口人。", py: "Wǒ jiā yǒu wǔ kǒu rén.", fr: "Ma famille compte cinq personnes.", tokens: ["我家", "有", "五", "口", "人"] },
  { zh: "你是哪国人？", py: "Nǐ shì nǎ guó rén?", fr: "De quelle nationalité es-tu ?", tokens: ["你", "是", "哪", "国", "人"] },
  { zh: "我有两个哥哥。", py: "Wǒ yǒu liǎng gè gēge.", fr: "J'ai deux grands frères.", tokens: ["我", "有", "两", "个", "哥哥"] },
  { zh: "我爸爸是老师。", py: "Wǒ bàba shì lǎoshī.", fr: "Mon papa est professeur.", tokens: ["我", "爸爸", "是", "老师"] },
  { zh: "很高兴认识你！", py: "Hěn gāoxìng rènshi nǐ!", fr: "Ravi de te connaître !", tokens: ["很", "高兴", "认识", "你"] },
];

const AVATARS = [
  { e: "中", price: 0, label: "Classique" },
  { e: "🐉", price: 10, label: "Dragon" },
  { e: "🐼", price: 15, label: "Panda" },
  { e: "🎓", price: 25, label: "Étudiant" },
  { e: "🥷", price: 40, label: "Ninja des tons" },
  { e: "🦁", price: 60, label: "Lion" },
  { e: "👑", price: 100, label: "Empereur" },
  { e: "❤️", price: 0, label: "Donateur (réservé)", donorOnly: true },
];

const PROF_TOPICS = [
  { keys: ["的", "de ", "possess"], title: "La particule 的 (de)", body: "的 marque la possession : 我的书 wǒ de shū = mon livre. Structure : possesseur + 的 + objet." },
  { keys: ["两", "二", "liang", "er ", " 2"], title: "两 ou 二 ?", body: "Deux chiffres : 二 èr et 两 liǎng. 两 se met devant un classificateur (两个哥哥). 二 sert à compter (2, 12, 22…)." },
  { keys: ["3e ton", "troisième ton", "sandhi", "ton 3", "ǎ"], title: "Le mystère du 3e ton", body: "Deux 3es tons qui se suivent → le premier devient 2e ton : 你好 nǐ hǎo se prononce ní hǎo." },
  { keys: ["不", "bu ", "bú"], title: "Le cas de 不 bù", body: "不 est au 4e ton (bù), mais devant un autre 4e ton il passe au 2e ton : 不是 bú shì, 不客气 bú kèqi." },
  { keys: ["j q", "q x", "ju", "qu", "xu", "ü", "u "], title: "j, q, x + le ü déguisé", body: "Après j, q, x, la voyelle ü s'écrit u (mais se prononce ü !) : 去 qù, 居 jū." },
  { keys: ["儿", "er ", "rétroflex"], title: "Le 儿 (er) rétroflexe", body: "哪儿 nǎr (où) : la finale 儿 fait recourber la langue vers le haut." },
  { keys: ["classificateur", "口", "个", "本", "measure"], title: "Les classificateurs 口 · 个 · 本", body: "个 gè = général. 口 kǒu = famille (家有三口人). 本 běn = objets plats (livres)." },
  { keys: ["几", "ji ", "combien"], title: "几 (jǐ) — combien ?", body: "几 jǐ = « combien » pour les petits nombres (moins de 10) : 你家有几口人？" },
  { keys: ["有", "没", "yǒu", "avoir"], title: "有 yǒu et 没有 méiyǒu", body: "有 yǒu = avoir ; négation 没有 : 我没有哥哥 wǒ méiyǒu gēge." },
  { keys: ["哪国人", "nationalité", "pays"], title: "Les nationalités", body: "Formule : pays + 人 rén = habitant. 中国 → 中国人. 科特迪瓦 → 科特迪瓦人 !" },
  { keys: ["你好", "bonjour", "salut", "salutation"], title: "Bien saluer en chinois", body: "你好 nǐ hǎo = bonjour. 您好 nín hǎo = respect. 老师好 lǎoshī hǎo = bonjour professeur." },
];

function offlineProfAnswer(q) {
  const s = " " + q.toLowerCase() + " ";
  let best = null;
  let bestHits = 0;
  for (const t of PROF_TOPICS) {
    let hits = 0;
    for (const k of t.keys) if (s.includes(k.toLowerCase())) hits++;
    if (hits > bestHits) { best = t; bestHits = hits; }
  }
  if (best) return "📘 **" + best.title + "**\n\n" + best.body + "\n\n_As-tu une autre question ? Essaie : 的 · 两/二 · les tons · j q x · classificateurs…_";
  return "🧑‍🏫 Je suis le professeur hors-ligne : je connais par cœur tes leçons HSK 1.\n\n💡 Pour des réponses illimitées, ajoute ta clé API Gemini (bouton ⚙️).";
}

const PROF_SYSTEM_PROMPT =
  "Tu es 李老师 (Professeur Li), un professeur de chinois chaleureux et patient pour un débutant HSK 1 (niveau A1) vivant en Côte d'Ivoire. Règles : réponds toujours en français ; utilise le chinois avec le pinyin pour chaque exemple ; reste concis (max 150 mots) ; encourage l'élève (加油 !) ; corrige ses erreurs avec bienveillance ; ne dépasse jamais le niveau HSK 1 sauf si l'élève demande explicitement plus.";

function Express({ addXp, addCoins, unlockedLessons }) {
  const [phase, setPhase] = useState("intro");
  const [ci, setCi] = useState(0);
  const [qi, setQi] = useState(0);
  const [sel, setSel] = useState(null);
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(0);

  const cards = useMemo(() => shuffle(ALL_VOCAB.filter((v) => unlockedLessons.includes(v.lesson))).slice(0, 4), [unlockedLessons]);
  const questions = useMemo(() => shuffle(ALL_QUIZ.filter((q) => unlockedLessons.includes(q.lesson))).slice(0, 3), [unlockedLessons]);
  const phrase = useMemo(() => PHRASES_DU_JOUR[Math.floor(Math.random() * PHRASES_DU_JOUR.length)], []);

  useEffect(() => {
    if (phase === "done") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const start = () => { setSeconds(0); setPhase("cards"); };
  const answerQuiz = (i) => { if (sel != null) return; setSel(i); if (i === questions[qi].answer) setScore((s) => s + 1); };
  const nextQuiz = () => { setSel(null); if (qi + 1 < questions.length) setQi(qi + 1); else setPhase("phrase"); };
  const finish = () => { setPhase("done"); addXp(8); addCoins(3); };
  const fmt = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

  return (
    <div className="p-5 rounded-2xl border border-teal-200 bg-teal-50">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">⏱️ Session express · 5 minutes</h3>
          <p className="text-xs text-gray-500">4 mots, 3 questions, 1 phrase</p>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-white border border-teal-300 font-mono font-bold text-teal-700">⏳ {fmt(seconds)}</div>
      </div>
      {phase === "intro" && (
        <div className="text-center py-6">
          <div className="text-5xl mb-3">⚡</div>
          <p className="text-sm text-gray-600 mb-5 max-w-md mx-auto">Mini-session express. <b>8 XP + 3 🪙</b></p>
          <button onClick={start} className="px-6 py-3 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 shadow">C'est parti ! →</button>
        </div>
      )}
      {phase === "cards" && cards[ci] && (
        <div className="text-center py-4">
          <div className="text-xs text-teal-600 mb-2">Mot {ci + 1} / {cards.length}</div>
          <div className="text-6xl font-bold text-gray-900 my-3">{cards[ci].hanzi}</div>
          <div className="text-lg text-teal-700 font-medium">{cards[ci].pinyin}</div>
          <div className="text-sm text-gray-500 italic mb-5">{cards[ci].fr}</div>
          <div className="flex justify-center gap-3">
            <EcouterBtn text={cards[ci].hanzi} />
            <button onClick={() => { if (ci + 1 < cards.length) setCi(ci + 1); else setPhase("quiz"); }} className="px-5 py-1.5 rounded-full bg-teal-600 text-white text-xs font-bold hover:bg-teal-700">Je le savais ✓ →</button>
            <button onClick={() => { if (ci + 1 < cards.length) setCi(ci + 1); else setPhase("quiz"); }} className="px-5 py-1.5 rounded-full bg-white border border-gray-300 text-gray-500 text-xs hover:bg-gray-100">À revoir ⟲</button>
          </div>
        </div>
      )}
      {phase === "quiz" && questions[qi] && (
        <div className="py-2">
          <div className="text-xs text-teal-600 mb-2">Question {qi + 1} / {questions.length}</div>
          <div className="font-semibold text-gray-900 mb-3">{questions[qi].question}</div>
          <div className="grid md:grid-cols-2 gap-2">
            {questions[qi].options.map((opt, i) => (
              <button key={i} onClick={() => answerQuiz(i)} className={`p-2.5 rounded-xl border text-sm text-left transition-colors ${sel == null ? "bg-white border-gray-300 hover:border-teal-500" : i === questions[qi].answer ? "bg-green-100 border-green-500" : i === sel ? "bg-red-100 border-red-400" : "bg-white border-gray-200 opacity-60"}`}>{opt}</button>
            ))}
          </div>
          {sel != null && (
            <div className="mt-3 flex items-center justify-between">
              <span className={`text-sm font-bold ${sel === questions[qi].answer ? "text-green-600" : "text-red-600"}`}>{sel === questions[qi].answer ? "✓ Correct !" : "✗ La bonne réponse était en vert"}</span>
              <button onClick={nextQuiz} className="px-4 py-1.5 rounded-full bg-teal-600 text-white text-xs font-bold hover:bg-teal-700">Suivant →</button>
            </div>
          )}
        </div>
      )}
      {phase === "phrase" && (
        <div className="text-center py-4">
          <div className="text-xs text-teal-600 mb-2">Phrase du jour</div>
          <div className="text-4xl font-bold text-gray-900 my-3">{phrase.zh}</div>
          <div className="text-lg text-teal-700 font-medium">{phrase.py}</div>
          <div className="text-sm text-gray-500 italic mb-4">{phrase.fr}</div>
          <div className="flex justify-center"><EcouterBtn text={phrase.zh} /></div>
          <button onClick={finish} className="mt-5 px-6 py-2.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 shadow">Terminer 🎉</button>
        </div>
      )}
      {phase === "done" && (
        <div className="text-center py-6">
          <div className="text-5xl mb-3">🏆</div>
          <div className="text-lg font-bold text-gray-900 mb-1">Terminée en {fmt(seconds)} !</div>
          <div className="text-sm text-gray-600 mb-2">Score : {score}/{questions.length}</div>
          <div className="text-sm font-bold text-teal-700">+8 XP · +3 🪙</div>
        </div>
      )}
    </div>
  );
}

function MemoryGame({ onWin }) {
  const [round, setRound] = useState(0);
  const deck = useMemo(() => {
    const picks = shuffle(ALL_VOCAB).slice(0, 6);
    const cards = picks.flatMap((v) => [
      { id: v.hanzi + "-h", kind: "h", text: v.hanzi, match: v.hanzi },
      { id: v.hanzi + "-p", kind: "p", text: v.pinyin, match: v.hanzi },
    ]);
    return shuffle(cards);
  }, [round]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState(0);
  const won = deck.length > 0 && matched.length === deck.length;

  useEffect(() => { if (won) onWin(moves); }, [won]);

  const click = (i) => {
    if (busy || flipped.includes(i) || matched.includes(deck[i].id)) return;
    const nf = [...flipped, i];
    setFlipped(nf);
    if (nf.length === 2) {
      setMoves((m) => m + 1);
      setBusy(true);
      const [a, b] = nf;
      if (deck[a].match === deck[b].match && deck[a].kind !== deck[b].kind) {
        setTimeout(() => { setMatched((mm) => [...mm, deck[a].id, deck[b].id]); setFlipped([]); setBusy(false); }, 450);
      } else {
        setTimeout(() => { setFlipped([]); setBusy(false); }, 800);
      }
    }
  };

  return (
    <div>
      {won ? (
        <div className="text-center py-5">
          <div className="text-4xl mb-2">🎉</div>
          <div className="font-bold text-gray-800">Toutes les paires en {moves} coups !</div>
          <button onClick={() => { setFlipped([]); setMatched([]); setMoves(0); setRound((r) => r + 1); }} className="mt-3 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600">Nouveau plateau 🔄</button>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3">Retrouve chaque caractère et son pinyin. Coups : {moves}</p>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {deck.map((c, i) => {
              const show = flipped.includes(i) || matched.includes(c.id);
              return (
                <button key={c.id + i} onClick={() => click(i)} className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${show ? c.kind === "h" ? "bg-white border-amber-400" : "bg-amber-50 border-amber-300" : "bg-gray-800 border-gray-700 hover:border-amber-400"}`}>
                  {show ? (
                    <>
                      <span className={c.kind === "h" ? "text-2xl font-bold text-gray-900" : "text-sm font-semibold text-amber-800"}>{c.text}</span>
                      <span className="text-[10px] text-gray-400 mt-1">{c.kind === "h" ? "汉字" : "pinyin"}</span>
                    </>
                  ) : (
                    <span className="text-2xl text-amber-500/60">中</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MatchGame({ onWin }) {
  const [round, setRound] = useState(0);
  const pairs = useMemo(() => shuffle(ALL_VOCAB).slice(0, 5), [round]);
  const [left, setLeft] = useState(null);
  const [found, setFound] = useState([]);
  const [wrong, setWrong] = useState(null);
  const right = useMemo(() => shuffle(pairs.map((p) => p.hanzi)), [pairs]);
  const done = found.length === pairs.length;

  useEffect(() => { if (done) onWin(pairs.length); }, [done]);

  const tryMatch = (h) => {
    if (left == null || found.includes(h)) return;
    if (left.hanzi === h) { setFound((f) => [...f, h]); setLeft(null); }
    else { setWrong(h); setTimeout(() => { setWrong(null); setLeft(null); }, 500); }
  };

  return (
    <div>
      {done ? (
        <div className="text-center py-5">
          <div className="text-4xl mb-2">🎉</div>
          <div className="font-bold text-gray-800">Trouvé !</div>
          <button onClick={() => { setLeft(null); setFound([]); setRound((r) => r + 1); }} className="mt-3 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600">Nouveau tour 🔄</button>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3">Clique un mot (gauche), puis son pinyin (droite). {found.length}/{pairs.length}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              {pairs.map((p) => (
                <button key={p.hanzi} onClick={() => setLeft(found.includes(p.hanzi) ? null : p)} disabled={found.includes(p.hanzi)} className={`w-full p-2.5 rounded-xl border-2 text-lg font-bold ${found.includes(p.hanzi) ? "bg-green-100 border-green-400 text-green-700 line-through" : left && left.hanzi === p.hanzi ? "bg-white border-amber-500 shadow" : "bg-white border-gray-300 hover:border-amber-400"}`}>{p.hanzi}</button>
              ))}
            </div>
            <div className="space-y-2">
              {right.map((h) => {
                const v = pairs.find((p) => p.hanzi === h);
                return (
                  <button key={h} onClick={() => tryMatch(h)} disabled={found.includes(h)} className={`w-full p-2.5 rounded-xl border-2 text-sm font-medium ${found.includes(h) ? "bg-green-100 border-green-400 text-green-700 line-through" : wrong === h ? "bg-red-100 border-red-400" : "bg-white border-gray-300 hover:border-amber-400"}`}>{v.pinyin}</button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SentenceGame({ onWin }) {
  const [round, setRound] = useState(0);
  const s = useMemo(() => SENTENCES[Math.floor(Math.random() * SENTENCES.length)], [round]);
  const scrambled = useMemo(() => shuffle(s.tokens), [s]);
  const [built, setBuilt] = useState([]);
  const [checked, setChecked] = useState(null);
  const used = (i) => built.includes(i);

  const reset = () => { setBuilt([]); setChecked(null); setRound((r) => r + 1); };
  const check = () => {
    const ok = built.length === s.tokens.length && built.every((bi, k) => scrambled[bi] === s.tokens[k]);
    setChecked(ok);
    if (ok) onWin(s.tokens.length);
  };

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">Reconstitue la phrase :</p>
      <div className="font-semibold text-gray-900 mb-1">{s.fr}</div>
      <div className="text-xs text-indigo-600 mb-3">{s.py}</div>
      <div className="min-h-12 p-2 mb-3 rounded-xl border-2 border-dashed flex flex-wrap gap-2 items-center bg-white">
        {built.length === 0 && <span className="text-xs text-gray-300">Clique les mots ci-dessous…</span>}
        {built.map((bi, pos) => (
          <button key={pos} onClick={() => setBuilt(built.filter((_, k) => k !== pos))} className={`px-3 py-1.5 rounded-lg text-lg font-bold border-2 ${checked == null ? "bg-amber-50 border-amber-400 hover:bg-red-50" : checked ? "bg-green-100 border-green-500" : "bg-red-100 border-red-400"}`}>{scrambled[bi]}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {scrambled.map((t, i) => (
          <button key={i} disabled={used(i)} onClick={() => { setBuilt([...built, i]); setChecked(null); }} className={`px-3 py-1.5 rounded-lg border-2 text-lg font-bold ${used(i) ? "bg-gray-100 border-gray-200 text-gray-300" : "bg-white border-gray-300 hover:border-amber-500"}`}>{t}</button>
        ))}
      </div>
      {checked === true && (
        <div className="text-center">
          <div className="font-bold text-green-600 mb-2">🎉 完美 ! {s.zh}</div>
          <button onClick={reset} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600">Phrase suivante 🔄</button>
        </div>
      )}
      {checked === false && (
        <div className="text-center">
          <div className="text-sm text-red-600 font-bold mb-2">Presque ! Sujet → verbe → reste</div>
          <button onClick={() => { setBuilt([]); setChecked(null); }} className="px-4 py-2 rounded-xl bg-gray-800 text-white text-sm font-bold hover:bg-gray-900">Réessayer</button>
        </div>
      )}
      {checked == null && (
        <div className="text-center">
          <button onClick={check} disabled={built.length !== s.tokens.length} className="px-5 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-40">Vérifier ✓</button>
        </div>
      )}
    </div>
  );
}

function Boutique({ progress, buyAvatar }) {
  const owned = progress.owned || [];
  return (
    <div className="p-5 rounded-2xl border border-yellow-300 bg-yellow-50">
      <h3 className="font-bold text-gray-800 mb-1">🛍️ Boutique</h3>
      <p className="text-xs text-gray-500 mb-4">Ton avatar s'affiche dans l'en-tête. L'avatar ❤️ est réservé aux donateurs.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {AVATARS.map((a) => {
          const isOwned = a.e === "中" || owned.includes(a.e) || (a.donorOnly && progress.donor);
          const equipped = (progress.avatar || "中") === a.e;
          return (
            <button key={a.e} onClick={() => { if (!isOwned && !a.donorOnly) buyAvatar(a.e, a.price); }} disabled={!isOwned && a.donorOnly} className={`p-3 rounded-xl border-2 text-center transition-colors ${equipped ? "bg-red-600 border-red-600 text-white" : isOwned ? "bg-white border-green-400 hover:border-red-500" : a.donorOnly ? "bg-gray-100 border-gray-200 text-gray-400" : "bg-white border-gray-300 hover:border-yellow-500"}`}>
              <div className="text-3xl">{a.e}</div>
              <div className="text-xs font-bold mt-1">{a.label}</div>
              <div className="text-[10px] mt-0.5">{equipped ? "✓ porté" : isOwned ? "cliquer" : a.donorOnly ? "réservé donateur" : "🪙 " + a.price}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Jeux({ progress, addXp, addCoins, buyAvatar }) {
  const [game, setGame] = useState("memory");
  const [toasts, setToasts] = useState([]);
  const rewarded = useRef({});

  const reward = (key, label, coins, xp) => {
    if (rewarded.current[key]) return;
    rewarded.current[key] = true;
    addCoins(coins);
    addXp(xp);
    const id = key + "-" + Math.random();
    setToasts((t) => [...t, { id, label }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <h3 className="text-lg font-bold text-gray-900 mr-auto">🎮 Jeux éducatifs</h3>
        <div className="px-3 py-1.5 rounded-xl bg-yellow-100 border border-yellow-300 text-sm font-bold text-yellow-700">🪙 {progress.coins || 0}</div>
        <div className="px-3 py-1.5 rounded-xl bg-rose-100 border border-rose-300 text-sm font-bold text-rose-700">🤝 Cagnotte : {progress.pot || 0}</div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[["memory", "🀄 Memory"], ["match", "连连 · relie pinyin"], ["sentence", "🧩 Reconstruis"]].map(([id, label]) => (
          <button key={id} onClick={() => setGame(id)} className={`px-3 py-2 rounded-xl text-sm font-medium ${game === id ? "bg-amber-500 text-white shadow" : "bg-white border border-gray-300 text-gray-600 hover:border-amber-400"}`}>{label}</button>
        ))}
      </div>
      <div className="mb-4 p-5 rounded-2xl border border-gray-200 bg-white shadow-sm">
        {game === "memory" && <MemoryGame onWin={(m) => reward("mem-" + Date.now(), "🀄 Memory réussi ! +2 🪙 +3 XP", 2, 3)} />}
        {game === "match" && <MatchGame onWin={() => reward("match-" + Date.now(), "连连 réussi ! +2 🪙 +3 XP", 2, 3)} />}
        {game === "sentence" && <SentenceGame onWin={() => reward("sent-" + Date.now(), "🧩 Phrase parfaite ! +1 🪙 +2 XP", 1, 2)} />}
      </div>
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (<div key={t.id} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold shadow-lg animate-pulse">{t.label}</div>))}
      </div>
      <Boutique progress={progress} buyAvatar={buyAvatar} />
    </div>
  );
}

function ProfIA({ progress, aiUsedToday, registerAI }) {
  const [key, setKey] = useState(() => {
    try { return localStorage.getItem(GEMINI_KEY_STORE) || ""; } catch (e) { return ""; }
  });
  const [showKey, setShowKey] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: "prof", text: "🧑‍🏫 你好！Je suis 李老师, ton professeur IA. Pose-moi toutes tes questions sur le chinois HSK 1 ! 加油！" },
  ]);
  const chatEndRef = useRef(null);
  const freeQuota = getSettings().aiFreePerDay || FREE_AI_PER_DAY;
  const limitReached = !progress.donor && aiUsedToday >= freeQuota;

  const scrollToBottom = () => { try { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" }); } catch (e) {} };

  const send = async (textArg) => {
    const text = (textArg != null ? textArg : draft).trim();
    if (!text || busy) return;
    if (limitReached) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setDraft("");
    setBusy(true);
    setTimeout(scrollToBottom, 50);

    let reply = null;
    if (key.trim()) {
      try {
        const history = messages.slice(-8).map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.text }],
        }));
        const replyText = await callGeminiWithFallback(
          {
            system_instruction: { parts: [{ text: PROF_SYSTEM_PROMPT }] },
            contents: [...history, { role: "user", parts: [{ text }] }],
          },
          key.trim(),
          false
        );
        if (replyText) reply = replyText;
      } catch (e) { reply = null; }
    }
    if (!reply) reply = offlineProfAnswer(text);

    registerAI();
    setMessages((m) => [...m, { role: "prof", text: reply }]);
    setBusy(false);
    setTimeout(scrollToBottom, 50);
  };

  const quick = ["Explique la particule 的", "两 ou 二 : quelle différence ?", "Le 3e ton, je comprends rien !", "j q x et le ü", "Classificateurs 个 口 本", "Corrige : wǒ shì xueshēng"];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50 flex flex-wrap items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-indigo-600 text-white text-2xl flex items-center justify-center">🧑‍🏫</div>
        <div className="flex-1">
          <div className="font-bold text-gray-900">李老师 · Professeur IA</div>
          <div className="text-xs text-gray-500">
            {progress.donor ? (<span className="text-rose-600 font-bold">❤️ Premium — illimité</span>) : (<span>Restantes : <b>{Math.max(0, freeQuota - aiUsedToday)} / {freeQuota}</b></span>)}
          </div>
        </div>
        <button onClick={() => setShowKey((s) => !s)} className="px-3 py-1.5 rounded-full bg-white border border-indigo-300 text-xs font-medium text-indigo-700 hover:bg-indigo-100">⚙️ Clé API {key ? "✓" : ""}</button>
      </div>
      {showKey && (
        <div className="p-4 rounded-2xl border border-gray-300 bg-white text-sm">
          <p className="text-gray-600 mb-2">Colle ta clé API <b>Google Gemini</b> (gratuite sur aistudio.google.com).</p>
          <div className="flex gap-2">
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza..." className="flex-1 px-3 py-2 rounded-xl border border-gray-300 font-mono text-xs" />
            <button onClick={() => { try { localStorage.setItem(GEMINI_KEY_STORE, key.trim()); } catch (e) {} setShowKey(false); }} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">Enregistrer</button>
          </div>
        </div>
      )}
      <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-sm space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-red-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>{m.text}</div>
          </div>
        ))}
        {busy && (<div className="flex justify-start"><div className="px-4 py-2.5 rounded-2xl bg-gray-100 text-sm text-gray-500">李老师 réfléchit… ✍️</div></div>)}
        <div ref={chatEndRef} />
      </div>
      {limitReached && (
        <div className="p-4 rounded-2xl border border-rose-300 bg-rose-50 text-sm text-rose-800">🎓 Quota gratuit atteint ({freeQuota}/jour). Passe en <b>Premium ❤️</b> (onglet Fondation).</div>
      )}
      <div className="flex flex-wrap gap-2">
        {quick.map((q) => (
          <button key={q} onClick={() => send(q)} disabled={busy || limitReached} className="px-3 py-1.5 rounded-full bg-white border border-gray-300 text-xs text-gray-600 hover:border-indigo-500 hover:text-indigo-600 disabled:opacity-40">{q}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Pose ta question…" className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-sm focus:border-indigo-500 outline-none" />
        <button onClick={() => send()} disabled={busy || limitReached || !draft.trim()} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-40">Envoyer →</button>
      </div>
    </div>
  );
}

function Don({ progress, setDonor, addDonation, donateCoins }) {
  const waveLink = (() => {
    try { return localStorage.getItem(WAVE_LINK_STORE) || WAVE_DEFAULT_LINK; } catch (e) { return WAVE_DEFAULT_LINK; }
  })();
  const [form, setForm] = useState({ ref: "", nom: "", wave: "", whatsapp: "", montant: "" });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const freeQuota = getSettings().aiFreePerDay || FREE_AI_PER_DAY;
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    if (!form.ref.trim() || !form.nom.trim() || !form.wave.trim() || !form.montant.trim()) {
      setErr("Remplis tous les champs (WhatsApp optionnel).");
      return;
    }
    if (!(Number(form.montant) > 0)) { setErr("Le montant doit être positif."); return; }
    setErr("");
    const donation = {
      transaction_ref: form.ref.trim(),
      full_name: form.nom.trim(),
      wave_number: form.wave.trim(),
      whatsapp: form.whatsapp.trim(),
      amount_fcfa: Number(form.montant),
      status: "pending",
    };
    addDonation({
      ref: form.ref.trim(),
      nom: form.nom.trim(),
      wave: form.wave.trim(),
      whatsapp: form.whatsapp.trim(),
      montant: Number(form.montant),
      date: todayKey(),
      statut: "en attente de vérification",
    });
    const res = await saveDonationToCloud(donation);
    if (!res.ok) console.warn("Don non envoyé au cloud :", res.error);
    setDonor(true);
    setSent(true);
  };

  return (
    <div className="space-y-4">
      <div className="p-6 rounded-2xl bg-gradient-to-r from-rose-600 via-red-500 to-orange-500 text-white shadow relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <img
            src="/vie-foundation-logo.png"
            alt="VIE Foundation"
            className="w-24 h-24 md:w-32 md:h-32 object-contain rounded-full shadow-2xl shrink-0 bg-white p-1"
            onError={(e) => { e.target.style.display = "none"; }}
          />
          <div className="flex-1">
            <div className="text-xs font-bold tracking-widest opacity-80 mb-1">🌍 VIE FOUNDATION</div>
            <h3 className="text-xl md:text-2xl font-bold mb-2">❤️ Sauvons Nos Vies</h3>
            <p className="text-sm opacity-90 mb-3 italic">« Chaque action compte. Chaque vie mérite un futur. »</p>
            <p className="text-sm opacity-90">
              YǔLù 语路 est <b>gratuit</b>. Propulsé par <b>Kimatey Enterprise</b>, l'app reverse
              <b> 15% de son chiffre d'affaires</b> au programme <b>Sauvons Nos Vies</b>. Ton don amplifie cette force collective.
            </p>
          </div>
        </div>
      </div>
      <div className="p-5 rounded-2xl border border-rose-200 bg-white shadow-sm">
        <h4 className="font-bold text-gray-900 mb-3">🌟 Premium donateur</h4>
        <ul className="text-sm text-gray-600 space-y-1.5 mb-4">
          <li>🧑‍🏫 Professeur IA <b>illimité</b> (au lieu de {freeQuota}/jour)</li>
          <li>❤️ Avatar exclusif « Donateur »</li>
          <li>🏆 Badge « Donateur · Fondation »</li>
          <li>☁️ Sauvegarde cloud de ta progression</li>
        </ul>
        <div className="p-4 rounded-xl border-2 border-cyan-300 bg-cyan-50 mb-4">
          <div className="flex items-center gap-2 mb-2"><span className="text-2xl">🌊</span><b>Étape 1 — Fais ton don avec Wave</b></div>
          <a href={waveLink} target="_blank" rel="noreferrer" className="inline-block px-5 py-2.5 rounded-xl bg-cyan-500 text-white font-bold hover:bg-cyan-600">🌊 Faire mon don →</a>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
          <b className="text-sm text-gray-900">Étape 2 — Enregistre ton don</b>
          <div className="grid md:grid-cols-2 gap-2 mt-2">
            <input value={form.ref} onChange={setF("ref")} placeholder="N° transaction Wave" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <input value={form.nom} onChange={setF("nom")} placeholder="Nom & prénoms" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <input value={form.wave} onChange={setF("wave")} placeholder="N° Wave" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <input value={form.whatsapp} onChange={setF("whatsapp")} placeholder="WhatsApp" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <input value={form.montant} onChange={setF("montant")} placeholder="Montant (FCFA)" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
          </div>
          {err && <div className="text-xs text-red-600 mt-2">{err}</div>}
          {!sent ? (<button onClick={submit} className="mt-3 w-full py-2.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700">✅ J'ai payé — activer premium</button>) : (<div className="mt-3 p-3 rounded-xl bg-green-100 border border-green-400 text-sm text-green-800">❤️ Merci {form.nom} ! Ton don de <b>{form.montant} FCFA</b> est enregistré.</div>)}
        </div>
      </div>
      <div className="p-5 rounded-2xl border border-yellow-300 bg-yellow-50">
        <h4 className="font-bold text-gray-900 mb-1">🤝 Cagnotte collective</h4>
        <p className="text-xs text-gray-500 mb-3">20% de chaque pièce va à la cagnotte.</p>
        <div className="flex items-center gap-4">
          <div className="text-center px-4 py-2 rounded-xl bg-white border border-yellow-300">
            <div className="text-2xl font-bold text-yellow-600">🤝 {progress.pot || 0}</div>
            <div className="text-[10px] text-yellow-700">cagnotte</div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-white border border-yellow-300">
            <div className="text-2xl font-bold text-yellow-700">🪙 {progress.coins || 0}</div>
            <div className="text-[10px] text-yellow-700">tes pièces</div>
          </div>
          <button onClick={() => donateCoins(10)} disabled={(progress.coins || 0) < 10} className="px-4 py-2 rounded-xl bg-yellow-500 text-white text-sm font-bold hover:bg-yellow-600 disabled:opacity-40">Offrir 10 🪙 →</button>
        </div>
      </div>
    </div>
  );
}

function Prononciation({ addXp, addCoins, unlockedLessons }) {
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const [lessonFilter, setLessonFilter] = useState("all");
  const pool = useMemo(() => shuffle(ALL_VOCAB.filter((v) => (lessonFilter === "all" ? unlockedLessons.includes(v.lesson) : v.lesson === lessonFilter))).slice(0, 20), [lessonFilter, unlockedLessons]);
  const [idx, setIdx] = useState(0);
  const target = pool[idx] || ALL_VOCAB[0];
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState(null);
  const [hist, setHist] = useState(getPronHist());

  const normalize = (s) => String(s || "").replace(/[。！？，、？！.,!?…]/g, "").replace(/\s/g, "").trim();
  const similarity = (a, b) => {
    const A = normalize(a); const B = normalize(b);
    if (!A || !B) return 0;
    if (A === B) return 100;
    const setB = new Set(B.split(""));
    let hits = 0;
    for (const ch of A.split("")) if (setB.has(ch)) hits++;
    return Math.round((hits / Math.max(A.length, B.length)) * 100);
  };

  const start = () => {
    if (!SR || !target) return;
    try {
      const rec = new SR();
      rec.lang = "zh-CN";
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      rec.onresult = (e) => {
        const res = e.results[0];
        let best = 0;
        let bestText = "";
        for (let k = 0; k < res.length; k++) {
          const heard = res[k].transcript;
          let sc = similarity(heard, target.hanzi);
          if (target.pinyin) {
            const cleanPinyin = target.pinyin.toLowerCase().replace(/[\s\d[\]·]/g, "");
            const cleanHeard = heard.toLowerCase().replace(/[\s\d[\]·]/g, "");
            if (cleanHeard && cleanPinyin && (cleanHeard.includes(cleanPinyin) || cleanPinyin.includes(cleanHeard))) sc = Math.max(sc, 85);
          }
          if (sc > best) { best = sc; bestText = heard; }
        }
        if (best > 0 && best < 60 && target.hanzi.length >= 2) {
          const half = target.hanzi.slice(0, Math.ceil(target.hanzi.length / 2));
          if (similarity(bestText, half) >= 70) best = Math.round(best * 1.25);
        }
        const entry = recordPron(target.hanzi, best);
        setHist(getPronHist());
        setResult({ heard: bestText, score: best, entry });
        setListening(false);
        if (best >= 70) { addXp(3); addCoins(1); }
        else if (best >= 50) { addXp(1); }
      };
      rec.onerror = (e) => { console.warn("Erreur :", e.error); setListening(false); };
      rec.onend = () => setListening(false);
      setResult(null);
      setListening(true);
      rec.start();
    } catch (e) { setListening(false); }
  };

  const nextWord = () => { setResult(null); setIdx((i) => (i + 1) % pool.length); };

  if (!SR) {
    return (
      <div className="p-6 rounded-2xl border border-amber-300 bg-amber-50 text-center">
        <div className="text-4xl mb-2">🎙️</div>
        <h3 className="font-bold text-gray-800 mb-1">Prononciation corrigée</h3>
        <p className="text-sm text-gray-600">Nécessite <b>Chrome, Edge ou Android récent</b>.</p>
      </div>
    );
  }

  const e = result ? result.entry : hist[target.hanzi];
  const stars = result ? (result.score >= 90 ? 3 : result.score >= 70 ? 2 : result.score >= 40 ? 1 : 0) : 0;
  const improvement = e && e.first != null && e.tries > 1 ? Math.round(e.last - e.first) : null;

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl border border-green-200 bg-green-50">
        <h3 className="text-lg font-bold text-gray-800 mb-2">🗣️ Prononce & sois corrigé</h3>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[["all", "Toutes mes leçons"], ...ALL_LESSONS.filter((l) => unlockedLessons.includes(l.id)).map((l) => [l.id, l.titre])].map(([id, label]) => (
            <button key={id} onClick={() => { setLessonFilter(id); setIdx(0); setResult(null); }} className={`px-3 py-1 rounded-full text-xs ${lessonFilter === id ? "bg-green-600 text-white" : "bg-white border border-gray-300 text-gray-600"}`}>{label}</button>
          ))}
        </div>
        {target && (
          <div className="p-5 rounded-xl bg-white border border-green-200 text-center">
            <div className="text-6xl font-bold text-gray-900 my-2">{target.hanzi}</div>
            <div className="text-lg text-green-700 font-medium">{target.pinyin}</div>
            <div className="text-sm text-gray-500 italic mb-4">{target.fr}</div>
            <div className="flex justify-center gap-2 mb-5">
              <EcouterBtn text={target.hanzi} />
              <EcouterBtn text={target.hanzi} slow label="lentement" />
            </div>
            <button onClick={start} disabled={listening} className={`px-8 py-3 rounded-full text-white font-bold shadow transition-all ${listening ? "bg-red-500 animate-pulse" : "bg-green-600 hover:bg-green-700"}`}>
              {listening ? "🎙️ Je t'écoute… parle !" : "🎙️ Prononcer maintenant"}
            </button>
            {result && (
              <div className="mt-5 text-left p-4 rounded-xl border-2 border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">🗣️ Entendu : <b>{result.heard || "…"}</b></span>
                  <span className={`text-2xl font-bold ${result.score >= 70 ? "text-green-600" : result.score >= 40 ? "text-amber-500" : "text-red-500"}`}>{result.score}%</span>
                </div>
                <div className="text-2xl mb-2">{"⭐".repeat(stars) || "💪"}</div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full ${result.score >= 70 ? "bg-green-500" : result.score >= 40 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: result.score + "%" }} />
                </div>
                <div className="text-xs text-gray-600">
                  {result.score >= 90 ? "🎉 完美！Parfait ! +3 XP +1 🪙"
                    : result.score >= 70 ? "✓ Bien prononcé ! +3 XP +1 🪙"
                    : result.score >= 50 ? "👍 Pas mal ! +1 XP"
                    : result.score >= 40 ? "🔍 Presque ! Réécoute le modèle lentement."
                    : "😅 Le mot entendu est très différent."}
                  {improvement != null && (
                    <div className={`mt-1 font-bold ${improvement >= 0 ? "text-green-600" : "text-red-500"}`}>{improvement >= 0 ? "📈" : "📉"} {improvement >= 0 ? "+" : ""}{improvement}% depuis la 1re tentative</div>
                  )}
                </div>
              </div>
            )}
            <button onClick={nextWord} className="mt-4 px-5 py-2 rounded-xl bg-gray-800 text-white text-sm font-bold hover:bg-gray-900">Mot suivant →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function lastNDays(history, n) {
  const arr = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    arr.push({ jour: key.slice(8) + "/" + key.slice(5, 7), XP: history[key] || 0 });
  }
  return arr;
}

function Progres({ progress, setGoal }) {
  const level = Math.floor(progress.xp / 100) + 1;
  const streak = computeStreak(progress.history);
  const todayXp = progress.history[todayKey()] || 0;
  const doneNodes = Object.values(progress.nodes).filter((n) => n.done).length;
  const scored = Object.values(progress.nodes).filter((n) => (n.best || 0) > 0);
  const avgBest = scored.length ? Math.round(scored.reduce((a, n) => a + n.best, 0) / scored.length) : 0;
  const chartData = useMemo(() => lastNDays(progress.history, 14), [progress.history]);
  const activeDays = Object.values(progress.history).filter((x) => x > 0).length;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "XP total", value: "⚡ " + progress.xp, sub: "Niveau " + level },
          { label: "Série", value: "🔥 " + streak, sub: streak > 0 ? "jour" + (streak > 1 ? "s" : "") + " d'affilée" : "commence !" },
          { label: "Étapes validées", value: "✅ " + doneNodes + "/" + NODES.length, sub: Math.round((doneNodes / NODES.length) * 100) + "%" },
          { label: "Score moyen", value: "📊 " + avgBest + "%", sub: activeDays + " jour(s)" },
        ].map((c, i) => (
          <div key={i} className="p-4 rounded-2xl border border-gray-200 bg-white shadow-sm text-center">
            <div className="text-2xl font-bold text-gray-900">{c.value}</div>
            <div className="text-xs font-medium text-gray-500 mt-1">{c.label}</div>
            <div className="text-[10px] text-gray-400">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <h4 className="font-bold text-gray-800 mb-3">📈 Tes XP — 14 derniers jours</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="jour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="XP" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <h4 className="font-bold text-gray-800 mb-3">🎯 Objectif quotidien</h4>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Aujourd'hui</span>
              <span className="font-bold text-gray-900">{todayXp} / {progress.goal || 40} XP</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${todayXp >= (progress.goal || 40) ? "bg-green-500" : "bg-red-500"}`} style={{ width: Math.min(100, (todayXp / (progress.goal || 40)) * 100) + "%" }} />
            </div>
            {todayXp >= (progress.goal || 40) && <div className="text-green-600 text-xs font-bold mt-1">🎉 Objectif atteint !</div>}
          </div>
          <div className="text-xs text-gray-500 mb-2">Choisis ton rythme :</div>
          <div className="flex gap-2">
            {[20, 40, 60, 100].map((g) => (
              <button key={g} onClick={() => setGoal(g)} className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${(progress.goal || 40) === g ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-700 border-gray-300 hover:border-red-400"}`}>{g} XP</button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm mb-6">
        <h4 className="font-bold text-gray-800 mb-3">🚩 Avancement par leçon</h4>
        <div className="space-y-3">
          {ALL_LESSONS.map((l) => {
            const nodes = NODES.filter((n) => n.lesson === l.id);
            const done = nodes.filter((n) => (progress.nodes[n.id] || {}).done).length;
            const pct = Math.round((done / nodes.length) * 100);
            return (
              <div key={l.id} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 w-28 truncate">{l.titre} · {l.zh}</span>
                <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-red-500"}`} style={{ width: pct + "%" }} />
                </div>
                <span className="text-xs font-bold text-gray-600 w-10 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm mb-4">
        <h4 className="font-bold text-gray-800 mb-3">🏅 Badges</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {BADGES.map((b) => {
            const earned = b.test(progress);
            return (
              <div key={b.id} className={`p-3 rounded-xl border text-center transition-all ${earned ? "bg-amber-50 border-amber-300 shadow" : "bg-gray-50 border-gray-200 opacity-60"}`}>
                <div className={`text-2xl mb-1 ${earned ? "" : "grayscale"}`}>{b.icon}</div>
                <div className={`text-xs font-bold ${earned ? "text-amber-800" : "text-gray-400"}`}>{b.label}</div>
                {earned && <div className="text-[10px] text-green-600 font-bold">obtenu ✓</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================== APP ==============================

export default function App() {
  useEffect(() => { preloadVoices(); }, []);

  const { progress, addXp, completeNode, setGoal, addCoins, donateCoins, spendCoins, buyAvatar, setDonor, addDonation, registerAI, aiUsedToday } = useProgress();

  // ============================== STATES ==============================
  const [cloudUser, setCloudUser] = useState(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [hasLoadedCloud, setHasLoadedCloud] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const lastSyncRef = useRef(0);

  const [appMode, setAppMode] = useState(() => {
    // 🔒 Détection URL admin secrète
    if (typeof window !== "undefined" && window.location.hash === "#studio-2026") {
      return "admin";
    }
    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      return "app";
    }
    try {
      const raw = localStorage.getItem("hsk1-user-profile-v1");
      if (raw) {
        const profile = JSON.parse(raw);
        if (profile.onboardedAt) return "app";
      }
      const progressRaw = localStorage.getItem("hsk1-campus-chinois-v1");
      if (progressRaw) {
        const p = JSON.parse(progressRaw);
        if (p.xp > 0) return "app";
      }
    } catch (e) {}
    return "landing";
  });

  const [view, setView] = useState("parcours");
  const [nodeId, setNodeId] = useState(null);
  const [nodeLesson, setNodeLesson] = useState(null);

  const activeNode = nodeId ? NODES.find((n) => n.id === nodeId) : null;

  // ============================== CLOUD SYNC ==============================
  useEffect(() => {
    if (!supabase) {
      setCloudReady(true);
      return;
    }
    // 1. Session initiale
    (async () => {
      const u = await getCurrentUser();
      setCloudUser(u);
      setCloudReady(true);
      if (u) {
        setAppMode("app");
        setAuthPending(false);
      }
    })();

    // 2. Écoute des événements d'auth
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("🔔 Auth event:", event);
        const user = session?.user || null;
        setCloudUser(user);
        if (event === "SIGNED_IN" && user) {
          setAppMode("app");
          setAuthPending(false);
          setHasLoadedCloud(false);
        }
        if (event === "SIGNED_OUT") {
          setCloudUser(null);
          setHasLoadedCloud(false);
        }
      }
    );
    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  // 3. Chargement cloud au premier login
  useEffect(() => {
    if (!cloudUser || hasLoadedCloud) return;
    (async () => {
      const cloudData = await loadProgressFromCloud(cloudUser.id);
      if (cloudData) {
        console.log("☁️ Progression chargée depuis le cloud");
        try {
          const raw = localStorage.getItem(STORE_KEY);
          const local = raw ? JSON.parse(raw) : {};
          const merged = {
            ...local,
            ...cloudData,
            xp: Math.max(local.xp || 0, cloudData.xp || 0),
            coins: Math.max(local.coins || 0, cloudData.coins || 0),
            pot: Math.max(local.pot || 0, cloudData.pot || 0),
            nodes: { ...(cloudData.nodes || {}), ...(local.nodes || {}) },
            history: { ...(cloudData.history || {}), ...(local.history || {}) },
          };
          localStorage.setItem(STORE_KEY, JSON.stringify(merged));
          window.dispatchEvent(new Event("hsk1-cloud-loaded"));
        } catch (e) {}
      }
      setHasLoadedCloud(true);
    })();
  }, [cloudUser, hasLoadedCloud]);

  // 4. Sync cloud (throttlé à 5s)
  useEffect(() => {
    if (!cloudUser || !progress) return;
    const now = Date.now();
    if (now - lastSyncRef.current < 5000) return;
    lastSyncRef.current = now;
    syncProgressToCloud(cloudUser.id, progress);
  }, [progress, cloudUser]);

  const handleLogout = async () => {
    if (
      !window.confirm(
        "Se déconnecter ?\n\nTa progression locale est conservée. Tu pourras te reconnecter avec ton email."
      )
    )
      return;
    await signOut();
    setCloudUser(null);
    setHasLoadedCloud(false);
    setAppMode("landing");
  };

  // ============================== ACTIONS ==============================
  const launch = (node) => {
    setNodeId(node.id);
    setNodeLesson(node.lesson);
    if (node.type === "vocab") setView("fiches");
    else if (node.type === "quiz") setView("quiz");
    else if (node.type === "oral") setView("oral");
    else if (node.type === "tons") setView("tons");
    else if (node.type === "ecrit") setView("ecrit");
    else if (node.type === "boss") setView("boss");
  };

  const exitNode = () => { setNodeId(null); setNodeLesson(null); setView("parcours"); };
  const handleNodeDone = (pct) => { if (activeNode) completeNode(activeNode.id, pct); exitNode(); };

  const unlockedLessons = useMemo(() => {
    const arr = [1];
    for (let l = 2; l <= ALL_LESSONS.length; l++) {
      if ((progress.nodes["L" + (l - 1) + "-boss"] || {}).done) arr.push(l);
    }
    return arr;
  }, [progress.nodes]);

  const goHome = () => {
    if (window.confirm("Retourner à l'accueil ?\n\n(Tes XP et ta progression sont conservés)")) {
      setAppMode("landing");
    }
  };

  // ============================== ROUTER ==============================
  if (appMode === "landing") {
    return (
      <Landing
        progress={progress}
        onStart={() => setAppMode("onboarding")}
      />
    );
  }

  if (appMode === "onboarding") {
    return (
      <Onboarding
        onComplete={(nextMode) => {
          if (nextMode === "auth") setAppMode("auth");
          else setAppMode("app");
        }}
      />
    );
  }

  // 📧 ROUTE AUTH — Connexion magic link Supabase
  if (appMode === "auth") {
    return (
      <AuthScreen
        onSuccess={() => setAuthPending(true)}
        onSkip={() => {
          localStorage.setItem("hsk1-auth-skipped-v1", "true");
          setAppMode("app");
        }}
        onBack={() => setAppMode("onboarding")}
      />
    );
  }

  // 🔒 ROUTE ADMIN SÉCURISÉE (URL secrète uniquement)
  if (appMode === "admin") {
    return (
      <AdminPanel
        progress={progress}
        setDonor={setDonor}
        setGoal={setGoal}
        addXp={addXp}
        onExit={() => {
          if (typeof window !== "undefined") {
            window.location.hash = "";
          }
          setAppMode("app");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 max-w-5xl mx-auto font-sans">
      <Header
        active={view}
        onNav={(v) => { setNodeId(null); setNodeLesson(null); setView(v); }}
        onHome={goHome}
        progress={progress}
        cloudUser={cloudUser}
        onLogout={handleLogout}
        onLogin={() => setAppMode("auth")}
      />

      {activeNode && (
        <div className="mb-5 p-3 rounded-xl bg-gray-900 text-white flex items-center justify-between shadow">
          <div className="text-sm">
            <span className="mr-2">{activeNode.icon}</span>
            <b>{activeNode.label}</b> · Leçon {activeNode.lesson} <span className="opacity-60">(+{activeNode.xp} XP)</span>
          </div>
          <button onClick={exitNode} className="text-xs px-3 py-1 rounded-full bg-white/15 hover:bg-white/25">✕ Quitter</button>
        </div>
      )}

      {view === "parcours" && <Parcours progress={progress} onLaunch={launch} />}
      {view === "fiches" && <Fiches presetLesson={activeNode ? nodeLesson : null} onReviewDone={activeNode ? handleNodeDone : undefined} />}
      {view === "quiz" && <Quiz presetLesson={activeNode ? nodeLesson : null} onDone={activeNode ? handleNodeDone : undefined} />}
      {view === "oral" && <Oral presetLesson={activeNode ? nodeLesson : null} onDone={activeNode ? handleNodeDone : undefined} />}
      {view === "tons" && (
        <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50">
          <h3 className="text-lg font-bold text-gray-800 mb-3">🎵 Défi des tons</h3>
          <QuizTons onDone={activeNode ? handleNodeDone : undefined} />
        </div>
      )}
      {view === "ecrit" && <Ecrit onDone={activeNode ? handleNodeDone : undefined} />}
      {view === "boss" && <BossChallenge lesson={nodeLesson} onDone={handleNodeDone} />}
      {view === "phonetique" && <Phonetique />}
      {view === "defi" && <DefiEclair unlockedLessons={unlockedLessons} addXp={addXp} />}
      {view === "progres" && <Progres progress={progress} setGoal={setGoal} />}
      {view === "express" && <Express addXp={addXp} addCoins={addCoins} unlockedLessons={unlockedLessons} />}
      {view === "jeux" && <Jeux progress={progress} addXp={addXp} addCoins={addCoins} buyAvatar={buyAvatar} />}
      {view === "prof" && <ProfIA progress={progress} aiUsedToday={aiUsedToday} registerAI={registerAI} />}
      {view === "don" && <Don progress={progress} setDonor={setDonor} addDonation={addDonation} donateCoins={donateCoins} />}
      {view === "pronon" && <Prononciation addXp={addXp} addCoins={addCoins} unlockedLessons={unlockedLessons} />}

      <div className="mt-8 text-center text-xs text-gray-400">
        <div>加油！Jiāyóu ! — Propulsé par <b>Kimatey Enterprise</b> · 15% reversés à la VIE Foundation ❤️</div>
      </div>
    </div>
  );
}
