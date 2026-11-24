-- 7.5-bosqich: dispetcher va telefon orqali buyurtmalar
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.

-- Yangi rol (ro'yxatdan o'tishda tanlab bo'lmaydi — faqat admin tayinlaydi)
alter type user_role add value if not exists 'dispatcher';

-- Telefon buyurtmada yo'lovchi ilovada ro'yxatdan o'tmagan bo'lishi mumkin
alter table public.orders alter column passenger_id drop not null;
-- "Qayerga" noma'lum bo'lishi mumkin (mijoz yo'lda aytadi)
alter table public.orders alter column dropoff drop not null;

alter table public.orders add column if not exists source text not null default 'app';
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists customer_name text;
-- Mo'ljal: "maktab yonida, ko'k darvoza" — qishloqda haydovchi uchun eng muhim ma'lumot
alter table public.orders add column if not exists pickup_note text;
alter table public.orders add column if not exists created_by uuid references public.users(id) on delete set null;
-- B noma'lum bo'lsa narx taxminiy (eng kam narx); yakuniy narxni haydovchi kiritadi
alter table public.orders add column if not exists price_is_estimate boolean not null default false;

do $$ begin
  alter table public.orders add constraint orders_source_check check (source in ('app', 'phone'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.orders add constraint orders_customer_check
    check (passenger_id is not null or customer_phone is not null);
exception when duplicate_object then null; end $$;

-- Qayta qo'ng'iroq qilgan mijozning oldingi manzillarini tez topish
create index if not exists orders_customer_phone_idx on public.orders (customer_phone, created_at desc)
  where customer_phone is not null;

-- Bir telefon raqamda bir vaqtda bitta faol telefon buyurtma
create unique index if not exists orders_one_active_per_customer_phone
  on public.orders (customer_phone)
  where customer_phone is not null and status in ('created', 'accepted', 'arrived', 'in_trip');

-- orders_view: yangi ustunlar; yo'lovchi endi ixtiyoriy (left join)
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
  o.price_is_estimate
from public.orders o
left join public.users p on p.id = o.passenger_id
left join public.users d on d.id = o.driver_id;

revoke all on public.orders_view from anon, authenticated;
