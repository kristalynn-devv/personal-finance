import { useState, useEffect } from "react"
import { useAssets, useLiabilities, useBudget, budgetAvgMonthly, useProfile, useRetirement, useAiAdvisorContext } from "@/store"
import { calcFinancialHealth } from "@/lib/calculations"
import { formatCurrency } from "@/lib/format"
import { PageHeader } from "@/components/PageHeader"
import { SummaryCard } from "@/components/SummaryCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Scale, CreditCard, BarChart3, TrendingUp } from "lucide-react"
import { generateBehaviorAnalysis } from "@/lib/ai"
import { dbLoadAllLiabilityLogs, type LiabilityLog } from "@/lib/db"

export default function DashboardPage() {
  const { items: assets } = useAssets()
  const { items: liabilities } = useLiabilities()
  const { entries } = useBudget()
  const profile = useProfile()
  const retirement = useRetirement()

  const aiCtx = useAiAdvisorContext()
  const [liabilityLogs, setLiabilityLogs] = useState<LiabilityLog[]>([])
  const [behaviorResult, setBehaviorResult] = useState<string | null>(() => {
    try { return localStorage.getItem("behavior_analysis_result") } catch { return null }
  })
  const [behaviorLoading, setBehaviorLoading] = useState(false)

  useEffect(() => {
    dbLoadAllLiabilityLogs(200).then(setLiabilityLogs)
  }, [])

  const generateBehavior = () => generateBehaviorAnalysis(
    liabilityLogs, assets, liabilities, entries,
    { name: profile.name, age: profile.age, retirementAge: profile.retirementAge, lifeExpectancy: profile.lifeExpectancy, inflationRate: profile.inflationRate },
    { monthlyExpenseAtRetirement: retirement.monthlyExpenseAtRetirement, investmentReturn: retirement.investmentReturn, currentPvdBalance: retirement.currentPvdBalance, pvdRate: retirement.pvdRate, employerRate: retirement.employerRate, monthlyDcaAmount: retirement.monthlyDcaAmount, otherMonthlyIncome: retirement.otherMonthlyIncome }
  )

  // register page insight with the advisor bubble
  useEffect(() => {
    if (!hasData) return
    aiCtx.set(async () => {
      const result = await generateBehavior()
      setBehaviorResult(result)
      localStorage.setItem("behavior_analysis_result", result)
      return result
    }, "หน้าหลัก")
  }, [assets.length, liabilities.length, entries.length])

  // auto-run only when no cached result exists
  useEffect(() => {
    if (!hasData || behaviorResult || behaviorLoading) return
    if (liabilityLogs.length === 0) return
    setBehaviorLoading(true)
    generateBehavior().then((result) => {
      setBehaviorResult(result)
      localStorage.setItem("behavior_analysis_result", result)
    }).catch(() => {}).finally(() => setBehaviorLoading(false))
  }, [liabilityLogs.length])

  const monthlyIncome = budgetAvgMonthly(entries, "income")
  const monthlySavings = budgetAvgMonthly(entries, "saving")
  const monthlyFixed = budgetAvgMonthly(entries, "fixed_expense")
  const monthlyVariable = budgetAvgMonthly(entries, "variable_expense")
  const h = calcFinancialHealth(assets, liabilities, monthlyIncome, monthlySavings, monthlyFixed + monthlyVariable)

  const totalAssets = assets.reduce((s, a) => s + a.value, 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0)
  const netWorth = totalAssets - totalLiabilities
  const monthlyDebt = h.consumerDebtPayment + h.mortgagePayment
  const cashFlow = monthlyIncome - monthlySavings - monthlyFixed - monthlyVariable - monthlyDebt

  const hasData = assets.length > 0 || liabilities.length > 0 || entries.length > 0

  const donutData = [
    { name: "ออม", value: monthlySavings, color: "#3b82f6" },
    { name: "ผ่อนหนี้", value: monthlyDebt, color: "#ef4444" },
    { name: "รายจ่ายคงที่", value: monthlyFixed, color: "#f97316" },
    { name: "รายจ่ายผันแปร", value: monthlyVariable, color: "#eab308" },
  ].filter((d) => d.value > 0)

  const scoreColor = h.score >= 75 ? "text-emerald-600" : h.score >= 50 ? "text-amber-600" : "text-red-500"

  if (!hasData) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <PageHeader title="หน้าหลัก" description="สรุปสถานะการเงินของคุณ" />
        <Card>
          <CardContent className="py-20 text-center">
            <p className="text-5xl mb-4">💰</p>
            <h2 className="text-xl font-bold mb-2">เริ่มต้นวางแผนการเงิน</h2>
            <p className="text-muted-foreground mb-8 text-sm">กรอกข้อมูลเพื่อดูสรุปสถานะการเงินของคุณ</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a href="/balance-sheet"><Button>บันทึกสินทรัพย์-หนี้</Button></a>
              <a href="/budget"><Button variant="outline">กรอกรายรับ-รายจ่าย</Button></a>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader title="หน้าหลัก" description="สรุปสถานะการเงินของคุณ" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="สินทรัพย์รวม" value={formatCurrency(totalAssets)} valueClass="text-emerald-600" />
        <SummaryCard label="หนี้สินรวม" value={formatCurrency(totalLiabilities)} valueClass="text-red-500" />
        <SummaryCard label="ความมั่งคั่งสุทธิ" value={formatCurrency(netWorth)} valueClass={netWorth >= 0 ? "text-blue-600" : "text-red-500"} />
        <SummaryCard label="กระแสเงินสด" value={formatCurrency(cashFlow)} sub="/เดือน (เฉลี่ย)" valueClass={cashFlow >= 0 ? "text-emerald-600" : "text-red-500"} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-base">สุขภาพการเงิน</CardTitle>
            <a href="/health"><Button variant="ghost">ดูรายละเอียด →</Button></a>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-center mb-4">
              <p className={`text-5xl font-bold tabular-nums ${scoreColor}`}>{h.score}</p>
              <p className="text-xs text-muted-foreground mt-1">จาก 100 คะแนน</p>
            </div>
            <Progress value={h.score} className="h-2 mb-4" />
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(h.statuses).map(([key, status]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status === "good" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : "bg-red-500"}`} />
                  <span className="text-muted-foreground">{
                    key === "savingsRate" ? "อัตราออม" :
                    key === "debtToIncome" ? "ภาระหนี้" :
                    key === "emergencyFund" ? "เงินฉุกเฉิน" : "มั่งคั่งสุทธิ"
                  }</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4"><CardTitle className="text-base">สัดส่วนรายจ่ายเฉลี่ย/เดือน</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">กรอกรายจ่ายในหน้า รายรับ-รายจ่าย</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
        {[
          { href: "/balance-sheet", icon: Scale, label: "อัปเดตสินทรัพย์", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
          { href: "/debt", icon: CreditCard, label: "จัดการหนี้", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30" },
          { href: "/budget", icon: BarChart3, label: "แก้ไขงบประมาณ", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
          { href: "/retirement", icon: TrendingUp, label: "วางแผนเกษียณ", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30" },
        ].map((item) => (
          <a key={item.href} href={item.href}>
            <Card className="hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5">
              <CardContent className="p-4 text-center">
                <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center mx-auto mb-2.5`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <p className="text-xs font-semibold">{item.label}</p>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>

    </div>
  )
}
