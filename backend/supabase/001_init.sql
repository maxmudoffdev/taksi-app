-- 1-bosqich: asosiy jadvallar
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.

create extension if not exists postgis;

-- ENUM turlar
do $$ begin
  create type user_role as enum ('passenger', 'driver', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('created', 'accepted', 'arrived', 'in_trip', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tariff_type as enum ('economy', 'comfort', 'delivery');
exception when duplicate_object then null; end $$;

-- USERS: Supabase auth.users bilan 1:1 bog'langan profil
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text unique,
  role        user_role not null default 'passenger',
  is_approved boolean not null default false,  -- haydovchilarni admin tasdiqlaydi
  created_at  timestamptz not null default now()
);

-- ORDERS
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  passenger_id    uuid not null references public.users(id) on delete cascade,
  driver_id       uuid references public.users(id) on delete set null,
  status          order_status not null default 'created',
  tariff          tariff_type not null default 'economy',
  pickup          geography(Point, 4326) not null,
  dropoff         geography(Point, 4326) not null,
  pickup_address  text,
  dropoff_address text,
  distance_km     numeric(8, 2),
  duration_min    numeric(8, 1),
  price           numeric(12, 2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_pickup_gix on public.orders using gist (pickup);

-- DRIVER_LOCATIONS: har bir haydovchining oxirgi joylashuvi
create table if not exists public.driver_locations (
  driver_id  uuid primary key references public.users(id) on delete cascade,
  location   geography(Point, 4326) not null,
  heading    numeric(5, 1),
  is_online  boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists driver_locations_gix on public.driver_locations using gist (location);

-- Row Level Security (batafsil qoidalar 2-bosqichda, Auth bilan qo'shiladi)
alter table public.users enable row level security;
alter table public.orders enable row level security;
alter table public.driver_locations enable row level security;

drop policy if exists "users: o'z profilini ko'radi" on public.users;
create policy "users: o'z profilini ko'radi" on public.users
  for select using (auth.uid() = id);
