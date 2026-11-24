-- 2-bosqich: Auth → users profili + RLS qoidalari
-- Supabase Dashboard → SQL Editor → shu faylni to'liq joylab "Run" bosing.

-- Yangi auth foydalanuvchi yaratilganda public.users ga profil qo'shish.
-- Ro'yxatdan o'tishda faqat 'passenger' yoki 'driver' tanlash mumkin.
-- 'admin' rolini faqat SQL orqali qo'lda beriladi (pastga qarang).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.users (id, full_name, phone, role, is_approved)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    case when requested = 'driver' then 'driver'::user_role else 'passenger'::user_role end,
    requested is distinct from 'driver'  -- yo'lovchi darhol tasdiqlangan, haydovchini admin tasdiqlaydi
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Joriy foydalanuvchi adminmi? (RLS ichida rekursiyasiz ishlatish uchun)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;

-- USERS qoidalari
drop policy if exists "users: o'z profilini ko'radi" on public.users;
create policy "users: o'z profilini ko'radi" on public.users
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "users: admin yangilaydi" on public.users;
create policy "users: admin yangilaydi" on public.users
  for update using (public.is_admin());

-- ============================================================
-- ADMIN YARATISH (bir marta, qo'lda):
-- 1) Ilovada oddiy yo'lovchi sifatida ro'yxatdan o'ting.
-- 2) Quyidagini email'ingiz bilan ishga tushiring:
--
-- update public.users set role = 'admin', is_approved = true
-- where id = (select id from auth.users where email = 'sizning@email.uz');
-- ============================================================
