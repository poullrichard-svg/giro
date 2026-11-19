-- =============================================================================
-- Giro · perfil do usuário e painel de estatísticas (administrador)
-- Rode DEPOIS do giro.sql. Pode rodar de novo sem problema.
--
-- Privacidade (LGPD):
--   - Cada pessoa só lê e altera o próprio perfil.
--   - O painel do administrador mostra SÓ médias e totais de quem aceitou
--     participar das estatísticas (consent_stats), nunca dados de uma pessoa.
--   - Grupos com menos de 5 pessoas não aparecem (para ninguém ser identificado).
-- =============================================================================

create table if not exists public.profiles (
  id             uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  full_name      text not null check (char_length(full_name) between 2 and 80),
  birth_date     date not null check (birth_date > '1900-01-01'),
  avatar         text check (avatar is null or (avatar like 'data:image/%' and octet_length(avatar) < 120000)),
  monthly_income numeric(12,2) check (monthly_income is null or monthly_income between 0 and 10000000),
  occupation     text check (occupation is null or char_length(occupation) <= 40),
  city           text check (city is null or char_length(city) <= 60),
  state          text check (state is null or state ~ '^[A-Z]{2}$'),
  consent_stats  boolean not null default false,
  terms_accepted_at timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "perfil: dono lê" on public.profiles;
create policy "perfil: dono lê" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "perfil: dono cria" on public.profiles;
create policy "perfil: dono cria" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "perfil: dono altera" on public.profiles;
create policy "perfil: dono altera" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Perfil: leitura e gravação pelo app.
drop function if exists public.get_my_profile();
create or replace function public.get_my_profile()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select to_jsonb(p) from public.profiles p where p.id = auth.uid();
$$;

drop function if exists public.save_my_profile(jsonb);
create or replace function public.save_my_profile(p jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); r public.profiles; bd date := (p->>'birth_date')::date;
begin
  if uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  if bd > (current_date - interval '18 years') then raise exception 'É preciso ter 18 anos ou mais' using errcode = '22023'; end if;
  insert into public.profiles as x (id, full_name, birth_date, avatar, monthly_income, occupation, city, state, consent_stats)
  values (uid, trim(p->>'full_name'), bd, nullif(p->>'avatar', ''), (p->>'monthly_income')::numeric,
          nullif(p->>'occupation', ''), nullif(trim(p->>'city'), ''), nullif(upper(p->>'state'), ''), coalesce((p->>'consent_stats')::boolean, false))
  on conflict (id) do update set
    full_name = excluded.full_name, birth_date = excluded.birth_date, avatar = excluded.avatar,
    monthly_income = excluded.monthly_income, occupation = excluded.occupation, city = excluded.city,
    state = excluded.state, consent_stats = excluded.consent_stats, updated_at = now()
  returning * into r;
  return to_jsonb(r);
end; $$;

revoke execute on function public.get_my_profile() from public, anon;
revoke execute on function public.save_my_profile(jsonb) from public, anon;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.save_my_profile(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Administradores (quem vê o painel). Ninguém consegue se colocar aqui pelo app:
-- só pelo SQL Editor do Supabase.
-- -----------------------------------------------------------------------------
create table if not exists public.admins (user_id uuid primary key references auth.users (id) on delete cascade);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- admin_overview: números agregados para o painel. Só administradores.
-- month: 'YYYY-MM' (padrão: mês anterior, que já está fechado).
-- -----------------------------------------------------------------------------
create or replace function public.admin_overview(month text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  m text := coalesce(month, to_char(date_trunc('month', now()) - interval '1 month', 'YYYY-MM'));
  k int := 5; -- tamanho mínimo de grupo
  res jsonb;
begin
  if not public.is_admin() then raise exception 'apenas administradores' using errcode = '42501'; end if;

  with
  pub as (select * from public.profiles where consent_stats),
  ages as (
    select case when a < 25 then '18–24' when a < 35 then '25–34' when a < 45 then '35–44' when a < 60 then '45–59' else '60+' end as faixa, monthly_income
    from (select extract(year from age(birth_date))::int as a, monthly_income from pub) s
  ),
  tx as (
    select r.user_id, coalesce(r.data->>'category', 'Outros') as cat, (r.data->>'amount')::numeric as amount, r.data->>'type' as type
    from public.records r join pub on pub.id = r.user_id
    where r.collection = 'transactions' and not r.deleted and r.data->>'internal' is null
      and coalesce(nullif(r.data->>'invoiceMonth', ''), left(r.data->>'date', 7)) = m
  ),
  fx as (
    select r.user_id, coalesce(r.data->>'category', 'Outros') as cat, (r.data->>'amount')::numeric as amount, r.data->>'type' as type
    from public.records r join pub on pub.id = r.user_id
    where r.collection = 'fixed' and not r.deleted
  ),
  money as (select * from tx union all select * from fx),
  active as (select distinct user_id from tx),
  per_user as (
    select user_id, sum(amount) filter (where type = 'income') as inc, sum(amount) filter (where type = 'expense') as exp
    from money where user_id in (select user_id from active) group by user_id
  ),
  cats as (
    select cat, count(distinct user_id) as n, round(sum(amount) / (select count(*) from active), 2) as media_por_usuario
    from money where type = 'expense' and user_id in (select user_id from active) group by cat
  ),
  ses as (
    select r.user_id, coalesce(r.data->>'app', 'Outro') as app, (r.data->>'amount')::numeric as amount,
      coalesce(nullif(split_part(r.data->>'hoursWorked', ':', 1), '')::numeric, 0) + coalesce(nullif(split_part(r.data->>'hoursWorked', ':', 2), '')::numeric, 0) / 60 as hours,
      coalesce((r.data->>'kmDriven')::numeric, 0) as km
    from public.records r join pub on pub.id = r.user_id
    where r.collection = 'sessions' and not r.deleted and left(r.data->>'date', 7) = m
  ),
  apps as (
    select app, count(distinct user_id) as n, round(sum(amount) / nullif(sum(hours), 0), 2) as por_hora,
           round(sum(amount) / nullif(sum(km), 0), 2) as por_km, round(sum(amount) / count(distinct user_id), 2) as media_mes_por_motorista
    from ses group by app
  )
  select jsonb_build_object(
    'mes', m,
    'usuarios', (select count(*) from auth.users),
    'novos_30_dias', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'com_perfil', (select count(*) from public.profiles),
    'participam_estatisticas', (select count(*) from pub),
    'grupo_minimo', k,
    'idade', (select coalesce(jsonb_agg(jsonb_build_object('faixa', faixa, 'n', n, 'renda_media', case when n_renda >= k then renda end) order by faixa), '[]')
              from (select faixa, count(*) as n, count(monthly_income) as n_renda, round(avg(monthly_income), 2) as renda from ages group by faixa having count(*) >= k) s),
    'renda', (select case when count(monthly_income) >= k then jsonb_build_object('n', count(monthly_income), 'media', round(avg(monthly_income), 2),
                'mediana', round((percentile_cont(0.5) within group (order by monthly_income))::numeric, 2)) end from pub),
    'ocupacao', (select coalesce(jsonb_agg(jsonb_build_object('ocupacao', o, 'n', n) order by n desc), '[]')
                 from (select coalesce(occupation, 'não informado') as o, count(*) as n from pub group by 1 having count(*) >= k) s),
    'estado', (select coalesce(jsonb_agg(jsonb_build_object('uf', uf, 'n', n) order by n desc), '[]')
               from (select coalesce(state, '—') as uf, count(*) as n from pub group by 1 having count(*) >= k) s),
    'usuarios_ativos_no_mes', (select count(*) from active),
    'mes_medio', (select case when count(*) >= k then jsonb_build_object('entradas', round(avg(coalesce(inc, 0)), 2), 'saidas', round(avg(coalesce(exp, 0)), 2)) end from per_user),
    'gastos_por_categoria', (select case when (select count(*) from active) >= k then coalesce(jsonb_agg(jsonb_build_object('categoria', cat, 'media_por_usuario', media_por_usuario, 'n', n) order by media_por_usuario desc), '[]') else '[]' end
                             from cats where n >= k),
    'aplicativos', (select coalesce(jsonb_agg(jsonb_build_object('app', app, 'motoristas', n, 'por_hora', por_hora, 'por_km', por_km, 'media_mes', media_mes_por_motorista) order by por_hora desc nulls last), '[]')
                    from apps where n >= k)
  ) into res;
  return res;
end; $$;
revoke execute on function public.admin_overview(text) from public, anon;
grant execute on function public.admin_overview(text) to authenticated;

notify pgrst, 'reload schema';
