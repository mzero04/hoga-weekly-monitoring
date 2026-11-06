-- =====================================================================
-- HOGA B - Riwayat perubahan (Update Progress, Koreksi Data, Riwayat)
-- Jalankan SEKALI di Supabase > SQL Editor, SETELAH schema.sql (atau pada database lama Anda).
-- Aman dijalankan ulang. Data yang sudah ada tidak diubah.
--
-- Yang dibuat:
--   1. Tabel record_history  : jejak perubahan, hanya bisa DITAMBAH (tidak bisa diubah / dihapus).
--   2. Fungsi save_with_history : satu-satunya jalan mengubah data (update progress / koreksi).
--        - Progress  : semua user login. Hanya tahapan, planned date, dan catatan.
--        - Koreksi   : hanya admin atau pembuat data (created_by). Semua kolom.
--      Perubahan data dan riwayatnya disimpan sekaligus (atomik).
--   3. Trigger : tambah data  -> tercatat "create"; hapus data -> tercatat "delete".
--   4. Aturan akses: UPDATE langsung ke tabel monitoring / overline DITUTUP,
--      supaya tidak ada perubahan yang lolos tanpa riwayat.
--
-- URUTAN DEPLOY: jalankan skrip ini dulu, baru deploy aplikasi versi baru.
-- (Aplikasi lama tidak bisa mengedit data setelah skrip ini dijalankan.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABEL RIWAYAT
-- ---------------------------------------------------------------------
create table if not exists public.record_history (
  id              bigint generated always as identity primary key,
  record_table    text not null check (record_table in ('monitoring', 'overline')),
  record_id       text not null,                -- sengaja TANPA foreign key: riwayat tetap ada walau data dihapus
  line            text,
  engineer        text,
  kind            text not null check (kind in ('create', 'progress', 'correction', 'delete')),
  changes         jsonb not null default '[]'::jsonb,   -- [{ "field": "...", "from": ..., "to": ... }]
  note            text,                          -- catatan update / alasan koreksi
  effective_date  date not null default current_date,   -- tanggal berlakunya perubahan (dipakai grafik timeline)
  snapshot        jsonb,                         -- isi lengkap data (hanya untuk create dan delete)
  changed_by      uuid default auth.uid(),
  changed_by_name text,
  created_at      timestamptz not null default now()
);

create index if not exists record_history_record_idx on public.record_history (record_table, record_id, created_at desc);
create index if not exists record_history_effective_idx on public.record_history (effective_date);

alter table public.record_history enable row level security;

drop policy if exists "history_select" on public.record_history;
create policy "history_select" on public.record_history
  for select to authenticated using (true);

-- Tidak ada policy INSERT / UPDATE / DELETE: hanya fungsi & trigger di bawah (security definer) yang bisa menulis.
revoke insert, update, delete on public.record_history from anon, authenticated;

-- Nama pelaku untuk ditampilkan di riwayat
create or replace function public.history_actor()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(p.full_name, ''), nullif(p.email, ''), 'Pengguna')
  from public.profiles p
  where p.id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 2. FUNGSI UTAMA: ubah data + catat riwayat
--    p_kind = 'progress'   -> tahapan / planned date / catatan (semua user login)
--    p_kind = 'correction' -> semua kolom (admin atau pembuat data)
--    p_data = objek JSON berisi kolom yang ingin diubah, mis. {"pre_layout_status":"Done"}
--    p_note = catatan update (progress; juga disimpan sebagai remark terbaru) / alasan koreksi
--    p_effective = tanggal berlaku (progress). Tidak boleh lebih awal dari update terakhir.
-- ---------------------------------------------------------------------
create or replace function public.save_with_history(
  p_table     text,
  p_id        text,
  p_kind      text,
  p_data      jsonb,
  p_note      text default null,
  p_effective date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  old_row   jsonb;
  allowed   text[];
  k         text;
  val       text;
  changes   jsonb := '[]'::jsonb;
  upd       jsonb := '{}'::jsonb;
  setlist   text[] := '{}';
  note      text := nullif(btrim(coalesce(p_note, '')), '');
  eff       date;
  last_eff  date;
  statuses  constant text[] := array['Done', 'In Progress', 'Pending', 'Not Started', 'N/A'];
begin
  if uid is null then raise exception 'Anda belum login.'; end if;
  if p_table not in ('monitoring', 'overline') then raise exception 'Tabel tidak valid.'; end if;
  if p_kind not in ('progress', 'correction') then raise exception 'Jenis perubahan tidak valid.'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Data tidak valid.'; end if;

  execute format('select to_jsonb(t) from public.%I t where id = $1 for update', p_table)
    into old_row using p_id;
  if old_row is null then
    raise exception 'Data tidak ditemukan. Mungkin sudah dihapus pengguna lain.';
  end if;

  if p_kind = 'correction' and not (public.is_admin() or old_row->>'created_by' = uid::text) then
    raise exception 'Hanya admin atau pembuat data yang boleh mengoreksi data ini.';
  end if;

  -- kolom yang boleh diubah (daftar putih)
  if p_table = 'monitoring' then
    allowed := case p_kind
      when 'progress' then array['planned_start_date', 'pre_layout_status', 'pp_approval_status', 'chief_sample_status']
      else array['report_date', 'engineer', 'line', 'current_style', 'next_style', 'planned_start_date',
                 'pre_layout_status', 'pp_approval_status', 'chief_sample_status', 'remark']
    end;
  else
    allowed := case p_kind
      when 'progress' then array['planned_overline_date', 'status']
      else array['report_week_start', 'engineer', 'line', 'current_style', 'next_style',
                 'planned_overline_date', 'status', 'remark']
    end;
  end if;

  foreach k in array allowed loop
    if p_data ? k and (p_data -> k) is distinct from (old_row -> k) then
      val := p_data ->> k;

      if k in ('pre_layout_status', 'pp_approval_status', 'chief_sample_status', 'status')
         and (val is null or not (val = any (statuses))) then
        raise exception 'Status "%" tidak valid.', coalesce(val, '(kosong)');
      end if;
      if k = 'line' and (val is null or val !~ '^B[0-9]{1,3}$') then
        raise exception 'Line "%" tidak valid.', coalesce(val, '(kosong)');
      end if;
      if k in ('report_date', 'planned_start_date', 'report_week_start', 'planned_overline_date', 'engineer')
         and (val is null or btrim(val) = '') then
        raise exception 'Kolom % tidak boleh kosong.', k;
      end if;

      changes := changes || jsonb_build_array(jsonb_build_object('field', k, 'from', old_row -> k, 'to', p_data -> k));
      upd := upd || jsonb_build_object(k, p_data -> k);
    end if;
  end loop;

  -- Update progress: catatan menjadi remark terbaru (tidak dicatat dobel di daftar perubahan)
  if p_kind = 'progress' and note is not null and (old_row ->> 'remark') is distinct from note then
    upd := upd || jsonb_build_object('remark', note);
  end if;

  if upd = '{}'::jsonb and not (p_kind = 'progress' and note is not null) then
    return jsonb_build_object('changed', false);
  end if;

  -- tanggal berlaku
  select max(h.effective_date) into last_eff
  from public.record_history h
  where h.record_table = p_table and h.record_id = p_id and h.kind <> 'delete';

  if p_kind = 'progress' then
    eff := coalesce(p_effective, current_date);
    if eff > current_date + 1 then
      raise exception 'Tanggal update tidak boleh di masa depan.';
    end if;
    if last_eff is not null and eff < last_eff then
      raise exception 'Tanggal update tidak boleh lebih awal dari update terakhir (%).', to_char(last_eff, 'DD-MM-YYYY');
    end if;
  else
    eff := greatest(current_date, coalesce(last_eff, current_date));
  end if;

  -- terapkan perubahan (jsonb_populate_record memastikan tipe kolom benar, mis. date)
  if upd <> '{}'::jsonb then
    for k in select jsonb_object_keys(upd) loop
      setlist := setlist || format('%I = (jsonb_populate_record(null::public.%I, $2)).%I', k, p_table, k);
    end loop;
    execute format('update public.%I set %s where id = $1', p_table, array_to_string(setlist, ', '))
      using p_id, upd;
  end if;

  insert into public.record_history
    (record_table, record_id, line, engineer, kind, changes, note, effective_date, changed_by, changed_by_name)
  values
    (p_table, p_id,
     coalesce(upd ->> 'line', old_row ->> 'line'),
     coalesce(upd ->> 'engineer', old_row ->> 'engineer'),
     p_kind, changes, note, eff, uid, public.history_actor());

  return jsonb_build_object('changed', true);
end;
$$;

revoke all on function public.save_with_history(text, text, text, jsonb, text, date) from public, anon;
grant execute on function public.save_with_history(text, text, text, jsonb, text, date) to authenticated;

-- ---------------------------------------------------------------------
-- 3. TRIGGER: catat data baru dan data yang dihapus
-- ---------------------------------------------------------------------
create or replace function public.log_record_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v   jsonb := to_jsonb(new);
  eff date;
begin
  eff := least(
    coalesce((v ->> case when tg_table_name = 'monitoring' then 'report_date' else 'report_week_start' end)::date, current_date),
    current_date);
  insert into public.record_history
    (record_table, record_id, line, engineer, kind, effective_date, snapshot, changed_by, changed_by_name)
  values
    (tg_table_name, v ->> 'id', v ->> 'line', v ->> 'engineer', 'create', eff, v, auth.uid(), public.history_actor());
  return new;
end;
$$;

create or replace function public.log_record_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb := to_jsonb(old);
begin
  insert into public.record_history
    (record_table, record_id, line, engineer, kind, effective_date, snapshot, changed_by, changed_by_name)
  values
    (tg_table_name, v ->> 'id', v ->> 'line', v ->> 'engineer', 'delete', current_date, v, auth.uid(), public.history_actor());
  return old;
end;
$$;

drop trigger if exists monitoring_log_insert on public.monitoring;
create trigger monitoring_log_insert after insert on public.monitoring
  for each row execute function public.log_record_insert();
drop trigger if exists monitoring_log_delete on public.monitoring;
create trigger monitoring_log_delete after delete on public.monitoring
  for each row execute function public.log_record_delete();

drop trigger if exists overline_log_insert on public.overline;
create trigger overline_log_insert after insert on public.overline
  for each row execute function public.log_record_insert();
drop trigger if exists overline_log_delete on public.overline;
create trigger overline_log_delete after delete on public.overline
  for each row execute function public.log_record_delete();

-- ---------------------------------------------------------------------
-- 4. DATA YANG SUDAH ADA: catat sebagai "data awal" (riwayat dimulai dari hari ini)
-- ---------------------------------------------------------------------
insert into public.record_history
  (record_table, record_id, line, engineer, kind, effective_date, note, snapshot, changed_by, changed_by_name)
select 'monitoring', m.id, m.line, m.engineer, 'create', current_date,
       'Data awal (riwayat mulai dicatat)', to_jsonb(m), null, 'Sistem'
from public.monitoring m
where not exists (select 1 from public.record_history h where h.record_table = 'monitoring' and h.record_id = m.id);

insert into public.record_history
  (record_table, record_id, line, engineer, kind, effective_date, note, snapshot, changed_by, changed_by_name)
select 'overline', o.id, o.line, o.engineer, 'create', current_date,
       'Data awal (riwayat mulai dicatat)', to_jsonb(o), null, 'Sistem'
from public.overline o
where not exists (select 1 from public.record_history h where h.record_table = 'overline' and h.record_id = o.id);

-- ---------------------------------------------------------------------
-- 5. ATURAN AKSES: tutup UPDATE langsung (perubahan hanya lewat save_with_history)
--    Lihat & tambah & hapus tetap seperti sebelumnya (semua user login).
-- ---------------------------------------------------------------------
alter table public.monitoring enable row level security;
alter table public.overline   enable row level security;

-- policy lama yang membuka UPDATE (nama dari skema lama maupun skema baru)
drop policy if exists "monitoring all" on public.monitoring;
drop policy if exists "monitoring_all_authenticated" on public.monitoring;
drop policy if exists "monitoring_select" on public.monitoring;
drop policy if exists "monitoring_insert" on public.monitoring;
drop policy if exists "monitoring_update" on public.monitoring;
drop policy if exists "monitoring_delete" on public.monitoring;
create policy "monitoring_select" on public.monitoring for select to authenticated using (true);
create policy "monitoring_insert" on public.monitoring for insert to authenticated with check (true);
create policy "monitoring_delete" on public.monitoring for delete to authenticated using (true);

drop policy if exists "overline all" on public.overline;
drop policy if exists "overline_all_authenticated" on public.overline;
drop policy if exists "overline_select" on public.overline;
drop policy if exists "overline_insert" on public.overline;
drop policy if exists "overline_update" on public.overline;
drop policy if exists "overline_delete" on public.overline;
create policy "overline_select" on public.overline for select to authenticated using (true);
create policy "overline_insert" on public.overline for insert to authenticated with check (true);
create policy "overline_delete" on public.overline for delete to authenticated using (true);

-- ---------------------------------------------------------------------
-- 6. REALTIME untuk riwayat (grafik timeline ikut update otomatis)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'record_history') then
    alter publication supabase_realtime add table public.record_history;
  end if;
end $$;
