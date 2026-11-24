-- Bir mijoz bir nechta mashina so'rashi mumkin (to'y, katta oila, yuk).
-- Telefon raqami bo'yicha qat'iy cheklov olib tashlanadi — endi backend dispetcherdan tasdiq so'raydi.
-- (Ilova orqali yo'lovchida "bitta hisob — bitta faol buyurtma" qoidasi saqlanadi.)
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.

drop index if exists public.orders_one_active_per_customer_phone;
