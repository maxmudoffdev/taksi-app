-- Tuzatishlar: kutish chegarasi, bekor qilish sababi
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.

-- Pullik kutishning eng ko'p daqiqasi (undan keyin haq oshmaydi — haydovchi "Mijoz chiqmadi" bosadi)
alter table public.tariffs add column if not exists max_paid_wait_min integer not null default 15
  check (max_paid_wait_min >= 0);

-- Nega bekor qilingan: passenger | driver | staff | no_show (mijoz chiqmadi) | timeout (haydovchi topilmadi) | stale (osilib qolgan)
alter table public.orders add column if not exists cancel_reason text;

-- orders_view: cancel_reason qo'shiladi
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
  o.cancel_reason
from public.orders o
left join public.users p on p.id = o.passenger_id
left join public.users d on d.id = o.driver_id;

revoke all on public.orders_view from anon, authenticated;

-- Avvalgi cheklanmagan kutish haqlarini (masalan, 263 200 so'm) tarixda tuzatish:
-- har tarifning yangi chegarasi bo'yicha qayta hisoblanadi
update public.orders o
set waiting_fee = least(o.waiting_fee, t.wait_per_min * t.max_paid_wait_min)
from public.tariffs t
where t.id = o.tariff and o.waiting_fee > t.wait_per_min * t.max_paid_wait_min;
