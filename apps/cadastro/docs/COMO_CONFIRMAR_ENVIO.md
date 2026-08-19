# Como saber se o cadastro foi enviado

Ao clicar em **Enviar cadastro da banca**, espere a mensagem azul `Enviando seus dados ao Supabase. Aguarde...`.

Quando o Supabase aceitar a inscrição, aparece uma tela verde com a mensagem:

> Cadastro enviado com sucesso. Comprovante #123. Sua inscrição está salva com status “recebida”.

O número depois de `#` será o código real da inscrição. Para conferir no Supabase, abra **Table Editor → stall_registrations**. Procure uma linha com o mesmo código na coluna `id` e com status `received`.

Se aparecer uma caixa vermelha, o cadastro não foi salvo. Leia a mensagem e confira o arquivo `.env`, a URL do Supabase e a Secret Key.

> Sempre abra o formulário por `http://localhost:3000` após executar `npm start`. Não abra o arquivo `index.html` com dois cliques.
