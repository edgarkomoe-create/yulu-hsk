# YǔLù 语路 — Campus chinois HSK

App d'apprentissage du chinois (Vite + React + Supabase), propulsée par Kimatey Enterprise · VIE Foundation.

## Démarrer en local
```
cp .env.example .env     # renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Installation complète (base de données, IA, déploiement)
Voir le guide Word **YuLu_Guide_Installation_V1.docx** livré avec ce projet.

Résumé : 
1. Exécuter `supabase/migrations/002_v1_additive.sql` dans le SQL Editor de Supabase.
2. Déclarer l'administrateur (clé `admin_emails` de `app_config`).
3. `npx supabase secrets set GEMINI_API_KEY=...` puis `npx supabase functions deploy ask-ai`.
4. Variables Vercel : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (jamais la clé Gemini ni `service_role`).

## Structure ajoutée en V1
```
src/views/       MonCap, Pass, Certification, Solidarite
src/lib/cloud.js accès aux données cloud
src/data/        objectifs, pass, badges, pistes
src/components/  LoginGate
supabase/migrations/002_v1_additive.sql
supabase/functions/ask-ai/index.ts
```
