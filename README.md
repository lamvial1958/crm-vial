# CRM Vial

CRM básico para acompanhar envios e respostas de contatos comerciais. Campos: Empresa, Setor, Nome do Contato, Cargo, E-mail, Data do Envio, Status (Sem resposta / Interessado / Recusado), Próximo Passo e Acompanhamento (data do próximo contato com a empresa).

É um site estático (HTML/CSS/JS puro, sem build) que usa **Firebase** como banco de dados, então funciona igual no computador e no celular, sempre sincronizado, e não depende do navegador para guardar os dados.

## 1. Criar o projeto Firebase

1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto**. Dê o nome que quiser (ex: `crm-vial`) e conclua a criação (pode desativar o Google Analytics, não é necessário).
2. No menu lateral, vá em **Compilação > Authentication** → aba **Sign-in method** → ative o provedor **Google** (defina o "e-mail de suporte do projeto" quando pedido).
3. O acesso é restrito a um único e-mail Google (`viallamv@gmail.com`), verificado tanto no `app.js` quanto nas regras do Firestore — não é preciso cadastrar usuário manualmente.
4. No menu lateral, vá em **Compilação > Firestore Database** → **Criar banco de dados** → escolha o modo de produção e a região mais próxima (ex: `southamerica-east1`).
5. Na aba **Regras** do Firestore, cole o conteúdo do arquivo [`firestore.rules`](./firestore.rules) deste projeto e publique.
6. Em **Authentication > Settings > Authorized domains**, adicione o domínio onde o site vai ficar publicado (ex: `lamvial1958.github.io`) — sem isso o login com Google é bloqueado nesse domínio.

## 2. Pegar as credenciais do app

1. No console do Firebase, clique na engrenagem ⚙️ ao lado de "Visão geral do projeto" → **Configurações do projeto**.
2. Na seção **Seus aplicativos**, clique no ícone `</>` (Web) para registrar um app. Dê um apelido (ex: `crm-web`) e clique em **Registrar app**. Não precisa marcar Firebase Hosting.
3. Copie o objeto `firebaseConfig` que aparece e cole em [`firebase-config.js`](./firebase-config.js), substituindo os valores `COLE_AQUI_SUA_API_KEY` etc.

> Essas chaves não são "secretas" — elas ficam visíveis no código do navegador de qualquer site Firebase. Quem protege os dados de verdade são as regras do Firestore (passo 1.5), que exigem login.

## 3. Testar localmente

Como o app usa `type="module"`, você precisa servir os arquivos por HTTP (abrir o `index.html` direto com `file://` não funciona). Qualquer servidor estático serve, por exemplo:

```bash
npx serve .
```

Depois abra a URL indicada no navegador e clique em "Entrar com Google" (em `localhost` o Firebase já libera por padrão).

## 4. Publicar no GitHub Pages

1. Crie um repositório no GitHub (pode ser privado ou público — os dados não ficam no repositório, só o código).
2. Suba os arquivos:
   ```bash
   git init
   git add .
   git commit -m "CRM Vial inicial"
   git branch -M main
   git remote add origin <URL_DO_SEU_REPOSITORIO>
   git push -u origin main
   ```
3. No GitHub, vá em **Settings > Pages**, em "Build and deployment" escolha **Deploy from a branch**, selecione a branch `main` e a pasta `/ (root)`.
4. Em alguns minutos o site estará disponível em `https://<seu-usuario>.github.io/<nome-do-repo>/`. Acesse esse link tanto no computador quanto no celular — os dados aparecem sincronizados nos dois, em tempo real.

## Uso

- **Novo contato**: botão "+ Novo contato".
- **Editar**: clique em qualquer linha da tabela.
- **Excluir**: abra o contato e clique em "Excluir".
- **Buscar/filtrar**: campo de busca (empresa, contato, setor) e filtro por status no topo.
- **Sair**: botão "Sair" no canto superior direito (some o acesso até logar novamente).
- **Acompanhamento**: ao abrir o app, se algum contato tiver uma data de acompanhamento vencida (hoje ou antes) que ainda não foi tratada, aparece um aviso com a lista desses contatos. Para cada um você escolhe "Ver contato" (abre para editar) ou "Deixar passar" (dispensa o aviso); se a data for alterada depois, o aviso pode voltar a aparecer.

## Estrutura dos arquivos

| Arquivo | Função |
|---|---|
| `index.html` | Telas de login e do CRM (tabela + modal de contato) |
| `style.css` | Estilos |
| `app.js` | Lógica: autenticação e CRUD no Firestore em tempo real |
| `firebase-config.js` | Credenciais do seu projeto Firebase (você preenche) |
| `firestore.rules` | Regra de segurança: só usuários logados acessam os dados |
