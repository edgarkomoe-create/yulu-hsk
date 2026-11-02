-- ============================================================
-- YǔLù Chinese — Migration 002 : App élève V1 (ADDITIVE)
-- Sûre à exécuter plusieurs fois. Ne supprime aucune donnée.
-- Compatible avec le schema.sql existant ET avec le SQL "24 tables"
-- si tu l'as déjà exécuté.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 0. CONFIG GLOBALE (créée en premier : is_admin() en dépend)
-- ------------------------------------------------------------
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

insert into public.app_config (key, value) values
  ('ai_quotas', '{"free":5,"donor":999999,"boost_24h":50,"week_7d":200,"month_30d":999999,"quarter_90d":999999,"year_365d":999999,"lifetime":999999}'),
  ('pricing_passes', '{"boost_24h":500,"week_7d":1000,"month_30d":2500,"quarter_90d":6000,"year_365d":18000,"lifetime":35000}'),
  ('pricing_donations', '{"anonymous_min":50,"official_min":200}'),
  ('revenue_split', '{"tech":70,"vie_foundation":10,"certifications":10,"data_bonuses":10}'),
  ('gemini_models', '{"orchestrator":"gemini-2.5-flash-lite","agent_default":"gemini-2.5-flash"}'),
  ('sandbox', '{"pass_percent":80,"max_attempts_per_day":20}'),
  ('payment', '{"wave_link":"https://pay.wave.com/m/M_ci_lPtTUkiLSpYn/c/ci/"}')
on conflict (key) do nothing;

-- Filet de sécurité : si schema.sql n'a pas été exécuté, on crée les tables de base.
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

-- ------------------------------------------------------------
-- 1. PROFILS : colonnes supplémentaires
-- ------------------------------------------------------------
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists is_donor boolean default false;
alter table public.profiles add column if not exists avatar text default '中';
alter table public.profiles add column if not exists language_id text default 'zh';
alter table public.profiles add column if not exists tier text default 'free';
alter table public.profiles add column if not exists tier_expires_at timestamptz;
alter table public.profiles add column if not exists daily_ai_quota int default 5;
alter table public.profiles add column if not exists daily_ai_used int default 0;
alter table public.profiles add column if not exists daily_reset_at date default current_date;
alter table public.profiles add column if not exists total_donations_fcfa int default 0;
alter table public.profiles add column if not exists impact_score int default 0;
alter table public.profiles add column if not exists onboarded_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- is_admin() : colonne profiles.is_admin OU email listé dans app_config.admin_emails
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
      or exists (
        select 1
        from auth.users u
        join public.app_config c on c.key = 'admin_emails'
        where u.id = auth.uid() and c.value ? u.email
      );
$$;

-- SÉCURITÉ : un utilisateur ne peut PAS modifier ses propres privilèges
-- (is_admin, tier, quotas, totaux). Le service_role et l'admin le peuvent.
create or replace function public.protect_profile_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.is_admin := old.is_admin;
    new.is_donor := old.is_donor;
    new.tier := old.tier;
    new.tier_expires_at := old.tier_expires_at;
    new.daily_ai_quota := old.daily_ai_quota;
    new.daily_ai_used := old.daily_ai_used;
    new.daily_reset_at := old.daily_reset_at;
    new.total_donations_fcfa := old.total_donations_fcfa;
    new.impact_score := old.impact_score;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile before update on public.profiles
  for each row execute function public.protect_profile_columns();

drop policy if exists "creation de son profil" on public.profiles;
create policy "creation de son profil" on public.profiles for insert
  with check (auth.uid() = id and coalesce(is_admin,false) = false
              and coalesce(tier,'free') = 'free' and coalesce(is_donor,false) = false);

-- ------------------------------------------------------------
-- 2. CONFIG : lecture publique SAUF admin_emails
-- ------------------------------------------------------------
alter table public.app_config enable row level security;
drop policy if exists "Public read config" on public.app_config;
drop policy if exists "lecture config publique" on public.app_config;
create policy "lecture config publique" on public.app_config for select using (key <> 'admin_emails');
drop policy if exists "Admin full config" on public.app_config;
drop policy if exists "admin ecrit config" on public.app_config;
create policy "admin ecrit config" on public.app_config for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 3. NOUVEAUX UTILISATEURS : profil + agrégat contributions
-- ------------------------------------------------------------
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  total_donated_fcfa int default 0,
  donation_count int default 0,
  current_badge text default 'none',
  badges_unlocked text[] default array[]::text[],
  data_bonus_mb int default 0,
  pass_discount_percent int default 0,
  rank_this_month int,
  last_donation_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  insert into public.contributions (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rattrapage des comptes déjà existants
insert into public.profiles (id, email)
  select u.id, u.email from auth.users u on conflict (id) do nothing;
insert into public.contributions (user_id)
  select u.id from auth.users u on conflict (user_id) do nothing;

-- ------------------------------------------------------------
-- 4. DONS : colonnes + sécurité + badges
-- ------------------------------------------------------------
alter table public.donations add column if not exists is_anonymous boolean default false;
alter table public.donations add column if not exists badge_unlocked text;
alter table public.donations add column if not exists shared_on_social boolean default false;
alter table public.donations add column if not exists verified_by uuid references auth.users(id);
alter table public.donations add column if not exists verified_at timestamptz;

do $$ begin
  create unique index if not exists donations_ref_unique on public.donations (transaction_ref);
exception when others then
  raise notice 'Index unique sur donations.transaction_ref non créé (doublons existants ?) : %', sqlerrm;
end $$;

-- Avant : "with check (true)" → n'importe qui pouvait s'insérer un don déjà "validated".
drop policy if exists "envoi de don" on public.donations;
drop policy if exists "envoi de don en attente" on public.donations;
create policy "envoi de don en attente" on public.donations for insert
  with check (
    status = 'pending'
    and (user_id is null or user_id = auth.uid())
    and amount_fcfa between 50 and 10000000
  );

create or replace function public.refresh_contribution(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_total int; v_count int; v_badge text; v_badges text[];
begin
  if p_user is null then return; end if;
  select coalesce(sum(amount_fcfa),0), count(*) into v_total, v_count
    from public.donations where user_id = p_user and status = 'validated';

  v_badge := case
    when v_total >= 25000 then 'legende'
    when v_total >= 10000 then 'etoile'
    when v_total >= 5000  then 'montagne'
    when v_total >= 2500  then 'foret'
    when v_total >= 1000  then 'arbre'
    when v_total >= 500   then 'pousse'
    when v_total >= 200   then 'graine'
    else 'none' end;

  v_badges := array(
    select b from unnest(array['graine','pousse','arbre','foret','montagne','etoile','legende']) with ordinality t(b, o)
    where v_total >= (array[200,500,1000,2500,5000,10000,25000])[o]
    order by o);

  insert into public.contributions (user_id, total_donated_fcfa, donation_count, current_badge, badges_unlocked, last_donation_at, updated_at)
    values (p_user, v_total, v_count, v_badge, v_badges, now(), now())
  on conflict (user_id) do update set
    total_donated_fcfa = excluded.total_donated_fcfa,
    donation_count = excluded.donation_count,
    current_badge = excluded.current_badge,
    badges_unlocked = excluded.badges_unlocked,
    last_donation_at = excluded.last_donation_at,
    updated_at = now();

  update public.profiles set total_donations_fcfa = v_total, is_donor = (v_total > 0) where id = p_user;
end $$;

-- Objectif communautaire du mois courant
create table if not exists public.community_goals (
  id uuid primary key default gen_random_uuid(),
  period text not null unique,
  title text not null,
  description text,
  target_amount_fcfa int not null,
  current_amount_fcfa int default 0,
  contributor_count int default 0,
  status text default 'active',
  reward_badge text,
  reward_data_mb int default 0,
  started_at timestamptz default now(),
  ends_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create or replace function public.refresh_community_goal() returns void
language plpgsql security definer set search_path = public as $$
declare g record; v_sum int; v_cnt int;
begin
  for g in select * from public.community_goals where status = 'active' loop
    select coalesce(sum(amount_fcfa),0), count(distinct coalesce(user_id::text, transaction_ref))
      into v_sum, v_cnt
      from public.donations
      where status = 'validated' and created_at >= g.started_at and created_at <= g.ends_at;
    update public.community_goals set
      current_amount_fcfa = v_sum,
      contributor_count = v_cnt,
      status = case when v_sum >= target_amount_fcfa then 'completed' else status end,
      completed_at = case when v_sum >= target_amount_fcfa and completed_at is null then now() else completed_at end
    where id = g.id;
  end loop;
end $$;

-- Journal d'impact (admin uniquement)
create table if not exists public.impact_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  source_id uuid,
  amount_fcfa int,
  breakdown jsonb,
  language_id text default 'zh',
  created_at timestamptz default now()
);

create or replace function public.ledger_split(p_amount int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  select coalesce((select value from public.app_config where key = 'revenue_split'), '{}'::jsonb) into v;
  return jsonb_build_object(
    'tech',           round(p_amount * coalesce((v->>'tech')::numeric, 70) / 100),
    'vie_foundation', round(p_amount * coalesce((v->>'vie_foundation')::numeric, 10) / 100),
    'certifications', round(p_amount * coalesce((v->>'certifications')::numeric, 10) / 100),
    'data_bonuses',   round(p_amount * coalesce((v->>'data_bonuses')::numeric, 10) / 100));
end $$;

create or replace function public.on_donation_validated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_contribution(new.user_id);
  perform public.refresh_community_goal();
  insert into public.impact_ledger (user_id, action_type, amount_fcfa, breakdown)
    values (new.user_id, 'donation', new.amount_fcfa, public.ledger_split(new.amount_fcfa));
  return new;
end $$;

drop trigger if exists trg_donation_validated on public.donations;
drop trigger if exists trg_donation_validated_ins on public.donations;
drop trigger if exists trg_donation_validated_upd on public.donations;
create trigger trg_donation_validated_ins
  after insert on public.donations
  for each row when (new.status = 'validated')
  execute function public.on_donation_validated();
create trigger trg_donation_validated_upd
  after update of status on public.donations
  for each row when (new.status = 'validated' and old.status is distinct from 'validated')
  execute function public.on_donation_validated();

-- Mur des soutiens : vue publique SANS données sensibles (pas de n° Wave/WhatsApp/réf)
create or replace view public.supporters_wall as
  select case when d.is_anonymous then 'Anonyme'
              else coalesce(nullif(split_part(trim(d.full_name), ' ', 1), ''), 'Ami') end as display_name,
         d.amount_fcfa, d.badge_unlocked, d.created_at
  from public.donations d
  where d.status = 'validated'
  order by d.created_at desc
  limit 100;
grant select on public.supporters_wall to anon, authenticated;

-- ------------------------------------------------------------
-- 5. PASS (abonnements)
-- ------------------------------------------------------------
create table if not exists public.passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  pass_code text not null,
  pass_type text not null,
  price_fcfa int not null,
  duration_unit text not null,
  duration_value int not null,
  starts_at timestamptz default now(),
  expires_at timestamptz,
  status text default 'pending',
  transaction_ref text,
  benefits jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_passes_active on public.passes (user_id, expires_at) where status = 'active';
do $$ begin
  create unique index if not exists passes_ref_unique on public.passes (transaction_ref) where transaction_ref is not null;
exception when others then raise notice 'Index unique passes.transaction_ref non créé : %', sqlerrm; end $$;

-- ------------------------------------------------------------
-- 6. OBJECTIF PERSONNEL (Mon Cap) + CONVERSATIONS IA
-- ------------------------------------------------------------
create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  goal_type text not null,
  goal_custom_text text,
  target_level text default 'HSK2',
  target_date timestamptz,
  salary_target int,
  motivation text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  agent_id text not null,
  role text not null,
  message text not null,
  tokens_used int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_agent_conv_user on public.agent_conversations (user_id, agent_id, created_at desc);

-- ------------------------------------------------------------
-- 7. SANDBOX D'EXAMEN + CERTIFICATION
-- ------------------------------------------------------------
create table if not exists public.sandbox_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null default 'HSK1',
  score int not null,
  max_score int not null,
  passed boolean not null,
  time_spent_seconds int,
  created_at timestamptz default now()
);
create index if not exists idx_sandbox_user on public.sandbox_attempts (user_id, created_at desc);

create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  level text not null,
  language_id text default 'zh',
  eligibility_status text default 'in_progress',
  sandbox_passed boolean default false,
  sandbox_best_score int,
  sandbox_attempts int default 0,
  funded_by text,
  funded_at timestamptz,
  amount_funded int,
  registration_center text,
  registration_date timestamptz,
  official_exam_date timestamptz,
  official_result text,
  official_score int,
  certificate_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
do $$ begin
  create unique index if not exists certifications_user_level on public.certifications (user_id, level, language_id);
exception when others then raise notice 'Index certifications non créé : %', sqlerrm; end $$;

-- ------------------------------------------------------------
-- 8. FONCTIONS RPC
-- ------------------------------------------------------------

-- 8.1 Quota IA (appelée UNIQUEMENT par l'Edge Function via service_role)
create or replace function public.consume_ai_quota(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cfg jsonb; v_pass text; v_donor boolean; v_key text; v_quota int; v_used int; v_reset date;
begin
  select value into v_cfg from public.app_config where key = 'ai_quotas';
  v_cfg := coalesce(v_cfg, '{"free":5}'::jsonb);

  select p.pass_type into v_pass from public.passes p
   where p.user_id = p_user and p.status = 'active' and (p.expires_at is null or p.expires_at > now())
   order by case p.pass_type when 'lifetime' then 0 when 'year_365d' then 1 when 'quarter_90d' then 2
                             when 'month_30d' then 3 when 'week_7d' then 4 else 5 end
   limit 1;

  select exists (select 1 from public.donations where user_id = p_user and status = 'validated') into v_donor;

  v_key := coalesce(v_pass, case when v_donor then 'donor' else 'free' end);
  v_quota := coalesce((v_cfg->>v_key)::int, 5);

  insert into public.profiles (id) values (p_user) on conflict (id) do nothing;
  select daily_ai_used, daily_reset_at into v_used, v_reset from public.profiles where id = p_user for update;
  if v_reset is null or v_reset < current_date then v_used := 0; end if;
  v_used := coalesce(v_used, 0);

  if v_used >= v_quota then
    return jsonb_build_object('allowed', false, 'used', v_used, 'quota', v_quota, 'tier', v_key);
  end if;

  update public.profiles set daily_ai_used = v_used + 1, daily_reset_at = current_date where id = p_user;
  return jsonb_build_object('allowed', true, 'used', v_used + 1, 'quota', v_quota, 'tier', v_key);
end $$;

create or replace function public.refund_ai_quota(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.profiles set daily_ai_used = greatest(0, coalesce(daily_ai_used,0) - 1) where id = p_user;
$$;

revoke all on function public.consume_ai_quota(uuid) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid) to service_role;
grant execute on function public.refund_ai_quota(uuid) to service_role;

-- 8.2 Admin : valider un don (par n° de transaction Wave)
create or replace function public.validate_donation(p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d record; v_badge text;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  select * into d from public.donations where transaction_ref = p_ref;
  if not found then raise exception 'Don introuvable : %', p_ref; end if;
  update public.donations set status = 'validated', verified_by = auth.uid(), verified_at = now()
    where transaction_ref = p_ref;
  if d.user_id is not null then
    select current_badge into v_badge from public.contributions where user_id = d.user_id;
    update public.donations set badge_unlocked = v_badge where transaction_ref = p_ref;
  end if;
  return jsonb_build_object('ok', true, 'ref', p_ref, 'badge', v_badge);
end $$;

-- 8.3 Admin : activer un pass après vérification du paiement Wave
create or replace function public.activate_pass(p_ref text, p_amount_received int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ps record; v_price int; v_days int; v_exp timestamptz;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  select * into ps from public.passes where transaction_ref = p_ref;
  if not found then raise exception 'Pass introuvable : %', p_ref; end if;

  select (value->>ps.pass_type)::int into v_price from public.app_config where key = 'pricing_passes';
  if v_price is null then raise exception 'Type de pass inconnu : %', ps.pass_type; end if;
  if p_amount_received < v_price then
    raise exception 'Montant reçu (%) inférieur au prix du pass (%)', p_amount_received, v_price;
  end if;

  v_days := case ps.pass_type when 'boost_24h' then 1 when 'week_7d' then 7 when 'month_30d' then 30
                              when 'quarter_90d' then 90 when 'year_365d' then 365 else null end;
  v_exp := case when v_days is null then null else now() + make_interval(days => v_days) end;

  update public.passes set status = 'active', price_fcfa = v_price, starts_at = now(),
         expires_at = v_exp, updated_at = now() where transaction_ref = p_ref;

  insert into public.impact_ledger (user_id, action_type, amount_fcfa, breakdown)
    values (ps.user_id, 'pass', v_price, public.ledger_split(v_price));

  return jsonb_build_object('ok', true, 'ref', p_ref, 'expires_at', v_exp);
end $$;

-- 8.4 Élève : enregistrer une tentative d'examen blanc
create or replace function public.record_sandbox_attempt(p_level text, p_score int, p_max int, p_seconds int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cfg jsonb; v_pct int; v_passed boolean; v_today int; v_max_day int;
        v_best int; v_n int; v_any_pass boolean;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_level not in ('HSK1','HSK2','HSK3','HSK4','HSK5','HSK6') then raise exception 'Niveau invalide'; end if;
  if p_max < 10 or p_max > 100 or p_score < 0 or p_score > p_max then raise exception 'Score invalide'; end if;

  select value into v_cfg from public.app_config where key = 'sandbox';
  v_pct := coalesce((v_cfg->>'pass_percent')::int, 80);
  v_max_day := coalesce((v_cfg->>'max_attempts_per_day')::int, 20);

  select count(*) into v_today from public.sandbox_attempts
    where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_today >= v_max_day then raise exception 'Limite de tentatives atteinte pour aujourd''hui'; end if;

  v_passed := (p_score * 100 >= v_pct * p_max);
  insert into public.sandbox_attempts (user_id, level, score, max_score, passed, time_spent_seconds)
    values (v_uid, p_level, p_score, p_max, v_passed, p_seconds);

  select max(round(score * 100.0 / max_score)), count(*), bool_or(passed)
    into v_best, v_n, v_any_pass from public.sandbox_attempts where user_id = v_uid and level = p_level;

  insert into public.certifications (user_id, level, sandbox_best_score, sandbox_attempts, sandbox_passed, eligibility_status)
    values (v_uid, p_level, v_best, v_n, v_any_pass, case when v_any_pass then 'eligible' else 'in_progress' end)
  on conflict (user_id, level, language_id) do update set
    sandbox_best_score = excluded.sandbox_best_score,
    sandbox_attempts = excluded.sandbox_attempts,
    sandbox_passed = excluded.sandbox_passed,
    eligibility_status = case
      when public.certifications.eligibility_status in ('funding_requested','funded','registered','completed')
        then public.certifications.eligibility_status
      when excluded.sandbox_passed then 'eligible' else 'in_progress' end,
    updated_at = now();

  return jsonb_build_object('passed', v_passed, 'percent', round(p_score * 100.0 / p_max),
                            'required_percent', v_pct, 'best_percent', v_best, 'attempts', v_n);
end $$;

-- 8.5 Élève : demander le financement de la certification officielle
create or replace function public.request_certification_funding(p_level text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); c record;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into c from public.certifications where user_id = v_uid and level = p_level and language_id = 'zh';
  if not found or c.eligibility_status <> 'eligible' then
    raise exception 'Tu dois d''abord réussir l''examen blanc % pour être éligible', p_level;
  end if;
  update public.certifications set eligibility_status = 'funding_requested', updated_at = now()
    where id = c.id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.validate_donation(text) to authenticated;
grant execute on function public.activate_pass(text, int) to authenticated;
grant execute on function public.record_sandbox_attempt(text, int, int, int) to authenticated;
grant execute on function public.request_certification_funding(text) to authenticated;

-- ------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.contributions enable row level security;
alter table public.community_goals enable row level security;
alter table public.impact_ledger enable row level security;
alter table public.passes enable row level security;
alter table public.user_goals enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.sandbox_attempts enable row level security;
alter table public.certifications enable row level security;

-- contributions : chacun voit la sienne (le mur public passe par la vue supporters_wall)
drop policy if exists "Users own contributions" on public.contributions;
drop policy if exists "Public read contributions" on public.contributions;
drop policy if exists "Admin full contributions" on public.contributions;
drop policy if exists "contrib: lecture de la sienne" on public.contributions;
create policy "contrib: lecture de la sienne" on public.contributions for select using (auth.uid() = user_id or public.is_admin());

-- objectifs communautaires : lecture publique, écriture admin
drop policy if exists "Public read goals" on public.community_goals;
drop policy if exists "Admin full goals" on public.community_goals;
drop policy if exists "goals: lecture publique" on public.community_goals;
create policy "goals: lecture publique" on public.community_goals for select using (true);
drop policy if exists "goals: admin ecrit" on public.community_goals;
create policy "goals: admin ecrit" on public.community_goals for all using (public.is_admin()) with check (public.is_admin());

-- journal d'impact : admin seulement
drop policy if exists "Admin full impact" on public.impact_ledger;
drop policy if exists "impact: admin" on public.impact_ledger;
create policy "impact: admin" on public.impact_ledger for all using (public.is_admin()) with check (public.is_admin());

-- passes : l'élève voit les siens et peut en DEMANDER un (toujours 'pending')
drop policy if exists "Users own passes" on public.passes;
drop policy if exists "Admin full passes" on public.passes;
drop policy if exists "passes: lecture des siens" on public.passes;
create policy "passes: lecture des siens" on public.passes for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "passes: demande en attente" on public.passes;
create policy "passes: demande en attente" on public.passes for insert
  with check (auth.uid() = user_id and status = 'pending' and transaction_ref is not null
              and pass_type in ('boost_24h','week_7d','month_30d','quarter_90d','year_365d','lifetime'));
drop policy if exists "passes: admin modifie" on public.passes;
create policy "passes: admin modifie" on public.passes for update using (public.is_admin());

-- objectif personnel
drop policy if exists "Users own goals" on public.user_goals;
drop policy if exists "user_goals: les siens" on public.user_goals;
create policy "user_goals: les siens" on public.user_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- conversations IA : lecture des siennes ; écriture par l'Edge Function (service_role)
drop policy if exists "Users own conv" on public.agent_conversations;
drop policy if exists "Admin read conv" on public.agent_conversations;
drop policy if exists "conv: lecture des siennes" on public.agent_conversations;
create policy "conv: lecture des siennes" on public.agent_conversations for select using (auth.uid() = user_id);

-- sandbox + certifications : lecture des siens ; écriture via RPC uniquement
drop policy if exists "sandbox: lecture des siennes" on public.sandbox_attempts;
create policy "sandbox: lecture des siennes" on public.sandbox_attempts for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Users own certifs" on public.certifications;
drop policy if exists "Admin full certifs" on public.certifications;
drop policy if exists "certifs: lecture des siennes" on public.certifications;
create policy "certifs: lecture des siennes" on public.certifications for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "certifs: admin modifie" on public.certifications;
create policy "certifs: admin modifie" on public.certifications for update using (public.is_admin());

-- ------------------------------------------------------------
-- 10. OBJECTIF COMMUNAUTAIRE INITIAL + REALTIME
-- ------------------------------------------------------------
insert into public.community_goals (period, title, description, target_amount_fcfa, started_at, ends_at)
values ('2026-10', 'Financer 10 certifications HSK 1',
        'Aidons 10 élèves à passer leur certification officielle.', 10000,
        '2026-10-01 00:00:00+00', '2026-10-31 23:59:59+00')
on conflict (period) do nothing;

do $$ begin
  alter publication supabase_realtime add table public.community_goals;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.donations;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.passes;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- Vérification
select count(*) as tables_public from information_schema.tables
 where table_schema = 'public' and table_type = 'BASE TABLE';
