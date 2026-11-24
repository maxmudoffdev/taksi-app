-- Yangi imkoniyatlar: mashina ma'lumoti, bloklash, reyting, yuqori talab narxi (surge)
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.

-- ---------- Haydovchi mashinasi va bloklash ----------
alter table public.users add column if not exists car_model  text;  -- "Chevrolet Cobalt"
alter table public.users add column if not exists car_color  text;  -- "Oq"
alter table public.users add column if not exists car_plate  text;  -- "01A123BC" (bo'shliqsiz, katta harf)
alter table public.users add column if not exists is_blocked boolean not null default false;

-- Bir davlat raqami — bitta haydovchi
create unique index if not exists users_car_plate_unique on public.users (car_plate) where car_plate is not null;

-- Ro'yxatdan o'tishda haydovchi mashina ma'lumotini ham yuboradi
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
  is_driver boolean := requested = 'driver';
begin
  insert into public.users (id, full_name, phone, role, is_approved, car_model, car_color, car_plate)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    case when is_driver then 'driver'::user_role else 'passenger'::user_role end,
    not is_driver,  -- yo'lovchi darhol tasdiqlangan, haydovchini admin tasdiqlaydi
    case when is_driver then nullif(left(trim(new.raw_user_meta_data ->> 'car_model'), 60), '') end,
    case when is_driver then nullif(left(trim(new.raw_user_meta_data ->> 'car_color'), 30), '') end,
    case when is_driver then nullif(upper(regexp_replace(new.raw_user_meta_data ->> 'car_plate', '[^0-9A-Za-z]', '', 'g')), '') end
  );
  return new;
end;
$$;

-- ---------- Reyting va surge ----------
alter table public.orders add column if not exists rating smallint check (rating between 1 and 5);
alter table public.orders add column if not exists rating_comment text;
-- Buyurtma paytidagi narx koeffitsiyenti (1 — oddiy, 1.4 — talab yuqori)
alter table public.orders add column if not exists surge numeric(3, 2) not null default 1 check (surge >= 1 and surge <= 5);

-- Tarix va qidiruv uchun
create index if not exists orders_passenger_created_idx on public.orders (passenger_id, created_at desc);
create index if not exists orders_driver_created_idx on public.orders (driver_id, created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- Haydovchining o'rtacha bahosi
create or replace view public.driver_ratings
with (security_invoker = true) as
select driver_id, round(avg(rating)::numeric, 2) as rating_avg, count(rating)::int as rating_count
from public.orders
where rating is not null and driver_id is not null
group by driver_id;

revoke all on public.driver_ratings from anon, authenticated;

-- Umumiy sozlamalar (bitta qator)
create table if not exists public.app_settings (
  id            integer primary key default 1 check (id = 1),
  surge_enabled boolean not null default false,
  surge_max     numeric(3, 2) not null default 2 check (surge_max >= 1 and surge_max <= 3),
  updated_at    timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

-- ---------- orders_view: mashina, reyting, surge ----------
drop view if exists public.orders_view;
create view public.orders_view
with (security_invoker = true) as
select
  o.id,
  o.passenger_id,
  o.driver_id,
  o.status,
  o.tariff,
  st_y(o.pickup::geometry)  as pickup_lat,
  st_x(o.pickup::geometry)  as pickup_lng,
  st_y(o.dropoff::geometry) as dropoff_lat,
  st_x(o.dropoff::geometry) as dropoff_lng,
  o.pickup_address,
  o.dropoff_address,
  o.distance_km,
  o.duration_min,
  o.price,
  o.created_at,
  o.updated_at,
  o.arrived_at,
  o.started_at,
  o.completed_at,
  o.waiting_fee,
  coalesce(p.full_name, o.customer_name) as passenger_name,
  coalesce(o.customer_phone, p.phone)    as passenger_phone,
  d.full_name as driver_name,
  d.phone     as driver_phone,
  o.source,
  o.pickup_note,
  o.created_by,
  o.price_is_estimate,
  o.cancel_reason,
  o.rating,
  o.rating_comment,
  o.surge,
  d.car_model  as driver_car_model,
  d.car_color  as driver_car_color,
  d.car_plate  as driver_car_plate,
  r.rating_avg as driver_rating,
  r.rating_count as driver_rating_count
from public.orders o
left join public.users p on p.id = o.passenger_id
left join public.users d on d.id = o.driver_id
left join public.driver_ratings r on r.driver_id = o.driver_id;

revoke all on public.orders_view from anon, authenticated;

-- Bloklangan haydovchiga yangi buyurtma yuborilmasin
create or replace function public.nearby_drivers(lat double precision, lng double precision, radius_m integer default 5000)
returns table (driver_id uuid, distance_m double precision)
language sql
stable
as $$
  select dl.driver_id,
         st_distance(dl.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_m
  from public.driver_locations dl
  join public.users u on u.id = dl.driver_id
  where dl.is_online
    and u.role = 'driver'
    and u.is_approved
    and not u.is_blocked
    and dl.updated_at > now() - interval '2 minutes'
    and st_dwithin(dl.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_m)
  order by distance_m
  limit 10;
$$;

revoke execute on function public.nearby_drivers from anon, authenticated;
