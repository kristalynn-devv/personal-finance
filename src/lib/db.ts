import { supabase, getUserId } from "./supabase"
import type { Asset, Liability } from "./calculations"

interface BudgetEntry { id: string; category: string; name: string; amounts: number[] }

// ---------- Assets ----------

export async function dbLoadAssets(): Promise<Asset[]> {
  const { data } = await supabase
    .from("assets")
    .select("*")
    .eq("user_id", getUserId())
    .order("created_at")
  return (data ?? []).map((r) => ({ id: r.id, category: r.category, name: r.name, value: r.value }))
}

export async function dbUpsertAsset(a: Asset) {
  await supabase.from("assets").upsert({ id: a.id, user_id: getUserId(), category: a.category, name: a.name, value: a.value })
}

export async function dbDeleteAsset(id: string) {
  await supabase.from("assets").delete().eq("id", id)
}

// ---------- Liabilities ----------

export async function dbLoadLiabilities(): Promise<Liability[]> {
  const { data } = await supabase
    .from("liabilities")
    .select("*")
    .eq("user_id", getUserId())
    .order("created_at")
  return (data ?? []).map((r) => ({
    id: r.id, type: r.type, name: r.name,
    balance: r.balance,
    originalAmount: r.original_amount ?? 0,
    interestRate: r.interest_rate,
    minimumPayment: r.minimum_payment,
    status: (r.status ?? "active") as "active" | "closed",
  }))
}

export async function dbUpsertLiability(l: Liability) {
  await supabase.from("liabilities").upsert({
    id: l.id, user_id: getUserId(), type: l.type, name: l.name,
    balance: l.balance, original_amount: l.originalAmount,
    interest_rate: l.interestRate, minimum_payment: l.minimumPayment,
    status: l.status,
  })
}

export async function dbDeleteLiability(id: string) {
  await supabase.from("liabilities").delete().eq("id", id)
}

export interface LiabilityLog {
  id: string
  liabilityId: string
  liabilityName: string
  eventType: "created" | "payment" | "withdraw" | "updated" | "closed" | "reopened"
  balanceBefore: number | null
  balanceAfter: number | null
  note: string | null
  createdAt: string
}

export async function dbAddLiabilityLog(entry: Omit<LiabilityLog, "id" | "createdAt">) {
  await supabase.from("liability_logs").insert({
    user_id: getUserId(),
    liability_id: entry.liabilityId,
    liability_name: entry.liabilityName,
    event_type: entry.eventType,
    balance_before: entry.balanceBefore,
    balance_after: entry.balanceAfter,
    note: entry.note ?? null,
  })
}

export async function dbLoadAllLiabilityLogs(limit = 100): Promise<LiabilityLog[]> {
  const { data } = await supabase
    .from("liability_logs")
    .select("*")
    .eq("user_id", getUserId())
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []).map((r) => ({
    id: r.id, liabilityId: r.liability_id, liabilityName: r.liability_name,
    eventType: r.event_type, balanceBefore: r.balance_before, balanceAfter: r.balance_after,
    note: r.note, createdAt: r.created_at,
  }))
}

export async function dbLoadLiabilityLogs(liabilityId: string): Promise<LiabilityLog[]> {
  const { data } = await supabase
    .from("liability_logs")
    .select("*")
    .eq("user_id", getUserId())
    .eq("liability_id", liabilityId)
    .order("created_at", { ascending: false })
  return (data ?? []).map((r) => ({
    id: r.id,
    liabilityId: r.liability_id,
    liabilityName: r.liability_name,
    eventType: r.event_type,
    balanceBefore: r.balance_before,
    balanceAfter: r.balance_after,
    note: r.note,
    createdAt: r.created_at,
  }))
}

// ---------- Audit Logs ----------

export async function dbAddAuditLog(entry: { tableName: string; recordId?: string; action: "create" | "update" | "delete"; recordName?: string; payload?: object }) {
  await supabase.from("audit_logs").insert({
    user_id: getUserId(),
    table_name: entry.tableName,
    record_id: entry.recordId ?? null,
    action: entry.action,
    record_name: entry.recordName ?? null,
    payload: entry.payload ?? null,
  })
}

export interface AuditLog {
  id: string
  tableName: string
  recordId: string | null
  action: string
  recordName: string | null
  payload: object | null
  createdAt: string
}

export async function dbLoadAuditLogs(limit = 100): Promise<AuditLog[]> {
  const { data } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("user_id", getUserId())
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []).map((r) => ({
    id: r.id, tableName: r.table_name, recordId: r.record_id,
    action: r.action, recordName: r.record_name, payload: r.payload,
    createdAt: r.created_at,
  }))
}

// ---------- Budget ----------

export async function dbLoadBudget(): Promise<BudgetEntry[]> {
  const { data } = await supabase
    .from("budget_entries")
    .select("*")
    .eq("user_id", getUserId())
    .order("created_at")
  return (data ?? []).map((r) => ({ id: r.id, category: r.category, name: r.name, amounts: r.amounts }))
}

export async function dbUpsertBudget(e: BudgetEntry) {
  await supabase.from("budget_entries").upsert({ id: e.id, user_id: getUserId(), category: e.category, name: e.name, amounts: e.amounts })
}

export async function dbDeleteBudget(id: string) {
  await supabase.from("budget_entries").delete().eq("id", id)
}

// ---------- Profile ----------

export async function dbLoadProfile() {
  const { data } = await supabase.from("profiles").select("*").eq("user_id", getUserId()).maybeSingle()
  if (!data) return null
  return { name: data.name ?? "", age: data.age ?? 30, retirementAge: data.retirement_age ?? 60, lifeExpectancy: data.life_expectancy ?? 80, inflationRate: data.inflation_rate ?? 3 }
}

export async function dbSaveProfile(p: { name: string; age: number; retirementAge: number; lifeExpectancy: number; inflationRate: number }) {
  await supabase.from("profiles").upsert({ user_id: getUserId(), name: p.name, age: p.age, retirement_age: p.retirementAge, life_expectancy: p.lifeExpectancy, inflation_rate: p.inflationRate, updated_at: new Date().toISOString() })
}

// ---------- Retirement ----------

export async function dbLoadRetirement() {
  const { data } = await supabase.from("retirement_settings").select("*").eq("user_id", getUserId()).maybeSingle()
  if (!data) return null
  return {
    monthlyExpenseAtRetirement: data.monthly_expense_at_retirement ?? 0,
    otherMonthlyIncome: data.other_monthly_income ?? 0,
    investmentReturn: data.investment_return ?? 7,
    pvdRate: data.pvd_rate ?? 5,
    employerRate: data.employer_rate ?? 5,
    currentPvdBalance: data.current_pvd_balance ?? 0,
    monthlyDcaAmount: data.monthly_dca_amount ?? 0,
  }
}

export async function dbSaveRetirement(r: Record<string, number>) {
  await supabase.from("retirement_settings").upsert({
    user_id: getUserId(),
    monthly_expense_at_retirement: r.monthlyExpenseAtRetirement,
    other_monthly_income: r.otherMonthlyIncome,
    investment_return: r.investmentReturn,
    pvd_rate: r.pvdRate,
    employer_rate: r.employerRate,
    current_pvd_balance: r.currentPvdBalance,
    monthly_dca_amount: r.monthlyDcaAmount,
    updated_at: new Date().toISOString(),
  })
}
