-- Haydovchi balansi (komissiya) va ball tizimi
-- Avval 011_features.sql bajarilgan bo'lishi kerak.
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.

-- ---------- Ustunlar ----------
alter table public.users add column if not exists balance integer not null default 0;          -- so'm
alter table public.users add column if not exists score smallint not null default 80 check (score between 0 and 100);
alter table public.users add column if not exists red_until timestamptz;                       -- qizil pauza tugashi
alter table public.users add column if not exists score_recovered_on date;                     -- oxirgi kunlik tiklanish

alter table public.app_settings add column if not exists commission_pct numeric(4, 2) not null default 10
  check (commission_pct >= 0 and commission_pct <= 30);

-- ---------- Balans harakatlari ----------
create table if not exists public.driver_transactions (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references public.users (id) on delete cascade,
  amount        integer not null check (amount <> 0),           -- + to'ldirish, − komissiya
  kind          text not null check (kind in ('commission', 'topup', 'adjust')),
  order_id      uuid references public.orders (id) on delete set null,
  note          text,
  created_by    uuid references public.users (id) on delete set null,
  balance_after integer not null,
  created_at    timestamptz not null default now()
);
-- Bitta safardan komissiya faqat bir marta
create unique index if not exists driver_tx_commission_once on public.driver_transactions (order_id) where kind = 'commission';
create index if not exists driver_tx_driver_idx on public.driver_transactions (driver_id, created_at desc);

-- ---------- Ball tarixi ----------
create table if not exists public.driver_score_events (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.users (id) on delete cascade,
  delta       smallint not null,
  reason      text not null check (reason in ('completed', 'rating_5', 'rating_low', 'driver_cancel', 'daily', 'admin', 'red_reset')),
  order_id    uuid references public.orders (id) on delete set null,
  note        text,
  created_by  uuid references public.users (id) on delete set null,
  score_after smallint not null,
  created_at  timestamptz not null default now()
);
-- Bitta safar uchun bir sabab — bir marta
create unique index if not exists driver_score_once on public.driver_score_events (order_id, reason) where order_id is not null;
create index if not exists driver_score_driver_idx on public.driver_score_events (driver_id, created_at desc);

alter table public.driver_transactions enable row level security;
alter table public.driver_score_events enable row level security;
revoke all on public.driver_transactions from anon, authenticated;
revoke all on public.driver_score_events from anon, authenticated;

-- ---------- Balansni o'zgartirish (atomar) ----------
-- Komissiya shu safardan olingan bo'lsa — null qaytadi (takror yechilmaydi)
create or replace function public.apply_wallet_tx(
  p_driver uuid, p_amount integer, p_kind text,
  p_order uuid default null, p_note text default null, p_by uuid default null
) returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_kind = 'commission' and p_order is not null
     and exists (select 1 from driver_transactions where order_id = p_order and kind = 'commission') then
    return null;
  end if;
  update users set balance = balance + p_amount
  where id = p_driver and role = 'driver'
  returning balance into new_balance;
  if new_balance is null then
    raise exception 'Haydovchi topilmadi';
  end if;
  insert into driver_transactions (driver_id, amount, kind, order_id, note, created_by, balance_after)
  values (p_driver, p_amount, p_kind, p_order, p_note, p_by, new_balance);
  return new_balance;
end;
$$;

-- ---------- Ballni o'zgartirish (atomar) ----------
-- 40 dan pastga tushsa — 1 soat pauza (davom etayotgan pauza uzaytirilmaydi)
create or replace function public.apply_score(
  p_driver uuid, p_delta integer, p_reason text,
  p_order uuid default null, p_note text default null, p_by uuid default null
) returns table (out_score smallint, out_red_until timestamptz)
language plpgsql
security definer set search_path = public
as $$
declare
  s integer;
  r timestamptz;
begin
  if p_order is not null
     and exists (select 1 from driver_score_events e where e.order_id = p_order and e.reason = p_reason) then
    return query select u.score, u.red_until from users u where u.id = p_driver;
    return;
  end if;
  update users u set score = least(100, greatest(0, u.score + p_delta))
  where u.id = p_driver and u.role = 'driver'
  returning u.score, u.red_until into s, r;
  if s is null then
    raise exception 'Haydovchi topilmadi';
  end if;
  if s < 40 and p_delta < 0 and (r is null or r <= now()) then
    r := now() + interval '60 minutes';
    update users set red_until = r where id = p_driver;
  end if;
  insert into driver_score_events (driver_id, delta, reason, order_id, note, created_by, score_after)
  values (p_driver, p_delta, p_reason, p_order, p_note, p_by, s);
  return query select s::smallint, r;
end;
$$;

-- Pauzasi tugagan haydovchilar: ball kamida 40 (sariq zona); ozod qilinganlar ro'yxati
create or replace function public.release_red_drivers()
returns setof uuid
language plpgsql
security definer set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select id, score from users where role = 'driver' and red_until is not null and red_until <= now() for update
  loop
    update users set red_until = null, score = greatest(score, 40) where id = rec.id;
    if rec.score < 40 then
      insert into driver_score_events (driver_id, delta, reason, score_after)
      values (rec.id, 40 - rec.score, 'red_reset', 40);
    end if;
    return next rec.id;
  end loop;
end;
$$;

-- Kuniga bir marta +3 (Toshkent sanasi bo'yicha)
create or replace function public.daily_score_recovery()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Tashkent')::date;
  n integer := 0;
  rec record;
begin
  for rec in
    select id, score from users
    where role = 'driver' and (score_recovered_on is null or score_recovered_on < today)
    for update
  loop
    update users set score = least(100, score + 3), score_recovered_on = today where id = rec.id;
    if rec.score < 100 then
      insert into driver_score_events (driver_id, delta, reason, score_after)
      values (rec.id, least(100, rec.score + 3) - rec.score, 'daily', least(100, rec.score + 3));
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

revoke execute on function public.apply_wallet_tx from anon, authenticated, public;
revoke execute on function public.apply_score from anon, authenticated, public;
revoke execute on function public.release_red_drivers from anon, authenticated, public;
revoke execute on function public.daily_score_recovery from anon, authenticated, public;

-- ---------- Buyurtma kimga yuboriladi ----------
-- Balansi manfiy yoki qizil pauzadagi haydovchiga — yo'q; ball sariq zonani aniqlash uchun qaytadi
drop function if exists public.nearby_drivers(double precision, double precision, integer);
create function public.nearby_drivers(lat double precision, lng double precision, radius_m integer default 5000)
returns table (driver_id uuid, distance_m double precision, score smallint)
language sql
stable
as $$
  select dl.driver_id,
         st_distance(dl.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_m,
         u.score
  from public.driver_locations dl
  join public.users u on u.id = dl.driver_id
  where dl.is_online
    and u.role = 'driver'
    and u.is_approved
    and not u.is_blocked
    and u.balance >= 0
    and (u.red_until is null or u.red_until <= now())
    and dl.updated_at > now() - interval '2 minutes'
    and st_dwithin(dl.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_m)
  order by distance_m
  limit 10;
$$;

-- Yaqinda hech kim bo'lmasa — buyurtma olishi mumkin bo'lgan barcha onlayn haydovchilar
create or replace function public.dispatchable_drivers()
returns table (driver_id uuid, score smallint)
language sql
stable
as $$
  select dl.driver_id, u.score
  from public.driver_locations dl
  join public.users u on u.id = dl.driver_id
  where dl.is_online
    and u.role = 'driver'
    and u.is_approved
    and not u.is_blocked
    and u.balance >= 0
    and (u.red_until is null or u.red_until <= now())
    and dl.updated_at > now() - interval '2 minutes';
$$;

revoke execute on function public.nearby_drivers from anon, authenticated, public;
revoke execute on function public.dispatchable_drivers from anon, authenticated, public;

grant execute on function public.apply_wallet_tx, public.apply_score, public.release_red_drivers,
  public.daily_score_recovery, public.nearby_drivers, public.dispatchable_drivers to service_role;
