# Jéssica Salão

Diário pessoal de beleza para registrar procedimentos e acompanhar gastos. Interface responsiva, com login por e-mail e senha e registros protegidos no Supabase.

## Desenvolvimento

Requer Node.js e npm.

```sh
npm install
copy .env.example .env
npm run dev
```

Preencha o `.env` com a URL e a chave publishable do projeto. Depois execute o arquivo
`supabase/migrations/20261029000000_create_registros.sql` no SQL Editor do Supabase.
No Supabase, mantenha o provedor de e-mail habilitado. Para permitir o cadastro imediato sem mensagem de confirmação, desative **Authentication → Providers → Email → Confirm email**.

## Verificação

```sh
npm test
npm run build
```

## PWA no iPhone

Publique o resultado do build em HTTPS. No Safari, abra o site, toque em
Compartilhar e escolha **Adicionar à Tela de Início**. O ícone abre o diário
como um aplicativo, sem a barra de navegação do navegador.

O build gera `.output/public/sw.js` com a página inicial, scripts, estilos e
imagens usados pelo aplicativo. A leitura e a alteração dos registros exigem
conexão com o Supabase.
No desenvolvimento (`npm run dev`), o service worker fica desativado.
Para testar o PWA localmente, use `npm run build` e `npm run preview`.

Atualizações entram quando todas as janelas da versão anterior forem fechadas
e o aplicativo for aberto novamente. Os procedimentos não são gravados no
armazenamento local: cada conta acessa seus próprios registros por meio das
políticas RLS do Supabase. O cliente Supabase mantém apenas a sessão de acesso.
