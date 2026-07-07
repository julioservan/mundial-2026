-- ============================================================================
-- Mundial 2026 — Papelera de pronósticos (red de seguridad ante borrados)
-- ----------------------------------------------------------------------------
-- Ejecuta este archivo UNA vez en el SQL Editor de Supabase.
--
-- Motivo: un cliente con una versión ANTIGUA de la web cacheada (pestaña de
-- móvil abierta durante semanas) ejecutó una limpieza de "huérfanos" ya
-- retirada y borró pronósticos de eliminatorias. El backup diario ayuda, pero
-- puede tener hasta ~20 h de retraso. Esta papelera captura CADA fila borrada
-- en el momento exacto del borrado, venga de donde venga, y hace la
-- recuperación trivial.
-- ============================================================================

create table if not exists public.mundial_pred_trash (
  id         bigint generated always as identity primary key,
  user_id    uuid not null,
  match_id   text not null,
  pick       text,
  home_score smallint,
  away_score smallint,
  advance    text,
  deleted_at timestamptz not null default now()
);

alter table public.mundial_pred_trash enable row level security;

-- Solo admins pueden leer (contiene pronósticos de todos). Nadie escribe desde
-- el navegador: escribe el trigger (security definer).
drop policy if exists "mundial_pred_trash_admin_select" on public.mundial_pred_trash;
create policy "mundial_pred_trash_admin_select"
  on public.mundial_pred_trash for select
  using (
    exists (
      select 1 from public.mundial_profiles
      where id = auth.uid() and is_admin
    )
  );

-- Trigger: cada DELETE en mundial_predictions deja copia en la papelera.
-- SECURITY DEFINER para que el insert no dependa de los permisos de quien borra.
create or replace function public.mundial_pred_trash_capture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mundial_pred_trash
    (user_id, match_id, pick, home_score, away_score, advance)
  values
    (old.user_id, old.match_id, old.pick, old.home_score, old.away_score, old.advance);
  return old;
end;
$$;

drop trigger if exists mundial_pred_trash_on_delete on public.mundial_predictions;
create trigger mundial_pred_trash_on_delete
  before delete on public.mundial_predictions
  for each row execute function public.mundial_pred_trash_capture();

-- ----------------------------------------------------------------------------
-- Restaurar desde la papelera (ejemplo): re-inserta las filas borradas de un
-- usuario desde una fecha, sin pisar pronósticos que ya existan de nuevo.
--
--   insert into public.mundial_predictions
--     (user_id, match_id, pick, home_score, away_score, advance, updated_at)
--   select distinct on (match_id)
--     user_id, match_id, pick, home_score, away_score, advance, now()
--   from public.mundial_pred_trash
--   where user_id = (select id from public.mundial_profiles where username = 'X')
--     and deleted_at > '2026-07-06'
--   order by match_id, deleted_at desc
--   on conflict (user_id, match_id) do nothing;
-- ----------------------------------------------------------------------------
