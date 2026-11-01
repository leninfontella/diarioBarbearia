-- Perfil exibido no app (foto, nome e cidade), um por usuário.
create table if not exists public.perfis (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  nome text not null default '' check (char_length(nome) <= 80),
  cidade text not null default '' check (char_length(cidade) <= 80),
  foto_path text check (char_length(foto_path) <= 300),
  updated_at timestamptz not null default now()
);

alter table public.perfis enable row level security;

create policy "Usuários podem consultar o próprio perfil"
on public.perfis for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Usuários podem criar o próprio perfil"
on public.perfis for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Usuários podem atualizar o próprio perfil"
on public.perfis for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Fotos de perfil: bucket privado, cada usuário só acessa a própria pasta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-perfil',
  'fotos-perfil',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Usuários podem consultar a própria foto de perfil"
on storage.objects for select
to authenticated
using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Usuários podem enviar a própria foto de perfil"
on storage.objects for insert
to authenticated
with check (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Usuários podem excluir a própria foto de perfil"
on storage.objects for delete
to authenticated
using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = (select auth.uid()::text));
