create table if not exists public.registros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  procedimento text not null check (char_length(procedimento) between 1 and 160),
  categoria text not null check (categoria in ('Cabelo', 'Unhas', 'Sobrancelha', 'Estética', 'Depilação', 'Maquiagem', 'Outros')),
  local text not null default '' check (char_length(local) <= 160),
  data date not null,
  hora time not null,
  valor numeric(12, 2) not null check (valor >= 0),
  notas text check (char_length(notas) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.registros enable row level security;

create policy "Usuários podem consultar os próprios registros"
on public.registros for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Usuários podem criar os próprios registros"
on public.registros for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Usuários podem excluir os próprios registros"
on public.registros for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists registros_user_data_idx
on public.registros (user_id, data desc, hora desc);
