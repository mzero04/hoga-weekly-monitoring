-- =====================================================================
-- HOGA B - Cek apakah database LAMA cocok dengan aplikasi baru
-- Jalankan di Supabase > SQL Editor. TIDAK mengubah apa pun (hanya membaca).
-- Hasil berupa satu tabel (kolom: cek, detail). Kirim hasilnya jika ada yang janggal.
-- =====================================================================
select 'tabel' as cek,
       t || ' : ' || case when to_regclass('public.' || t) is null then 'TIDAK ADA' else 'ada' end as detail
from unnest(array['profiles','monitoring','overline']) as t

union all
select 'kolom hilang', e.tbl || '.' || e.col
from (values
  ('profiles','id'),('profiles','full_name'),('profiles','role'),
  ('monitoring','id'),('monitoring','report_date'),('monitoring','engineer'),('monitoring','line'),
  ('monitoring','current_style'),('monitoring','next_style'),('monitoring','planned_start_date'),
  ('monitoring','pre_layout_status'),('monitoring','pp_approval_status'),('monitoring','chief_sample_status'),
  ('monitoring','remark'),('monitoring','created_at'),
  ('overline','id'),('overline','report_week_start'),('overline','engineer'),('overline','line'),
  ('overline','current_style'),('overline','next_style'),('overline','planned_overline_date'),
  ('overline','status'),('overline','remark'),('overline','created_at')
) as e(tbl, col)
where not exists (
  select 1 from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = e.tbl and c.column_name = e.col
)

union all
select 'tipe kolom id', table_name || ' : ' || data_type
from information_schema.columns
where table_schema = 'public' and table_name in ('profiles','monitoring','overline') and column_name = 'id'

union all
select 'RLS aktif', tablename || ' : ' || case when rowsecurity then 'ya' else 'TIDAK' end
from pg_tables
where schemaname = 'public' and tablename in ('profiles','monitoring','overline')

union all
select 'policy', tablename || ' : ' || policyname || ' (' || cmd || ')'
from pg_policies
where schemaname = 'public' and tablename in ('profiles','monitoring','overline')

order by 1, 2;

-- Cara membaca:
--  * "kolom hilang" kosong atau hanya berisi kolom opsional -> database lama sudah cocok.
--  * Kolom hilang (mis. updated_at, created_by, email) akan ditambahkan otomatis oleh schema.sql
--    tanpa mengubah data. Kolom wajib seperti report_date / line sebaiknya dilaporkan dulu.
--  * "tipe kolom id": text atau uuid keduanya aman untuk aplikasi.
