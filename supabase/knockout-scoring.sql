-- ============================================================================
-- Mundial 2026 — Puntuación enriquecida en ELIMINATORIAS
-- Ejecuta UNA vez en el SQL Editor, después de winner-picks.sql.
-- ----------------------------------------------------------------------------
-- En eliminatorias el jugador pronostica:
--   · Ganador del partido (1 / X / 2)  -> 1 punto si acierta
--   · Resultado exacto                 -> +3 puntos si lo clava (total 4)
--   · Si predice empate, además "quién pasa" (penaltis): OBLIGATORIO, no puntúa
-- En fase de grupos sigue todo igual (1 punto por acertar el ganador).
-- Los partidos de eliminatoria se reconocen por el prefijo de id 'K-'.
-- ============================================================================

-- 1) Campo "quién pasa" (solo informativo; no entra en la puntuación).
alter table public.mundial_predictions
  add column if not exists advance text;

alter table public.mundial_predictions
  drop constraint if exists mundial_predictions_advance_check;
alter table public.mundial_predictions
  add constraint mundial_predictions_advance_check
  check (advance is null or advance in ('home', 'away'));

-- 2) Vista de ranking: ganador (1) + bonus de resultado exacto (3) en KO.
drop view if exists public.mundial_leaderboard;
create view public.mundial_leaderboard
with (security_invoker = on) as
with scored as (
  select
    p.id       as user_id,
    p.username as username,
    r.match_id as result_id,
    (pr.match_id like 'K-%') as is_ko,
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
    end as actual,
    pr.home_score as ph,
    pr.away_score as pa,
    r.home_score  as rh,
    r.away_score  as ra
  from public.mundial_profiles p
  left join public.mundial_predictions pr on pr.user_id = p.id
  left join public.mundial_results r on r.match_id = pr.match_id
),
pts as (
  select
    user_id,
    username,
    result_id,
    (predicted = actual) as winner_ok,
    case when result_id is null then 0 else
      (case when predicted = actual then 1 else 0 end)
      + (case
           when is_ko and ph is not null and pa is not null
                and ph = rh and pa = ra then 3
           else 0
         end)
    end as points
  from scored
)
select
  user_id,
  username,
  count(*) filter (where result_id is not null) as predictions_scored,
  count(*) filter (where result_id is not null and winner_ok) as correct,
  coalesce(sum(points), 0)::int as points
from pts
group by user_id, username;
