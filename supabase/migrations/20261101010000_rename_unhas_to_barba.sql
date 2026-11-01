-- Categoria "Unhas" passa a se chamar "Barba".
alter table public.registros
  drop constraint if exists registros_categoria_check;

update public.registros
  set categoria = 'Barba'
  where categoria = 'Unhas';

-- Registros antigos continuam legíveis, mas novos registros aceitam apenas as categorias atuais.
alter table public.registros
  add constraint registros_categoria_check
  check (categoria in ('Cabelo', 'Barba', 'Sobrancelha', 'Estética', 'Outros')) not valid;
