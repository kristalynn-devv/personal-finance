-- ============================================================
-- Row Level Security — personal-finance
-- ใช้วางใน SQL Editor ของ Supabase (รันต่อจาก schema.sql)
-- บังคับที่ database ว่า query ต้อง auth.uid() ตรงกับ user_id เท่านั้น
-- แก้ช่องโหว่: ตอนนี้แอป login จริงด้วย Google OAuth (getUserId() ใน
-- src/lib/supabase.ts) แต่ query ฝั่ง client กรอง user_id เอง ไม่มีอะไร
-- บังคับที่ server เลย ถ้า RLS ปิดใครก็ยิง query เปลี่ยน user_id อ่าน/แก้
-- ข้อมูลคนอื่นได้ผ่าน anon key ที่ฝังอยู่ใน browser bundle
-- หมายเหตุ: db.ts .delete() บาง table กรองแค่ .eq("id", id) ไม่มี user_id
-- เลย — RLS คือสิ่งเดียวที่ป้องกันการลบ row ของคนอื่นตรงนี้
-- Safe to re-run: DROP POLICY IF EXISTS ก่อนสร้างใหม่ทุกครั้ง
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'assets', 'liabilities', 'liability_logs', 'budget_entries',
    'profiles', 'retirement_settings', 'ai_logs', 'audit_logs'
  ]
  loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists "%s_select_own" on %I', t, t);
    execute format(
      'create policy "%s_select_own" on %I for select using (auth.uid()::text = user_id)',
      t, t
    );

    execute format('drop policy if exists "%s_insert_own" on %I', t, t);
    execute format(
      'create policy "%s_insert_own" on %I for insert with check (auth.uid()::text = user_id)',
      t, t
    );

    execute format('drop policy if exists "%s_update_own" on %I', t, t);
    execute format(
      'create policy "%s_update_own" on %I for update using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id)',
      t, t
    );

    execute format('drop policy if exists "%s_delete_own" on %I', t, t);
    execute format(
      'create policy "%s_delete_own" on %I for delete using (auth.uid()::text = user_id)',
      t, t
    );
  end loop;
end $$;
