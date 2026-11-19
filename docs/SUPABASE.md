# Login e sincronização (Supabase)

O Giro guarda tudo no aparelho e, com login, sincroniza com o Supabase.
Sem as variáveis abaixo, o app continua no modo local (sem login).

## 1. Criar o projeto
1. Entre em https://supabase.com → **New project**. Nome: `giro`. Região: **South America (São Paulo)**.
2. Guarde a senha do banco num lugar seguro (o app não usa, mas o Supabase pede).

## 2. Criar a tabela e as regras de segurança
1. No menu do projeto: **SQL Editor → New query**.
2. Cole o conteúdo inteiro de [`supabase/giro.sql`](../supabase/giro.sql) e clique em **Run**.
   Deve aparecer "Success". Pode rodar de novo sem problema.

## 3. Ajustar o login (Authentication)
- **Authentication → URL Configuration**
  - *Site URL*: o endereço do app na Vercel (ex.: `https://giro-xxxx.vercel.app`).
  - *Redirect URLs*: adicione o mesmo endereço e `http://localhost:5173` (para testar no PC).
- **Authentication → Sign In / Providers → Email**: deixe *Confirm email* ligado.
  Em *Minimum password length*, coloque **8**.
- **E-mails**: o e-mail padrão do Supabase manda poucas mensagens por hora (serve para testar).
  Antes de abrir para muita gente, configure um SMTP próprio em
  **Authentication → Emails → SMTP Settings** (ex.: Resend, Brevo) e traduza os textos dos e-mails
  em **Authentication → Emails → Templates**.

## 4. Ligar no app (Vercel)
1. No Supabase: **Project Settings → API Keys** → copie a *Publishable key* (`sb_publishable_…`).
   Em **Project Settings → Data API** copie a *Project URL*.
2. Na Vercel: projeto do Giro → **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = Publishable key
3. **Deployments → ⋯ → Redeploy** (as variáveis só valem num deploy novo).

A *publishable key* pode ficar no navegador: quem protege os dados são as regras (RLS) do banco,
que só deixam cada usuário ver e alterar o que é dele. **Nunca** coloque a *secret key* / *service_role* no app.

## Como funciona
- Cada registro do app vira uma linha em `public.records` (`user_id`, `collection`, `id`, `data`).
- O app grava no aparelho e põe a alteração numa fila; quando tem internet, envia (`push_records`)
  e baixa o que mudou em outros aparelhos. Conflito: vence a alteração mais recente.
- Primeiro login num aparelho que já tinha dados: os dados sobem para a conta
  (se a conta já tiver dados, o app pergunta se junta ou usa só os da conta).
- Sair apaga os dados do aparelho (continuam na conta). Excluir conta apaga tudo (`delete_account`).

## Perfil e painel do administrador
1. No SQL Editor, rode [`supabase/02_perfil.sql`](../supabase/02_perfil.sql) (depois do `giro.sql`).
2. Para se tornar administrador, rode no SQL Editor (troque o e-mail):
   ```sql
   insert into public.admins select id from auth.users where email = 'SEU-EMAIL' on conflict do nothing;
   ```
3. O painel (Ajustes → Conta → Painel do administrador) mostra só médias de quem marcou
   "participar das estatísticas". Grupos com menos de 5 pessoas não aparecem.
