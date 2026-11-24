-- 5-bosqich: buyurtmalar uchun yordamchi view va funksiyalar
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.

-- Avvalgi sinovlardan qolgan takroriy faol buyurtmalarni tozalash:
-- har bir yo'lovchida faqat eng yangisi qoladi, qolganlari bekor qilinadi
update public.orders o
set status = 'cancelled'
where o.status in ('created', 'accepted', 'arrived', 'in_trip')
  and exists (
    select 1 from public.orders newer
    where newer.passenger_id = o.passenger_id
      and newer.status in ('created', 'accepted', 'arrived', 'in_trip')
      and newer.created_at > o.created_at
  );

update public.orders o
set status = 'cancelled'
where o.driver_id is not null
  and o.status in ('accepted', 'arrived', 'in_trip')
  and exists (
    select 1 from public.orders newer
    where newer.driver_id = o.driver_id
      and newer.status in ('accepted', 'arrived', 'in_trip')
      and newer.created_at > o.created_at
  );

-- Bir yo'lovchi / haydovchida bir vaqtda faqat bitta faol buyurtma bo'lishi mumkin
create unique index if not exists orders_one_active_per_passenger
  on public.orders (passenger_id)
  where status in ('created', 'accepted', 'arrived', 'in_trip');

create unique index if not exists orders_one_active_per_driver
  on public.orders (driver_id)
  where driver_id is not null and status in ('accepted', 'arrived', 'in_trip');

-- updated_at ni avtomatik yangilash
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- Koordinatalarni oddiy lat/lng sonlar ko'rinishida qaytaruvchi view (faqat backend o'qiydi)
create or replace view public.orders_view
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
  o.updated_at
from public.orders o;

revoke all on public.orders_view from anon, authenticated;

-- Nuqtaga yaqin, onlayn va tasdiqlangan haydovchilar (oxirgi 2 daqiqada joylashuv yuborganlar)
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
    and dl.updated_at > now() - interval '2 minutes'
    and st_dwithin(dl.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_m)
  order by distance_m
  limit 10;
$$;

revoke execute on function public.nearby_drivers from anon, authenticated;
