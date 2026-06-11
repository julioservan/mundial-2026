-- ============================================================================
-- Mundial 2026 — Sistema de niveles (usuario / admin)
-- Ejecuta UNA vez en el SQL Editor de Supabase, después del schema.sql.
--
-- El nivel lo determina la columna `is_admin` de mundial_profiles:
--   is_admin = false -> Usuario   ·   is_admin = true -> Admin
-- Esto añade lo necesario para que un ADMIN pueda cambiar el nivel de otros
-- usuarios desde la propia web (no solo por SQL).
-- ============================================================================

-- Función segura para saber si un usuario es admin. SECURITY DEFINER evita
-- recursión de RLS al consultarla dentro de las políticas de la propia tabla.
create or replace function public.mundial_is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select is_admin from public.mundial_profiles where id = uid),
    false
  );
$$;

grant execute on function public.mundial_is_admin(uuid) to anon, authenticated;

-- Permite que un admin actualice cualquier perfil (p. ej. promover/retirar
-- admin). Se suma a la política existente de "editar tu propio perfil".
drop policy if exists "mundial_profiles_admin_update" on public.mundial_profiles;
create policy "mundial_profiles_admin_update"
  on public.mundial_profiles for update
  using (public.mundial_is_admin(auth.uid()))
  with check (public.mundial_is_admin(auth.uid()));
