-- Telefon buyurtmada A nuqtani xaritada belgilash ixtiyoriy:
-- dispetcher faqat mo'ljalni yozadi ("19-maktab yoni"), haydovchi mijozga qo'ng'iroq qilib aniqlaydi.
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.

alter table public.orders alter column pickup drop not null;

-- Koordinata ham, matn ham bo'lmagan buyurtma bo'lmasin
do $$ begin
  alter table public.orders add constraint orders_pickup_check
    check (pickup is not null or coalesce(pickup_note, pickup_address) is not null);
exception when duplicate_object then null; end $$;
