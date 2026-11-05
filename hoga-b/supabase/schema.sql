-- =====================================================================
-- HOGA B - Skema database Supabase
-- Jalankan di Supabase > SQL Editor.
--
-- PERHATIAN: semua perintah memakai "if not exists" / "or replace" sehingga
-- aman dijalankan pada database baru. Jika tabel monitoring / overline /
-- profiles SUDAH ada dan berisi data, perintah create table akan dilewati
-- (struktur lama tidak diubah). Bandingkan dulu dengan struktur Anda.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES (role & nama user)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Kompatibilitas database lama: tambahkan kolom yang mungkin belum ada (tidak mengubah data yang ada).
alter table public.profiles add column if not exists email      text;
alter table public.profiles add column if not exists full_name  text;
alter table public.profiles add column if not exists role       text not null default 'user';
alter table public.profiles add column if not exists created_at timestamptz not null default now();

-- Isi email yang kosong dari auth.users (dipakai daftar user di halaman admin).
update public.profiles p set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

-- Cek admin. security definer agar tidak kena rekursi RLS saat dipakai di policy.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Otomatis buat profil saat ada user baru di auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- CATATAN database lama: skema lama punya policy "profiles read" (semua user login boleh membaca semua profil).
-- Policy itu tetap berlaku berdampingan dengan policy di atas. Aplikasi ini hanya perlu membaca profil sendiri
-- (daftar user diambil lewat /api/users), jadi jika ingin memperketat, jalankan:
--   drop policy if exists "profiles read" on public.profiles;

-- Perubahan role / hapus user dilakukan lewat /api/users (service role), bukan langsung dari browser.

-- ---------------------------------------------------------------------
-- 2. MONITORING
-- ---------------------------------------------------------------------
create table if not exists public.monitoring (
  id                  text primary key default gen_random_uuid()::text,
  report_date         date not null,
  engineer            text not null,
  line                text not null check (line ~ '^B([1-9]|[12][0-9]|3[01])$'),
  current_style       text,
  next_style          text,
  planned_start_date  date not null,
  pre_layout_status   text not null default 'Not Started'
                        check (pre_layout_status in ('Done','In Progress','Pending','Not Started','N/A')),
  pp_approval_status  text not null default 'Not Started'
                        check (pp_approval_status in ('Done','In Progress','Pending','Not Started','N/A')),
  chief_sample_status text not null default 'Not Started'
                        check (chief_sample_status in ('Done','In Progress','Pending','Not Started','N/A')),
  remark              text,
  created_by          uuid default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists monitoring_created_at_idx on public.monitoring (created_at desc);
create index if not exists monitoring_line_idx       on public.monitoring (line);
create index if not exists monitoring_engineer_idx   on public.monitoring (engineer);

-- ---------------------------------------------------------------------
-- 3. OVERLINE
-- ---------------------------------------------------------------------
create table if not exists public.overline (
  id                    text primary key default gen_random_uuid()::text,
  report_week_start     date not null,
  engineer              text not null,
  line                  text not null check (line ~ '^B([1-9]|[12][0-9]|3[01])$'),
  current_style         text,
  next_style            text,
  planned_overline_date date not null,
  status                text not null default 'Pending'
                          check (status in ('Done','In Progress','Pending','Not Started','N/A')),
  remark                text,
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists overline_created_at_idx on public.overline (created_at desc);
create index if not exists overline_line_idx       on public.overline (line);
create index if not exists overline_engineer_idx   on public.overline (engineer);

-- Kompatibilitas database lama: tabel lama mungkin belum punya kolom ini.
-- (Trigger updated_at di bawah akan error saat UPDATE jika kolomnya tidak ada.)
alter table public.monitoring add column if not exists created_by uuid default auth.uid();
alter table public.monitoring add column if not exists created_at timestamptz not null default now();
alter table public.monitoring add column if not exists updated_at timestamptz not null default now();
alter table public.overline   add column if not exists created_by uuid default auth.uid();
alter table public.overline   add column if not exists created_at timestamptz not null default now();
alter table public.overline   add column if not exists updated_at timestamptz not null default now();

-- updated_at otomatis
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monitoring_set_updated_at on public.monitoring;
create trigger monitoring_set_updated_at before update on public.monitoring
  for each row execute function public.set_updated_at();

drop trigger if exists overline_set_updated_at on public.overline;
create trigger overline_set_updated_at before update on public.overline
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY untuk monitoring & overline
-- Perilaku saat ini: semua user yang login boleh melihat dan mengubah data
-- (sama seperti aplikasi sebelumnya). Lihat bagian "OPSIONAL" di bawah untuk memperketat.
-- ---------------------------------------------------------------------
alter table public.monitoring enable row level security;
alter table public.overline   enable row level security;

-- Hapus policy bawaan skema lama (nama berbeda, isinya sama persis) agar tidak menumpuk dobel.
drop policy if exists "monitoring all" on public.monitoring;
drop policy if exists "overline all"   on public.overline;

drop policy if exists "monitoring_all_authenticated" on public.monitoring;
create policy "monitoring_all_authenticated" on public.monitoring
  for all to authenticated using (true) with check (true);

drop policy if exists "overline_all_authenticated" on public.overline;
create policy "overline_all_authenticated" on public.overline
  for all to authenticated using (true) with check (true);

-- OPSIONAL - batasi ubah/hapus: engineer hanya boleh mengubah/menghapus data buatannya sendiri,
-- admin boleh semuanya. Untuk memakai: hapus policy "monitoring_all_authenticated" dan "overline_all_authenticated"
-- di atas (jika tidak dihapus, policy longgar itu tetap membuka semua akses), lalu jalankan:
--
-- create policy "monitoring_select" on public.monitoring for select to authenticated using (true);
-- create policy "monitoring_insert" on public.monitoring for insert to authenticated with check (true);
-- create policy "monitoring_update" on public.monitoring for update to authenticated
--   using (created_by = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or public.is_admin());
-- create policy "monitoring_delete" on public.monitoring for delete to authenticated
--   using (created_by = auth.uid() or public.is_admin());
-- (ulangi hal yang sama untuk tabel overline)

-- ---------------------------------------------------------------------
-- 5. REALTIME (agar dashboard update tanpa refresh)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'monitoring') then
    alter publication supabase_realtime add table public.monitoring;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'overline') then
    alter publication supabase_realtime add table public.overline;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. ADMIN PERTAMA
-- Buat user lewat Supabase > Authentication > Users, lalu jadikan admin:
--
-- update public.profiles set role = 'admin' where email = 'email-anda@contoh.com';
-- ---------------------------------------------------------------------
