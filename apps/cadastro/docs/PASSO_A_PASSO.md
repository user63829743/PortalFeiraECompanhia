# Como ligar o cadastro ao Supabase — passo a passo

Siga esta ordem. Você não precisa mexer no código do formulário; somente colocar os arquivos, criar a tabela e preencher um arquivo de configuração.

## 1. Instale o Node.js

Abra [nodejs.org](https://nodejs.org/en/download) e instale a versão **LTS**. Depois da instalação, abra o terminal e teste:

```bash
node -v
```

Se aparecer um número de versão, está certo.

## 2. Coloque os arquivos em uma pasta

Descompacte `cadastro-bancas-html-supabase.zip`. A pasta deve ficar assim:

```text
cadastro-bancas-html-supabase/
├── index.html
├── styles.css
├── script.js
├── server.js
├── package.json
├── supabase.sql
├── .env.example
└── PASSO_A_PASSO.md
```

> Não abra o `index.html` com dois cliques. O formulário precisa ser aberto pelo Node.js para conseguir enviar a inscrição ao Supabase.

## 3. Crie seu projeto no Supabase

Entre em [supabase.com/dashboard](https://supabase.com/dashboard), faça login e clique em **New project**. Escolha um nome e guarde a senha do banco em local seguro. Espere o projeto terminar de criar.

## 4. Crie a tabela de inscrições

No menu do Supabase, abra **SQL Editor**, clique em **New query**, abra o arquivo `supabase.sql` no seu computador, copie todo o texto e cole no editor. Clique em **Run**.

Depois, abra **Table Editor**. Você deve ver a tabela `stall_registrations`.

## 5. Pegue a URL e a chave do Supabase

No Supabase, abra **Settings → API Keys**. Copie dois itens:

| Item no Supabase | Onde colocar |
| --- | --- |
| Project URL | `SUPABASE_URL` |
| Secret key | `SUPABASE_SECRET_KEY` |

> Use a **Secret key** somente no arquivo `.env`. Ela dá acesso elevado ao banco e nunca pode ir para o HTML, CSS ou `script.js`. [1]

## 6. Crie e preencha o arquivo `.env`

Na pasta do cadastro, renomeie `.env.example` para `.env`. Abra o `.env` no Bloco de Notas ou VS Code e deixe assim:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SECRET_KEY=cole_a_secret_key_aqui
PORT=3000
```

Troque somente os dois valores depois do sinal `=`. Salve o arquivo.

## 7. Inicie o formulário

Abra o terminal dentro da pasta `cadastro-bancas-html-supabase` e execute:

```bash
npm start
```

Quando aparecer `Cadastro disponível em http://localhost:3000`, abra este endereço no navegador:

```text
http://localhost:3000
```

Preencha o formulário e clique em **Enviar cadastro da banca**. Se aparecer a mensagem **Obrigado por cadastrar sua banca**, deu certo.

## 8. Confira se salvou no Supabase

Volte ao Supabase, abra **Table Editor → stall_registrations** e atualize a página. A nova inscrição aparecerá na lista com o status `received`.

## 9. Coloque o botão no seu portal

No seu portal principal, faça o botão **Cadastrar agora** abrir a página do cadastro. Se os dois estiverem no mesmo servidor, use:

```html
<a href="/cadastro-bancas-html-supabase/" class="btn">Cadastrar agora</a>
```

Se o cadastro estiver em outra hospedagem, troque o `href` pelo endereço completo dela.

## Se der erro

| Mensagem | O que conferir |
| --- | --- |
| `Supabase não configurado` | Veja se existe o arquivo `.env` e se a URL e chave foram preenchidas. |
| `Cannot find module` ou `node não é reconhecido` | Instale ou reinstale o Node.js LTS e abra o terminal novamente. |
| Não aparece inscrição na tabela | Verifique se você executou todo o arquivo `supabase.sql` e se está vendo a tabela correta. |
| Chave exposta no site | Apague a chave, crie outra no Supabase e deixe-a apenas no `.env`. |

## Referências

[1]: https://supabase.com/docs/guides/api/api-keys "Supabase — Understanding API keys"
[2]: https://nodejs.org/en/download "Node.js — Download"
