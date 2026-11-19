-- =============================================================================
-- Giro · banco na nuvem (Supabase)
-- Cole este arquivo inteiro no Supabase: SQL Editor → New query → Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- Modelo: o app continua guardando tudo no aparelho e sincroniza aqui.
-- Cada registro do app (lançamento, meta, veículo…) vira uma linha em "records".
-- Segurança: RLS — cada usuário só enxerga e altera as próprias linhas.
-- =============================================================================

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null check (collection ~ '^[a-zA-Z]{1,40}$'),
  id         text        not null check (char_length(id) between 1 and 80),
  data       jsonb,
  deleted    boolean     not null default false,
  -- Momento da alteração no aparelho: decide quem ganha num conflito (a mais recente).
  updated_at timestamptz not null,
  -- Contador do servidor: os aparelhos baixam "tudo com rev maior que o último que vi".
  rev        bigint      not null default 0,
  primary key (user_id, collection, id),
  -- Proteção contra abuso: um registro (mesmo com foto) não passa de ~1,5 MB.
  constraint records_size check (data is null or octet_length(data::text) < 1500000)
);

create sequence if not exists public.records_rev_seq;
create index if not exists records_user_rev on public.records (user_id, rev);

alter table public.records enable row level security;

drop policy if exists "records: dono lê" on public.records;
create policy "records: dono lê" on public.records for select to authenticated using (user_id = (select auth.uid()));
-- Gravações passam só pela função push_records (abaixo), que aplica as regras de conflito.

revoke all on public.records from anon, authenticated;
grant select on public.records to authenticated;

-- -----------------------------------------------------------------------------
-- push_records: recebe uma lista de alterações do aparelho.
-- Cada item: { "collection", "id", "data", "deleted", "updated_at" }.
-- Só grava se for mais recente que o que já está no servidor.
-- Devolve quantos itens foram aceitos.
-- -----------------------------------------------------------------------------
create or replace function public.push_records(items jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  accepted integer := 0;
  n integer;
  it jsonb;
begin
  if uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 500 then
    raise exception 'envie de 1 a 500 itens' using errcode = '22023';
  end if;
  -- Um envio por usuário de cada vez: mantém "rev" na ordem em que fica visível.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  for it in select * from jsonb_array_elements(items) loop
    insert into public.records as r (user_id, collection, id, data, deleted, updated_at, rev)
    values (
      uid,
      it->>'collection',
      it->>'id',
      case when coalesce((it->>'deleted')::boolean, false) then null else it->'data' end,
      coalesce((it->>'deleted')::boolean, false),
      (it->>'updated_at')::timestamptz,
      nextval('public.records_rev_seq')
    )
    on conflict (user_id, collection, id) do update
      set data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at, rev = excluded.rev
      where r.updated_at <= excluded.updated_at;
    get diagnostics n = row_count;
    accepted := accepted + n;
  end loop;
  return accepted;
end;
$$;

-- A função roda com as permissões de quem chama (security invoker), então precisa de insert/update.
-- Mesmo assim, as políticas abaixo garantem que só dá para gravar linhas próprias.
grant insert, update on public.records to authenticated;
grant usage on sequence public.records_rev_seq to authenticated;

drop policy if exists "records: dono grava" on public.records;
create policy "records: dono grava" on public.records for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "records: dono altera" on public.records;
create policy "records: dono altera" on public.records for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke execute on function public.push_records(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- delete_account: o próprio usuário apaga a conta e todos os dados (LGPD).
-- Roda como dono do banco para poder remover o login em auth.users.
-- -----------------------------------------------------------------------------
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  delete from public.records where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- Faz a API do Supabase reconhecer na hora a tabela e as funções novas.
notify pgrst, 'reload schema';
