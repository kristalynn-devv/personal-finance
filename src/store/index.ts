import { create } from "zustand"

// debounce timers for budget upserts — prevents race conditions when filling multiple months quickly
const budgetSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()
import type { Asset, Liability } from "@/lib/calculations"
import {
  dbLoadAssets, dbUpsertAsset, dbDeleteAsset,
  dbLoadLiabilities, dbUpsertLiability, dbDeleteLiability, dbAddLiabilityLog, dbLoadLiabilityLogs,
  type LiabilityLog,
  dbLoadBudget, dbUpsertBudget, dbDeleteBudget,
  dbLoadProfile, dbSaveProfile,
  dbLoadRetirement, dbSaveRetirement,
  dbAddAuditLog,
} from "@/lib/db"

export type { Asset, Liability }

// ── Budget types ──────────────────────────────────────────────────────────────
export type BudgetCategory = "income" | "bonus" | "saving" | "fixed_expense" | "variable_expense"
export interface BudgetEntry {
  id: string
  category: BudgetCategory
  name: string
  amounts: number[]  // 12 months
}

// ── Profile ───────────────────────────────────────────────────────────────────
interface ProfileState {
  name: string; age: number; retirementAge: number
  lifeExpectancy: number; inflationRate: number
  loaded: boolean
  load: () => Promise<void>
  set: (data: Partial<Omit<ProfileState, "set" | "load" | "loaded">>) => void
}
export const useProfile = create<ProfileState>()((set, get) => ({
  name: "", age: 0, retirementAge: 0, lifeExpectancy: 0, inflationRate: 0, loaded: false,
  load: async () => {
    if (get().loaded) return
    const data = await dbLoadProfile()
    if (data) set({ ...data, loaded: true })
    else set({ loaded: true })
  },
  set: (data) => {
    set((s) => ({ ...s, ...data }))
    const s = get()
    dbSaveProfile({ name: s.name, age: s.age, retirementAge: s.retirementAge, lifeExpectancy: s.lifeExpectancy, inflationRate: s.inflationRate })
  },
}))

// ── Assets ────────────────────────────────────────────────────────────────────
interface AssetsState {
  items: Asset[]; loaded: boolean
  load: () => Promise<void>
  add: (a: Omit<Asset, "id">) => Promise<void>
  update: (id: string, data: Partial<Omit<Asset, "id">>) => Promise<void>
  remove: (id: string) => Promise<void>
}
export const useAssets = create<AssetsState>()((set, get) => ({
  items: [], loaded: false,
  load: async () => {
    if (get().loaded) return
    const items = await dbLoadAssets()
    set({ items, loaded: true })
  },
  add: async (a) => {
    const item = { ...a, id: crypto.randomUUID() }
    set((s) => ({ items: [...s.items, item] }))
    await dbUpsertAsset(item)
    dbAddAuditLog({ tableName: "assets", recordId: item.id, action: "create", recordName: item.name, payload: item })
  },
  update: async (id, data) => {
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...data } : i)) }))
    const item = get().items.find((i) => i.id === id)
    if (item) {
      await dbUpsertAsset(item)
      dbAddAuditLog({ tableName: "assets", recordId: id, action: "update", recordName: item.name, payload: data })
    }
  },
  remove: async (id) => {
    const item = get().items.find((i) => i.id === id)
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
    await dbDeleteAsset(id)
    if (item) dbAddAuditLog({ tableName: "assets", recordId: id, action: "delete", recordName: item.name })
  },
}))

// ── Liabilities ───────────────────────────────────────────────────────────────
export type { LiabilityLog }
interface LiabilitiesState {
  items: Liability[]; loaded: boolean
  load: () => Promise<void>
  add: (l: Omit<Liability, "id">) => Promise<void>
  update: (id: string, data: Partial<Omit<Liability, "id">>) => Promise<void>
  remove: (id: string) => Promise<void>
  loadLogs: (liabilityId: string) => Promise<LiabilityLog[]>
}
export const useLiabilities = create<LiabilitiesState>()((set, get) => ({
  items: [], loaded: false,
  load: async () => {
    if (get().loaded) return
    const items = await dbLoadLiabilities()
    set({ items, loaded: true })
  },
  add: async (l) => {
    const item = { ...l, id: crypto.randomUUID() }
    set((s) => ({ items: [...s.items, item] }))
    await dbUpsertLiability(item)
    await dbAddLiabilityLog({ liabilityId: item.id, liabilityName: item.name, eventType: "created", balanceBefore: null, balanceAfter: item.originalAmount, note: null })
    dbAddAuditLog({ tableName: "liabilities", recordId: item.id, action: "create", recordName: item.name, payload: item })
  },
  update: async (id, data) => {
    const before = get().items.find((i) => i.id === id)
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...data } : i)) }))
    const after = get().items.find((i) => i.id === id)
    if (after) {
      await dbUpsertLiability(after)
      if (before && before.balance !== after.balance) {
        await dbAddLiabilityLog({
          liabilityId: id, liabilityName: after.name,
          eventType: after.balance < before.balance ? "payment" : after.balance > before.balance ? "withdraw" : "updated",
          balanceBefore: before.balance, balanceAfter: after.balance, note: null,
        })
      }
      if (before && before.status !== after.status) {
        await dbAddLiabilityLog({
          liabilityId: id, liabilityName: after.name,
          eventType: after.status === "closed" ? "closed" : "reopened",
          balanceBefore: before.balance, balanceAfter: after.balance, note: null,
        })
      }
    }
  },
  remove: async (id) => {
    const item = get().items.find((i) => i.id === id)
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
    await dbDeleteLiability(id)
    if (item) dbAddAuditLog({ tableName: "liabilities", recordId: id, action: "delete", recordName: item.name })
  },
  loadLogs: (liabilityId) => dbLoadLiabilityLogs(liabilityId),
}))

// ── Budget ────────────────────────────────────────────────────────────────────
interface BudgetState {
  entries: BudgetEntry[]; loaded: boolean
  load: () => Promise<void>
  add: (e: Omit<BudgetEntry, "id">) => Promise<void>
  updateAmount: (id: string, month: number, amount: number) => void
  remove: (id: string) => Promise<void>
}
export const useBudget = create<BudgetState>()((set, get) => ({
  entries: [], loaded: false,
  load: async () => {
    if (get().loaded) return
    const raw = await dbLoadBudget()
    const entries = raw.map((e) => ({ ...e, category: e.category as BudgetCategory }))
    set({ entries, loaded: true })
  },
  add: async (e) => {
    const entry = { ...e, id: crypto.randomUUID() }
    set((s) => ({ entries: [...s.entries, entry] }))
    await dbUpsertBudget(entry)
    dbAddAuditLog({ tableName: "budget_entries", recordId: entry.id, action: "create", recordName: entry.name, payload: { category: entry.category, name: entry.name } })
  },
  updateAmount: (id, month, amount) => {
    set((s) => ({
      entries: s.entries.map((e) => {
        if (e.id !== id) return e
        const amounts = [...e.amounts]
        amounts[month] = amount
        return { ...e, amounts }
      }),
    }))
    // debounce DB write so rapid multi-month edits don't race each other
    clearTimeout(budgetSaveTimers.get(id))
    budgetSaveTimers.set(id, setTimeout(() => {
      const entry = get().entries.find((e) => e.id === id)
      if (entry) dbUpsertBudget(entry)
      budgetSaveTimers.delete(id)
    }, 600))
  },
  remove: async (id) => {
    const entry = get().entries.find((e) => e.id === id)
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
    await dbDeleteBudget(id)
    if (entry) dbAddAuditLog({ tableName: "budget_entries", recordId: id, action: "delete", recordName: entry.name })
  },
}))

// ── Retirement ────────────────────────────────────────────────────────────────
interface RetirementState {
  monthlyExpenseAtRetirement: number; investmentReturn: number
  currentPvdBalance: number; pvdRate: number; employerRate: number
  monthlyDcaAmount: number; otherMonthlyIncome: number
  loaded: boolean
  load: () => Promise<void>
  set: (data: Partial<Omit<RetirementState, "set" | "load" | "loaded">>) => void
}
export const useRetirement = create<RetirementState>()((set, get) => ({
  monthlyExpenseAtRetirement: 0, investmentReturn: 0, currentPvdBalance: 0,
  pvdRate: 0, employerRate: 0, monthlyDcaAmount: 0, otherMonthlyIncome: 0, loaded: false,
  load: async () => {
    if (get().loaded) return
    const data = await dbLoadRetirement()
    if (data) set({ ...data, loaded: true })
    else set({ loaded: true })
  },
  set: (data) => {
    set((s) => ({ ...s, ...data }))
    const s = get()
    dbSaveRetirement({
      monthlyExpenseAtRetirement: s.monthlyExpenseAtRetirement,
      otherMonthlyIncome: s.otherMonthlyIncome,
      investmentReturn: s.investmentReturn,
      pvdRate: s.pvdRate, employerRate: s.employerRate,
      currentPvdBalance: s.currentPvdBalance,
      monthlyDcaAmount: s.monthlyDcaAmount,
    })
  },
}))

// ── AI Advisor page context ───────────────────────────────────────────────────
interface AiAdvisorState {
  generateFn: (() => Promise<string>) | null
  pageName: string | null
  cache: Record<string, string>
  isOpen: boolean
  set: (fn: () => Promise<string>, pageName: string) => void
  setCache: (pageName: string, result: string) => void
  setOpen: (open: boolean) => void
  clear: () => void
}
export const useAiAdvisorContext = create<AiAdvisorState>()((set) => ({
  generateFn: null, pageName: null, cache: {}, isOpen: false,
  set: (fn, pageName) => set({ generateFn: fn, pageName }),
  setCache: (pageName, result) => set((s) => ({ cache: { ...s.cache, [pageName]: result } })),
  setOpen: (open) => set({ isOpen: open }),
  clear: () => set({ generateFn: null, pageName: null }),
}))

// ── Selectors ─────────────────────────────────────────────────────────────────
export function budgetAvgMonthly(entries: BudgetEntry[], category: BudgetCategory): number {
  const total = entries.filter((e) => e.category === category).reduce((s, e) => s + e.amounts.reduce((a, b) => a + b, 0), 0)
  // bonus is lump-sum, not spread monthly — return annual total as-is for display, divided by 12 only for ratio calcs
  return total / 12
}

export function budgetBonusAnnual(entries: BudgetEntry[]): number {
  return entries.filter((e) => e.category === "bonus").reduce((s, e) => s + e.amounts.reduce((a, b) => a + b, 0), 0)
}

export function budgetMonthTotal(entries: BudgetEntry[], month: number, category?: BudgetCategory): number {
  const filtered = category ? entries.filter((e) => e.category === category) : entries
  return filtered.reduce((s, e) => s + (e.amounts[month] ?? 0), 0)
}

export function budgetAnnualTotal(entries: BudgetEntry[], category: BudgetCategory): number {
  return entries.filter((e) => e.category === category).reduce((s, e) => s + e.amounts.reduce((a, b) => a + b, 0), 0)
}
