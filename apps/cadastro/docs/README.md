# Cadastro de Bancas — HTML, CSS, Node.js e Supabase

Este pacote não usa React, TypeScript, tRPC ou MySQL. O formulário é **HTML + CSS + JavaScript**. O `server.js` usa apenas recursos nativos do **Node.js** e envia os dados para a API REST do **Supabase**.

## Configuração

| Passo | Ação |
| --- | --- |
| 1 | No Supabase, abra o **SQL Editor** e execute o conteúdo de `supabase.sql`. |
| 2 | Copie `.env.example` para um arquivo chamado `.env`. |
| 3 | No painel do Supabase, abra **Settings → API Keys** e preencha `SUPABASE_URL` e `SUPABASE_SECRET_KEY` no `.env`. |
| 4 | No terminal, dentro da pasta, execute `npm start`. |
| 5 | Abra `http://localhost:3000` no navegador. |

> **Importante:** nunca coloque a `SUPABASE_SECRET_KEY` no `script.js`, no `index.html` ou em arquivos públicos. Ela deve ficar somente no `.env`, junto ao `server.js`.

## Arquivos

| Arquivo | Função |
| --- | --- |
| `index.html` | Formulário e tela de confirmação. |
| `styles.css` | Layout responsivo de computador e celular. |
| `script.js` | Valida os campos e envia a inscrição para o Node.js. |
| `server.js` | Valida novamente, protege a chave e grava no Supabase. |
| `supabase.sql` | Cria a tabela `stall_registrations`. |

Para colocar no seu portal, mantenha todos esses arquivos juntos em uma pasta e faça seu botão **Cadastrar agora** abrir a página `index.html` servida pelo Node.js.

## Como confirmar o envio

Após um envio bem-sucedido, o formulário mostra uma tela verde com um código de comprovante, por exemplo `#123`. Esse código corresponde à coluna `id` da tabela `stall_registrations` no Supabase. Leia também o arquivo `COMO_CONFIRMAR_ENVIO.md`.
