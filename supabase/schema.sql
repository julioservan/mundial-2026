-- ============================================================================
-- Mundial 2026 — Quiniela / Liga
-- ----------------------------------------------------------------------------
-- Ejecuta este archivo UNA vez en el SQL Editor de Supabase.
-- Comparte proyecto con otras apps: todo va con prefijo `mundial_` para no
-- colisionar. Para borrarlo todo el día de mañana: elimina las tablas/vista
-- con prefijo `mundial_`.
--
-- Puntuación:  marcador exacto = 3 pts  ·  acertar resultado (1X2) = 1 pt
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Perfiles. Ligados a auth.users (compartido con el resto del proyecto).
-- ---------------------------------------------------------------------------
create table if not exists public.mundial_profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.mundial_profiles enable row level security;

-- Cualquiera puede leer los perfiles (necesario para el ranking público).
drop policy if exists "mundial_profiles_select" on public.mundial_profiles;
create policy "mundial_profiles_select"
  on public.mundial_profiles for select
  using (true);

-- Cada usuario crea y edita SOLO su propio perfil.
drop policy if exists "mundial_profiles_insert_own" on public.mundial_profiles;
create policy "mundial_profiles_insert_own"
  on public.mundial_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "mundial_profiles_update_own" on public.mundial_profiles;
create policy "mundial_profiles_update_own"
  on public.mundial_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Predicciones de cada usuario por partido.
-- ---------------------------------------------------------------------------
create table if not exists public.mundial_predictions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  match_id   text not null,
  home_score smallint not null check (home_score >= 0 and home_score <= 99),
  away_score smallint not null check (away_score >= 0 and away_score <= 99),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

alter table public.mundial_predictions enable row level security;

-- Predicciones visibles para todos (liga entre amigos -> ranking comparativo).
drop policy if exists "mundial_predictions_select" on public.mundial_predictions;
create policy "mundial_predictions_select"
  on public.mundial_predictions for select
  using (true);

-- Cada usuario gestiona SOLO sus propias predicciones.
drop policy if exists "mundial_predictions_write_own" on public.mundial_predictions;
create policy "mundial_predictions_write_own"
  on public.mundial_predictions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Resultados reales de los partidos (los introduce un admin).
-- ---------------------------------------------------------------------------
create table if not exists public.mundial_results (
  match_id   text primary key,
  home_score smallint not null check (home_score >= 0 and home_score <= 99),
  away_score smallint not null check (away_score >= 0 and away_score <= 99),
  updated_at timestamptz not null default now()
);

alter table public.mundial_results enable row level security;

-- Resultados públicos (para que todos vean el ranking).
drop policy if exists "mundial_results_select" on public.mundial_results;
create policy "mundial_results_select"
  on public.mundial_results for select
  using (true);

-- Solo los admins escriben resultados.
drop policy if exists "mundial_results_write_admin" on public.mundial_results;
create policy "mundial_results_write_admin"
  on public.mundial_results for all
  using (
    exists (
      select 1 from public.mundial_profiles
      where id = auth.uid() and is_admin
    )
  )
  with check (
    exists (
      select 1 from public.mundial_profiles
      where id = auth.uid() and is_admin
    )
  );

-- ---------------------------------------------------------------------------
-- Vista de ranking: cruza predicciones con resultados y calcula puntos.
-- security_invoker = respeta las políticas RLS de quien consulta.
-- ---------------------------------------------------------------------------
create or replace view public.mundial_leaderboard
with (security_invoker = on) as
select
  p.id       as user_id,
  p.username as username,
  count(*) filter (where r.match_id is not null) as predictions_scored,
  count(*) filter (
    where r.match_id is not null
      and pr.home_score = r.home_score
      and pr.away_score = r.away_score
  ) as exact_scores,
  count(*) filter (
    where r.match_id is not null
      and sign(pr.home_score - pr.away_score) = sign(r.home_score - r.away_score)
      and not (pr.home_score = r.home_score and pr.away_score = r.away_score)
  ) as correct_outcomes,
  coalesce(sum(
    case
      when r.match_id is null then 0
      when pr.home_score = r.home_score and pr.away_score = r.away_score then 3
      when sign(pr.home_score - pr.away_score) = sign(r.home_score - r.away_score) then 1
      else 0
    end
  ), 0)::int as points
from public.mundial_profiles p
left join public.mundial_predictions pr on pr.user_id = p.id
left join public.mundial_results r on r.match_id = pr.match_id
group by p.id, p.username;

-- ---------------------------------------------------------------------------
-- Para nombrarte admin (ejecútalo tras registrarte por primera vez):
--   update public.mundial_profiles set is_admin = true
--   where id = (select id from auth.users where email = 'julioservan@gmail.com');
-- ---------------------------------------------------------------------------
