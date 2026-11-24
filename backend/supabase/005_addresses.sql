-- Manzil qidiruvi: buyurtmadagi A/B manzil matnlarini view orqali qaytarish
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.
-- (orders.pickup_address / dropoff_address ustunlari 001 da yaratilgan)

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
  p.full_name as passenger_name,
  p.phone     as passenger_phone,
  d.full_name as driver_name,
  d.phone     as driver_phone
from public.orders o
join public.users p on p.id = o.passenger_id
left join public.users d on d.id = o.driver_id;

revoke all on public.orders_view from anon, authenticated;
