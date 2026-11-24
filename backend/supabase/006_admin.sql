-- 7-bosqich: tariflar bazada (admin paneldan boshqariladi)
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.

create table if not exists public.tariffs (
  id            tariff_type primary key,
  name          text    not null,
  icon          text    not null default '🚗',
  description   text    not null default '',
  base_fare     integer not null check (base_fare >= 0),
  per_km        integer not null check (per_km >= 0),
  per_min       integer not null check (per_min >= 0),
  min_fare      integer not null check (min_fare >= 0),
  free_wait_min integer not null default 3 check (free_wait_min >= 0),
  wait_per_min  integer not null default 500 check (wait_per_min >= 0),
  sort_order    integer not null default 0,
  updated_at    timestamptz not null default now()
);

-- Standart qiymatlar (4-bosqichdagi bilan bir xil). Mavjud bo'lsa — o'zgartirilmaydi.
insert into public.tariffs (id, name, icon, description, base_fare, per_km, per_min, min_fare, free_wait_min, wait_per_min, sort_order)
values
  ('economy',  'Ekonom',          '🚗', 'Arzon va qulay',             5000, 1800, 300,  9000, 3, 500, 1),
  ('comfort',  'Komfort',         '🚙', 'Yangi va keng avtomobillar', 8000, 2500, 400, 14000, 5, 700, 2),
  ('delivery', 'Yetkazib berish', '📦', 'Posilka va hujjatlar',       7000, 2000, 200, 12000, 5, 400, 3)
on conflict (id) do nothing;

drop trigger if exists tariffs_touch_updated_at on public.tariffs;
create trigger tariffs_touch_updated_at
  before update on public.tariffs
  for each row execute function public.touch_updated_at();

-- Hamma o'qiy oladi, o'zgartirish faqat backend (secret kalit) orqali
alter table public.tariffs enable row level security;
drop policy if exists "tariffs: hamma o'qiydi" on public.tariffs;
create policy "tariffs: hamma o'qiydi" on public.tariffs for select using (true);
