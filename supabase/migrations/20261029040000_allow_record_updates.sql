create policy "Usuários podem atualizar os próprios registros"
on public.registros for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
