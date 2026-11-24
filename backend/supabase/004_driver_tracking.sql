-- 6-bosqich: haydovchi kuzatuvi, safar vaqtlari va kutish haqi
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.

-- Safar bosqichlari vaqtlari (kutish haqi arrived_at → started_at oralig'idan hisoblanadi)
alter table public.orders add column if not exists arrived_at   timestamptz;
alter table public.orders add column if not exists started_at   timestamptz;
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists waiting_fee  numeric(12, 2) not null default 0;

-- orders_view ni qayta yaratish: yangi ustunlar + yo'lovchi va haydovchi ismi/telefoni
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
  o.distance_km,
  o.duration_min,
  o.price,
  o.created_at,
  o.updated_at,
  o.arrived_at,
  o.started_at,
  o.completed_at,
  o.waiting_fee,
  p.full_name as passenger_name,
  p.phone     as passenger_phone,
  d.full_name as driver_name,
  d.phone     as driver_phone
from public.orders o
join public.users p on p.id = o.passenger_id
left join public.users d on d.id = o.driver_id;

revoke all on public.orders_view from anon, authenticated;

-- Haydovchilar joylashuvi lat/lng ko'rinishida (backend va 7-bosqichdagi admin xaritasi uchun)
create or replace view public.driver_locations_view
with (security_invoker = true) as
select
  dl.driver_id,
  st_y(dl.location::geometry) as lat,
  st_x(dl.location::geometry) as lng,
  dl.heading,
  dl.is_online,
  dl.updated_at,
  u.full_name,
  u.phone
from public.driver_locations dl
join public.users u on u.id = dl.driver_id;

revoke all on public.driver_locations_view from anon, authenticated;
