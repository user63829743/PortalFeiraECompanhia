# Portal das Feiras

Este repositório reúne os sistemas do Portal das Feiras.

## Aplicações

- `apps/portal-publico`: site público e integração com os vídeos da TVegNews.
- `apps/cadastro`: formulário de cadastro de bancas e integração com o Supabase.
- `apps/admin`: painel administrativo e integração segura com o Supabase.

## Como executar

Na raiz do projeto:

```powershell
npm start
```

O portal público estará em `http://localhost:3000`.

Para executar o cadastro em outra janela:

```powershell
npm run start:cadastro
```

O cadastro estará em `http://localhost:3001`.

Para executar somente o painel administrativo:

```powershell
npm run start:admin
```

O painel estará em `http://localhost:3002`.

Para iniciar tudos juntos:

```powershell
npm run start:all
```

## Organização

- `public/`: arquivos que o navegador acessa, como HTML, CSS, JavaScript e imagens.
- `database/`: scripts SQL e arquivos do banco de dados.
- `docs/`: documentação e instruções de cada aplicação.
