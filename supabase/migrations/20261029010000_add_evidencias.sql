alter table public.registros
  add column if not exists evidencia_path text;

alter table public.registros
  drop constraint if exists registros_categoria_check;

-- Registros antigos continuam legíveis, mas novos registros aceitam apenas as categorias atuais.
alter table public.registros
  add constraint registros_categoria_check
  check (categoria in ('Cabelo', 'Unhas', 'Sobrancelha', 'Estética', 'Outros')) not valid;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias',
  'evidencias',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Usuários podem consultar as próprias evidências"
on storage.objects for select
to authenticated
using (bucket_id = 'evidencias' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Usuários podem enviar as próprias evidências"
on storage.objects for insert
to authenticated
with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Usuários podem excluir as próprias evidências"
on storage.objects for delete
to authenticated
using (bucket_id = 'evidencias' and (storage.foldername(name))[1] = (select auth.uid()::text));
