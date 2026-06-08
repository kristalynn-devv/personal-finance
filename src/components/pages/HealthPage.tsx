import { useEffect } from "react"
import { useAssets, useLiabilities, useBudget, budgetAvgMonthly, useAiAdvisorContext } from "@/store"
import { calcFinancialHealth } from "@/lib/calculations"
import { formatCurrency, formatPercent } from "@/lib/format"
import { PageHeader } from "@/components/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import { generatePageInsight } from "@/lib/ai"

const STATUS_CONFIG = {
  good: { label: "ดี", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: CheckCircle, bar: "bg-emerald-500" },
  warning: { label: "ควรปรับ", color: "text-amber-600 bg-amber-50 border-amber-200", icon: AlertTriangle, bar: "bg-amber-500" },
  danger: { label: "ต้องแก้ไข", color: "text-red-600 bg-red-50 border-red-200", icon: XCircle, bar: "bg-red-500" },
}

export default function HealthPage() {
  const { items: assets } = useAssets()
  const { items: liabilities } = useLiabilities()
  const { entries } = useBudget()
  const aiCtx = useAiAdvisorContext()

  const monthlyIncome = budgetAvgMonthly(entries, "income")
  const monthlySavings = budgetAvgMonthly(entries, "saving")
  const monthlyExpenses = budgetAvgMonthly(entries, "fixed_expense") + budgetAvgMonthly(entries, "variable_expense")

  const h = calcFinancialHealth(assets, liabilities, monthlyIncome, monthlySavings, monthlyExpenses)

  const ratios = [
    {
      key: "savingsRate",
      label: "อัตราการออม",
      value: formatPercent(h.savingsRate),
      benchmark: "≥ 10%",
      formula: "(ออม ÷ รายได้) × 100",
      status: h.statuses.savingsRate as "good" | "warning" | "danger",
    },
    {
      key: "debtToIncome",
      label: "ภาระหนี้ต่อรายได้ (DTI)",
      value: formatPercent(h.debtToIncome),
      benchmark: "< 43%",
      formula: "(ผ่อนหนี้ทุกประเภทรวมบ้าน ÷ รายได้) × 100",
      status: h.statuses.debtToIncome as "good" | "warning" | "danger",
    },
    {
      key: "emergencyFund",
      label: "เงินสำรองฉุกเฉิน",
      value: h.emergencyFund.toFixed(1) + " เดือน",
      benchmark: "≥ 6 เดือน",
      formula: "สินทรัพย์สภาพคล่อง ÷ รายจ่าย/เดือน",
      status: h.statuses.emergencyFund as "good" | "warning" | "danger",
    },
    {
      key: "netWorth",
      label: "ความมั่งคั่งสุทธิ",
      value: formatCurrency(h.netWorth),
      benchmark: "> 0",
      formula: "สินทรัพย์ − หนี้สิน",
      status: h.statuses.netWorth as "good" | "warning" | "danger",
    },
  ]

  const scoreColor = h.score >= 75 ? "text-emerald-600" : h.score >= 50 ? "text-amber-600" : "text-red-500"
  const scoreLabel = h.score >= 75 ? "สุขภาพดี" : h.score >= 50 ? "พอใช้" : "ต้องปรับปรุง"

  useEffect(() => {
    const statusThai: Record<string, string> = { good: "ดี", warning: "ควรปรับ", danger: "ต้องแก้ไข" }
    const context = [
      `คะแนนสุขภาพการเงิน: ${h.score}/100`,
      `อัตราออม: ${h.savingsRate.toFixed(1)}% (${statusThai[h.statuses.savingsRate]})`,
      `หนี้ต่อรายรับ: ${h.debtToIncome.toFixed(1)}% (${statusThai[h.statuses.debtToIncome]})`,
      `เงินฉุกเฉิน: ${h.emergencyFund.toFixed(1)} เดือน (${statusThai[h.statuses.emergencyFund]})`,
      `ความมั่งคั่งสุทธิ: ${statusThai[h.statuses.netWorth]}`,
    ].join("\n")
    aiCtx.set(() => generatePageInsight(context, "อธิบายจุดที่ต้องแก้ไขเร่งด่วนและแนวทางปรับปรุงที่เป็นรูปธรรม", "health"), "สุขภาพการเงิน")
  }, [h.score, assets.length, liabilities.length, entries.length])

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <PageHeader title="ตรวจสุขภาพการเงิน" description="ประเมินอัตราส่วนทางการเงินสำคัญ 4 ตัว" />

      <Card className="mb-6">
        <CardContent className="pt-6 pb-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">คะแนนสุขภาพการเงิน</p>
          <p className={`text-7xl font-bold tabular-nums mb-1 ${scoreColor}`}>{h.score}</p>
          <p className={`text-sm font-medium mb-4 ${scoreColor}`}>{scoreLabel}</p>
          <div className="max-w-xs mx-auto">
            <Progress value={h.score} className="h-3" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">จาก 100 คะแนน</p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {ratios.map((r) => {
          const cfg = STATUS_CONFIG[r.status]
          const Icon = cfg.icon
          return (
            <Card key={r.key}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm text-muted-foreground font-medium">{r.label}</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </div>
                <p className="text-2xl font-bold tabular-nums mb-3">{r.value}</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>สูตร: {r.formula}</p>
                  <p>เกณฑ์มาตรฐาน: <span className="font-medium text-foreground">{r.benchmark}</span></p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="py-4"><CardTitle className="text-base">ข้อมูลที่ใช้คำนวณ</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            {[
              { label: "รายได้/เดือน", value: formatCurrency(monthlyIncome) },
              { label: "ออม/เดือน", value: formatCurrency(monthlySavings) },
              { label: "ผ่อนหนี้รวม/เดือน", value: formatCurrency(h.consumerDebtPayment + h.mortgagePayment) },
              { label: "— หนี้ผู้บริโภค", value: formatCurrency(h.consumerDebtPayment) },
              { label: "— บ้าน (Mortgage)", value: formatCurrency(h.mortgagePayment) },
              { label: "สินทรัพย์สภาพคล่อง", value: formatCurrency(assets.filter(a => a.category === "liquid").reduce((s, a) => s + a.value, 0)) },
            ].map((item) => (
              <div key={item.label} className="border-l-2 border-border/60 pl-3">
                <p className="text-muted-foreground text-[11px] mb-0.5">{item.label}</p>
                <p className="font-semibold tabular-nums text-base">{item.value}</p>
              </div>
            ))}
          </div>
          {monthlyIncome === 0 && (
            <p className="text-xs text-amber-600 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              ⚠️ กรุณากรอกข้อมูลรายรับในหน้า "รายรับ-รายจ่าย" เพื่อคำนวณอัตราส่วนได้ถูกต้อง
            </p>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
