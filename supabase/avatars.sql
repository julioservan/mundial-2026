-- ============================================================================
-- Mundial 2026 — Fotos de perfil (avatares)
-- Ejecuta este archivo UNA vez en el SQL Editor de Supabase, después del
-- schema.sql principal.
-- ============================================================================

-- 1) Columna para la URL de la foto en el perfil.
alter table public.mundial_profiles
  add column if not exists avatar_url text;

-- 2) Bucket público de Storage para los avatares.
insert into storage.buckets (id, name, public)
values ('mundial-avatars', 'mundial-avatars', true)
on conflict (id) do nothing;

-- 3) Políticas de Storage sobre el bucket de avatares.
--    Lectura pública; cada usuario sube/edita/borra SOLO en su carpeta (su uid).

drop policy if exists "mundial_avatars_read" on storage.objects;
create policy "mundial_avatars_read"
  on storage.objects for select
  using (bucket_id = 'mundial-avatars');

drop policy if exists "mundial_avatars_insert_own" on storage.objects;
create policy "mundial_avatars_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'mundial-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "mundial_avatars_update_own" on storage.objects;
create policy "mundial_avatars_update_own"
  on storage.objects for update
  using (
    bucket_id = 'mundial-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "mundial_avatars_delete_own" on storage.objects;
create policy "mundial_avatars_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'mundial-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
