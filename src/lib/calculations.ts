export interface Asset {
  id: string
  category: "liquid" | "investment" | "personal"
  name: string
  value: number
}

export interface Liability {
  id: string
  type: "credit_card" | "personal_loan" | "mortgage" | "car" | "student_loan"
  name: string
  balance: number
  originalAmount: number
  interestRate: number
  minimumPayment: number
  status: "active" | "closed"
}

export function calcPMT(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) return principal / months
  const r = annualRate / 100 / 12
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

export function calcFV(pv: number, annualRate: number, years: number, monthlyContribution: number): number {
  const r = annualRate / 100 / 12
  const n = years * 12
  if (r === 0) return pv + monthlyContribution * n
  return pv * Math.pow(1 + r, n) + monthlyContribution * ((Math.pow(1 + r, n) - 1) / r)
}

export function calcPV(monthlyPayment: number, annualRate: number, years: number): number {
  const r = annualRate / 100 / 12
  const n = years * 12
  if (r === 0) return monthlyPayment * n
  return (monthlyPayment * (1 - Math.pow(1 + r, -n))) / r
}

export function calcSocialSecurity(monthlySalary: number): number {
  return Math.min(monthlySalary * 0.05, 750)
}

export function calcTaxPayable(taxableIncome: number): number {
  const brackets = [
    { limit: 150000, rate: 0 },
    { limit: 300000, rate: 0.05 },
    { limit: 500000, rate: 0.1 },
    { limit: 750000, rate: 0.15 },
    { limit: 1000000, rate: 0.2 },
    { limit: 2000000, rate: 0.25 },
    { limit: 5000000, rate: 0.3 },
    { limit: Infinity, rate: 0.35 },
  ]
  let tax = 0
  let prev = 0
  for (const bracket of brackets) {
    if (taxableIncome <= prev) break
    const taxable = Math.min(taxableIncome, bracket.limit) - prev
    tax += taxable * bracket.rate
    prev = bracket.limit
  }
  return tax
}

export type DebtStrategy = "avalanche" | "snowball" | "custom"

export interface DebtPayoffMonth {
  month: number
  balance: number
}

export interface DebtScheduleResult {
  schedule: DebtPayoffMonth[][]
  totalInterest: number
  monthsToPayoff: number
  debtOrder: Liability[]
  payoffMonths: number[]  // individual payoff month for each debt in debtOrder
}

export function calcDebtPayoffSchedule(
  debts: Liability[],
  extraPayment: number,
  strategy: DebtStrategy
): DebtScheduleResult {
  if (debts.length === 0) return { schedule: [], totalInterest: 0, monthsToPayoff: 0, debtOrder: [], payoffMonths: [] }

  const sorted = [...debts].sort((a, b) => {
    if (strategy === "avalanche") return b.interestRate - a.interestRate
    if (strategy === "snowball") return a.balance - b.balance
    return 0
  })

  const balances = sorted.map((d) => d.balance)
  const schedule: DebtPayoffMonth[][] = sorted.map(() => [])
  const payoffMonths: number[] = sorted.map(() => 0)
  let totalInterest = 0
  let month = 0
  const MAX_MONTHS = 600

  while (balances.some((b) => b > 0) && month < MAX_MONTHS) {
    month++
    // Accumulate freed minimums from fully paid debts into extra pool
    let extra = extraPayment + sorted.reduce((s, d, i) => (balances[i] <= 0 ? s + d.minimumPayment : s), 0)
    let extraConsumed = false

    for (let i = 0; i < sorted.length; i++) {
      if (balances[i] <= 0) {
        schedule[i].push({ month, balance: 0 })
        continue
      }
      const d = sorted[i]
      const r = d.interestRate / 100 / 12
      const interest = balances[i] * r
      totalInterest += interest
      // First non-zero debt gets all extra; subsequent debts get only their minimum
      let payment = d.minimumPayment + (!extraConsumed ? extra : 0)
      extraConsumed = true
      payment = Math.min(payment, balances[i] + interest)
      const principal = payment - interest
      balances[i] = Math.max(0, balances[i] - principal)
      if (balances[i] === 0 && payoffMonths[i] === 0) payoffMonths[i] = month
      schedule[i].push({ month, balance: balances[i] })
    }
  }

  return { schedule, totalInterest, monthsToPayoff: month, debtOrder: sorted, payoffMonths }
}

export interface HealthScore {
  savingsRate: number
  debtToIncome: number
  emergencyFund: number
  netWorth: number
  homeEquity: number
  consumerDebtPayment: number
  mortgagePayment: number
  score: number
  statuses: Record<string, "good" | "warning" | "danger">
}

export function calcFinancialHealth(
  assets: Asset[],
  liabilities: Liability[],
  monthlyIncome: number,
  monthlySavings: number,
  monthlyExpenses: number
): HealthScore {
  const liquidAssets = assets.filter((a) => a.category === "liquid").reduce((s, a) => s + a.value, 0)
  const totalAssets = assets.reduce((s, a) => s + a.value, 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0)

  const mortgages = liabilities.filter((l) => l.type === "mortgage")
  const consumerDebts = liabilities.filter((l) => l.type !== "mortgage")
  const mortgagePayment = mortgages.reduce((s, l) => s + l.minimumPayment, 0)
  const consumerDebtPayment = consumerDebts.reduce((s, l) => s + l.minimumPayment, 0)
  const totalDebtPayment = mortgagePayment + consumerDebtPayment

  const mortgageBalance = mortgages.reduce((s, l) => s + l.balance, 0)
  const personalAssets = assets.filter((a) => a.category === "personal").reduce((s, a) => s + a.value, 0)
  const homeEquity = personalAssets - mortgageBalance

  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0
  const debtToIncome = monthlyIncome > 0 ? (totalDebtPayment / monthlyIncome) * 100 : 0
  const emergencyFund = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0
  const netWorth = totalAssets - totalLiabilities

  const savingsStatus: "good" | "warning" | "danger" = savingsRate >= 10 ? "good" : savingsRate >= 5 ? "warning" : "danger"
  const debtStatus: "good" | "warning" | "danger" = debtToIncome < 36 ? "good" : debtToIncome < 43 ? "warning" : "danger"
  const emergencyStatus: "good" | "warning" | "danger" = emergencyFund >= 6 ? "good" : emergencyFund >= 3 ? "warning" : "danger"
  const netWorthStatus: "good" | "warning" | "danger" = netWorth > 0 ? "good" : netWorth === 0 ? "warning" : "danger"

  const score = (s: "good" | "warning" | "danger") => (s === "good" ? 25 : s === "warning" ? 12 : 0)
  const totalScore = score(savingsStatus) + score(debtStatus) + score(emergencyStatus) + score(netWorthStatus)

  return {
    savingsRate,
    debtToIncome,
    emergencyFund,
    netWorth,
    homeEquity,
    consumerDebtPayment,
    mortgagePayment,
    score: totalScore,
    statuses: { savingsRate: savingsStatus, debtToIncome: debtStatus, emergencyFund: emergencyStatus, netWorth: netWorthStatus },
  }
}
