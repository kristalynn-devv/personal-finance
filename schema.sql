-- ============================================================
-- Personal Finance App — Supabase Schema
-- ใช้วางใน SQL Editor ของ Supabase
-- RLS ปิดทั้งหมด (ใช้ anonymous UUID แทน login)
-- ============================================================

-- ---------- Assets ----------
create table if not exists assets (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  category    text not null,   -- liquid | investment | personal
  name        text not null,
  value       numeric not null default 0,
  created_at  timestamptz not null default now()
);
alter table assets disable row level security;
create index if not exists assets_user_id_idx on assets(user_id);

-- ---------- Liabilities ----------
create table if not exists liabilities (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  type              text not null,   -- credit_card | personal_loan | mortgage | car | student_loan
  name              text not null,
  balance           numeric not null default 0,
  original_amount   numeric not null default 0,
  interest_rate     numeric not null default 0,
  minimum_payment   numeric not null default 0,
  status            text not null default 'active',  -- active | closed
  created_at        timestamptz not null default now()
);
alter table liabilities disable row level security;
create index if not exists liabilities_user_id_idx on liabilities(user_id);

-- Migration (รันถ้า table มีอยู่แล้ว):
-- alter table liabilities add column if not exists original_amount numeric not null default 0;
-- alter table liabilities add column if not exists status text not null default 'active';

-- ---------- Liability Logs ----------
create table if not exists liability_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null,
  liability_id     uuid not null,
  liability_name   text not null,
  event_type       text not null,   -- created | payment | updated | closed | reopened
  balance_before   numeric,
  balance_after    numeric,
  note             text,
  created_at       timestamptz not null default now()
);
alter table liability_logs disable row level security;
create index if not exists liability_logs_user_id_idx on liability_logs(user_id);
create index if not exists liability_logs_liability_id_idx on liability_logs(liability_id);

-- ---------- Budget Entries ----------
create table if not exists budget_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  category    text not null,   -- income | saving | fixed_expense | variable_expense (หรือ custom)
  name        text not null,
  amounts     jsonb not null default '[]',   -- array 12 ตัว [ม.ค., ก.พ., ..., ธ.ค.]
  created_at  timestamptz not null default now()
);
alter table budget_entries disable row level security;
create index if not exists budget_entries_user_id_idx on budget_entries(user_id);

-- ---------- Profiles ----------
create table if not exists profiles (
  user_id           text primary key,
  name              text not null default '',
  age               int not null default 30,
  retirement_age    int not null default 60,
  life_expectancy   int not null default 80,
  inflation_rate    numeric not null default 3,
  updated_at        timestamptz not null default now()
);
alter table profiles disable row level security;

-- ---------- Retirement Settings ----------
create table if not exists retirement_settings (
  user_id                         text primary key,
  monthly_expense_at_retirement   numeric not null default 0,
  other_monthly_income            numeric not null default 0,
  investment_return               numeric not null default 7,
  pvd_rate                        numeric not null default 5,
  employer_rate                   numeric not null default 5,
  current_pvd_balance             numeric not null default 0,
  monthly_dca_amount              numeric not null default 0,
  updated_at                      timestamptz not null default now()
);
alter table retirement_settings disable row level security;

-- ---------- AI Logs ----------
create table if not exists ai_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  page        text not null,        -- health | debt | retirement | analysis | advisor | tax | scan
  fn_name     text not null,        -- generatePageInsight | generateFullAnalysis | sendMessage | etc.
  context     text,                 -- prompt / context ที่ส่งไป
  response    text,                 -- คำตอบจาก AI
  model       text,
  created_at  timestamptz not null default now()
);
alter table ai_logs disable row level security;
create index if not exists ai_logs_user_id_idx on ai_logs(user_id);
create index if not exists ai_logs_created_at_idx on ai_logs(created_at desc);

-- ---------- Audit Logs ----------
create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  table_name   text not null,       -- assets | liabilities | budget_entries | profiles | retirement_settings
  record_id    text,                -- id ของ record ที่เปลี่ยน (null สำหรับ profile/retirement)
  action       text not null,       -- create | update | delete
  record_name  text,                -- ชื่อ/label ของ record เพื่อให้อ่านง่าย
  payload      jsonb,               -- snapshot ของ data ที่เปลี่ยน (หรือ before/after)
  created_at   timestamptz not null default now()
);
alter table audit_logs disable row level security;
create index if not exists audit_logs_user_id_idx on audit_logs(user_id);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);
