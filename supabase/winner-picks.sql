-- ============================================================================
-- Mundial 2026 — Pronóstico por GANADOR (1 / X / 2) en fase de grupos
-- Ejecuta UNA vez en el SQL Editor de Supabase, después del schema.sql.
-- Cambia la mecánica: en lugar del marcador exacto se pronostica quién gana.
-- 1 punto por acertar el ganador (o el empate).
-- ============================================================================

-- 1) Columna de pronóstico de ganador y marcadores ahora opcionales.
alter table public.mundial_predictions
  add column if not exists pick text;

alter table public.mundial_predictions
  alter column home_score drop not null,
  alter column away_score drop not null;

alter table public.mundial_predictions
  drop constraint if exists mundial_predictions_pick_check;
alter table public.mundial_predictions
  add constraint mundial_predictions_pick_check
  check (pick is null or pick in ('home', 'draw', 'away'));

-- 2) Vista de ranking basada en el ganador.
--    El ganador pronosticado sale de `pick`; si una predicción antigua tenía
--    marcador, se deriva de él. El ganador real se deriva del resultado.
create or replace view public.mundial_leaderboard
with (security_invoker = on) as
with scored as (
  select
    p.id       as user_id,
    p.username as username,
    r.match_id as result_id,
    coalesce(
      pr.pick,
      case
        when pr.home_score > pr.away_score then 'home'
        when pr.home_score < pr.away_score then 'away'
        when pr.home_score is not null then 'draw'
      end
    ) as predicted,
    case
      when r.home_score > r.away_score then 'home'
      when r.home_score < r.away_score then 'away'
      else 'draw'
    end as actual
  from public.mundial_profiles p
  left join public.mundial_predictions pr on pr.user_id = p.id
  left join public.mundial_results r on r.match_id = pr.match_id
)
select
  user_id,
  username,
  count(*) filter (where result_id is not null) as predictions_scored,
  count(*) filter (where result_id is not null and predicted = actual) as correct,
  coalesce(
    count(*) filter (where result_id is not null and predicted = actual),
    0
  )::int as points
from scored
group by user_id, username;
