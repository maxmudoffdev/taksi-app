-- Telegram bot orqali kirish: telefon raqami ↔ Telegram chat bog'lanishi
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.

-- Foydalanuvchi botga "Raqamni yuborish" tugmasi orqali o'z raqamini ulaydi (Telegram raqamni tasdiqlaydi).
-- Shundan keyin kirish kodlari shu chatga yuboriladi.
create table if not exists public.telegram_links (
  phone       text primary key,            -- "+998901234567"
  chat_id     bigint not null,
  tg_user_id  bigint not null,
  username    text,
  first_name  text,
  updated_at  timestamptz not null default now()
);

create index if not exists telegram_links_tg_user_idx on public.telegram_links (tg_user_id);

-- Faqat backend (maxfiy kalit) o'qiydi va yozadi
alter table public.telegram_links enable row level security;
revoke all on public.telegram_links from anon, authenticated;
