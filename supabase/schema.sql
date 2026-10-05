-- ============================================
-- YǔLù 语路 — Base de données Supabase
-- ============================================

-- Helper : vérifie si l'utilisateur connecté est admin
create or replace function public.is_admin() returns boolean as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$ language sql stable security definer;

-- 1) PROFILS UTILISATEURS
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  wave_number text,
  whatsapp text,
  is_donor boolean default false,
  is_admin boolean default false,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "lecture de son profil" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "maj de son profil" on public.profiles for update using (auth.uid() = id);

-- 2) PROGRESSION (XP, pièces, parcours — synchronisée)
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.progress enable row level security;
create policy "lecture de sa progression" on public.progress for select using (auth.uid() = user_id or public.is_admin());
create policy "maj de sa progression" on public.progress for insert with check (auth.uid() = user_id);
create policy "maj de sa progression 2" on public.progress for update using (auth.uid() = user_id);

-- 3) CATALOGUE DE COURS (géré par l'admin, lu par tous)
create table if not exists public.lessons_catalog (
  id bigint generated always as identity primary key,
  lesson_id int unique,
  content jsonb,
  active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.lessons_catalog enable row level security;
create policy "lecture publique" on public.lessons_catalog for select using (active = true or public.is_admin());
create policy "admin ecrit" on public.lessons_catalog for insert with check (public.is_admin());
create policy "admin maj" on public.lessons_catalog for update using (public.is_admin());
create policy "admin supprime" on public.lessons_catalog for delete using (public.is_admin());

-- 4) DONS WAVE (formulaire de l'app → validation par l'admin)
create table if not exists public.donations (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  transaction_ref text not null,
  full_name text not null,
  wave_number text not null,
  whatsapp text,
  amount_fcfa int not null,
  status text default 'pending' check (status in ('pending','validated','rejected')),
  created_at timestamptz default now()
);
alter table public.donations enable row level security;
create policy "envoi de don" on public.donations for insert with check (true);
create policy "lecture de son don" on public.donations for select using (auth.uid() = user_id or public.is_admin());
create policy "admin valide les dons" on public.donations for update using (public.is_admin());

-- 5) STATISTIQUES D'ERREURS (améliorer les cours grâce aux apprenants)
create table if not exists public.question_misses (
  id bigint generated always as identity primary key,
  question text unique not null,
  lesson_id int,
  miss_count int default 1,
  updated_at timestamptz default now()
);
alter table public.question_misses enable row level security;
create policy "ajout anonyme" on public.question_misses for insert with check (true);
create policy "lecture admin" on public.question_misses for select using (public.is_admin());

-- 6) REALTIME : le catalogue et les dons se mettent à jour en direct
alter publication supabase_realtime add table public.lessons_catalog;
alter publication supabase_realtime add table public.donations;

-- 7) Créer ton profil admin :
-- Après t'être inscrit dans l'app (phase 2), exécute UNE FOIS dans le SQL Editor :
-- update public.profiles set is_admin = true where id = auth.uid();
-- (ou manuellement : update public.profiles set is_admin = true where full_name = 'Edgar');
