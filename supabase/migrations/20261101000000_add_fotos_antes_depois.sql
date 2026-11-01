-- Fotos de "antes" e "depois" de cada procedimento (opcionais).
-- Os arquivos ficam no bucket privado "evidencias", na pasta de cada usuário,
-- e já são protegidos pelas políticas criadas em 20261029010000_add_evidencias.sql.
alter table public.registros
  add column if not exists foto_antes_path text check (char_length(foto_antes_path) <= 300),
  add column if not exists foto_depois_path text check (char_length(foto_depois_path) <= 300);
