# Portal das Feiras — GitHub e Vercel

Este repositório contém três aplicações Node independentes: o portal público, o cadastro de bancas e o painel administrativo. Cada aplicação possui seu próprio `vercel.json` e deve ser importada no Vercel como um projeto separado usando a mesma base do GitHub.

## Publicação

1. Crie um repositório privado no GitHub e envie o conteúdo desta pasta para ele. Não envie arquivos `.env`, chaves ou senhas.
2. No Vercel, crie o projeto do portal usando o repositório e defina **Root Directory** como `apps/portal-publico`.
3. Crie outro projeto usando o mesmo repositório e defina **Root Directory** como `apps/cadastro`.
4. Crie o terceiro projeto usando o mesmo repositório e defina **Root Directory** como `apps/admin`.
5. Em cada projeto, cadastre as variáveis de ambiente em **Settings → Environment Variables** e marque Production, Preview e Development quando necessário.

## Variáveis

O portal público e o cadastro precisam de `SUPABASE_URL` e `SUPABASE_SECRET_KEY`. O admin precisa dessas duas variáveis, além de `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` e `SESSION_SECRET`. Use uma chave aleatória longa em `SESSION_SECRET`; não reutilize a chave secreta do Supabase como segredo de sessão quando puder evitar.

```env
SUPABASE_URL=https://hyykidvtofenwfygzlhr.supabase.co
SUPABASE_SECRET_KEY=sb_secret_sua_chave
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=scrypt$...
SESSION_SECRET=uma-chave-aleatoria-longa
```

## Links entre projetos

O header usa `/cadastro/` para o link **Anuncie**. Se o projeto de cadastro receber um domínio próprio diferente do domínio do portal, substitua esse endereço em `apps/portal-publico/public/shared/layout.js` e em `apps/portal-publico/public/index.html` pelo domínio público do cadastro.

O botão **TVegNews** já aponta para:

`https://tvegnews-zccwximc.manus.space/`

## Observação sobre o admin

A sessão do admin foi convertida para cookie assinado, compatível com funções serverless. Por isso, `SESSION_SECRET` é obrigatório no projeto admin. Depois de cadastrar as variáveis, faça um novo deploy para que o Vercel injete a configuração.

## Teste pós-deploy

Teste a home, `/feiras/`, `/feirantes/`, o envio de cadastro, `/api/health` no admin, login, listagem de cadastros e upload de banners. Se o link Anuncie retornar 404, use o domínio público do projeto de cadastro no lugar de `/cadastro/`.
