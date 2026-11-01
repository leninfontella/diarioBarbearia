update public.registros
set notas = null
where btrim(notas) ~* '^Importado da planilha Procedimentos\.xlsx\.?$';
