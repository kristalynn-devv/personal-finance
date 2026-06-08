import { useProfile, useRetirement, useBudget, budgetAvgMonthly } from "@/store"
import { calcFV, calcPV } from "@/lib/calculations"
import { formatCurrency } from "@/lib/format"
import { PageHeader } from "@/components/PageHeader"
import { SummaryCard } from "@/components/SummaryCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { useEffect } from "react"
import { useAiAdvisorContext } from "@/store"
import { generatePageInsight } from "@/lib/ai"

export default function RetirementPage() {
  const profile = useProfile()
  const retirement = useRetirement()
  const { entries } = useBudget()
  const avgIncome = budgetAvgMonthly(entries, "income")
  const aiCtx = useAiAdvisorContext()

  const yearsToRetirement = Math.max(0, profile.retirementAge - profile.age)
  const yearsInRetirement = Math.max(0, profile.lifeExpectancy - profile.retirementAge)

  const realMonthlyExpense = (retirement.monthlyExpenseAtRetirement || (budgetAvgMonthly(entries, "fixed_expense") + budgetAvgMonthly(entries, "variable_expense"))) *
    Math.pow(1 + profile.inflationRate / 100, yearsToRetirement)

  const nestEggNeeded = calcPV(realMonthlyExpense - retirement.otherMonthlyIncome, retirement.investmentReturn, yearsInRetirement)

  const pvdMonthly = avgIncome * (retirement.pvdRate + retirement.employerRate) / 100
  const pvdFV = calcFV(retirement.currentPvdBalance, retirement.investmentReturn, yearsToRetirement, pvdMonthly)
  const dcaFV = calcFV(0, retirement.investmentReturn, yearsToRetirement, retirement.monthlyDcaAmount)
  const totalProjected = pvdFV + dcaFV

  const gap = nestEggNeeded - totalProjected
  const progress = nestEggNeeded > 0 ? Math.min(100, (totalProjected / nestEggNeeded) * 100) : 0

  const additionalNeeded = (() => {
    if (gap <= 0) return 0
    const r = retirement.investmentReturn / 100 / 12
    const n = yearsToRetirement * 12
    if (r === 0 || n === 0) return 0
    return (gap * r) / (Math.pow(1 + r, n) - 1)
  })()

  const chartData = Array.from({ length: yearsToRetirement + 1 }, (_, i) => ({
    year: new Date().getFullYear() + 543 + i,
    คาดการณ์: Math.round(calcFV(retirement.currentPvdBalance, retirement.investmentReturn, i, pvdMonthly + retirement.monthlyDcaAmount)),
    เป้าหมาย: Math.round(nestEggNeeded),
  }))

  useEffect(() => {
    const context = [
      `อายุ ${profile.age} ปี เกษียณอายุ ${profile.retirementAge} ปี เหลือเวลา ${yearsToRetirement} ปี`,
      `เป้าหมายเงินเกษียณ: ${formatCurrency(nestEggNeeded)}`,
      `คาดว่าจะมี: ${formatCurrency(totalProjected)} (${progress.toFixed(0)}% ของเป้า)`,
      gap > 0 ? `ขาดอีก: ${formatCurrency(gap)}` : "บรรลุเป้าหมายแล้ว",
      `DCA: ${formatCurrency(retirement.monthlyDcaAmount)}/เดือน | PVD: ${formatCurrency(retirement.currentPvdBalance)}`,
      `ผลตอบแทนคาดหวัง: ${retirement.investmentReturn}% ต่อปี`,
    ].join("\n")
    aiCtx.set(() => generatePageInsight(context, "แนะนำสิ่งที่ควรทำเพื่อให้บรรลุเป้าหมายเกษียณ โดยอ้างอิงตัวเลขจริง", "retirement"), "วางแผนเกษียณ")
  }, [profile.age, profile.retirementAge, retirement.monthlyDcaAmount, retirement.investmentReturn])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader title="วางแผนเกษียณ" description="คำนวณเงินที่ต้องมี ณ วันเกษียณ" />

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="py-4"><CardTitle className="text-base">ข้อมูลส่วนตัว</CardTitle></CardHeader>
          <CardContent className="pt-0 grid grid-cols-2 gap-3">
            {[
              { label: "อายุปัจจุบัน", value: profile.age, key: "age" },
              { label: "อายุเกษียณ", value: profile.retirementAge, key: "retirementAge" },
              { label: "อายุขัย (คาดการณ์)", value: profile.lifeExpectancy, key: "lifeExpectancy" },
              { label: "เงินเฟ้อ (%/ปี)", value: profile.inflationRate, key: "inflationRate", step: "0.1" },
            ].map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <Input type="number" value={f.value || ""} step={f.step} placeholder="0" onChange={(e) => profile.set({ [f.key]: parseFloat(e.target.value) || 0 })} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4"><CardTitle className="text-base">ข้อมูลการเกษียณ</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "ค่าใช้จ่าย/เดือน (฿)", key: "monthlyExpenseAtRetirement" },
                { label: "รายได้อื่น/เดือน (฿)", key: "otherMonthlyIncome" },
                { label: "ผลตอบแทน (%/ปี)", key: "investmentReturn", step: "0.5" },
                { label: "DCA เพิ่ม/เดือน (฿)", key: "monthlyDcaAmount" },
              ].map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  <Input type="number" value={(retirement as any)[f.key] || ""} step={f.step} placeholder="0" onChange={(e) => retirement.set({ [f.key]: parseFloat(e.target.value) || 0 })} />
                </div>
              ))}
            </div>
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">กองทุนสำรองเลี้ยงชีพ (PVD)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "ยอดปัจจุบัน (฿)", key: "currentPvdBalance" },
                  { label: "สมทบพนักงาน (%)", key: "pvdRate", step: "0.5" },
                  { label: "สมทบนายจ้าง (%)", key: "employerRate", step: "0.5" },
                ].map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    <Input type="number" value={(retirement as any)[f.key] || ""} step={f.step} placeholder="0" onChange={(e) => retirement.set({ [f.key]: parseFloat(e.target.value) || 0 })} />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <SummaryCard label="เงินที่ต้องมี" value={formatCurrency(nestEggNeeded)} valueClass="text-red-500" />
        <SummaryCard label="คาดว่าจะมี" value={formatCurrency(totalProjected)} valueClass="text-blue-600" />
        <SummaryCard label={gap > 0 ? "ขาดอีก" : "เกินเป้า"} value={formatCurrency(Math.abs(gap))} valueClass={gap > 0 ? "text-orange-600" : "text-emerald-600"} />
        <SummaryCard label="ต้องออมเพิ่ม/เดือน" value={additionalNeeded > 0 ? formatCurrency(additionalNeeded) : "ไม่ต้อง"} valueClass={additionalNeeded > 0 ? "text-orange-600" : "text-emerald-600"} />
      </div>

      <Card className="mb-4">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">ความคืบหน้าสู่เป้าหมาย</span>
            <span className="text-sm font-bold tabular-nums">{progress.toFixed(0)}%</span>
          </div>
          <Progress value={progress} className="h-2.5 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "จาก PVD", value: formatCurrency(pvdFV) },
              { label: "จาก DCA", value: formatCurrency(dcaFV) },
              { label: "หลังเกษียณ", value: `${yearsInRetirement} ปี` },
            ].map((item) => (
              <div key={item.label} className="bg-muted/50 rounded-lg px-3 py-2 text-center">
                <p className="text-[11px] text-muted-foreground mb-0.5">{item.label}</p>
                <p className="text-sm font-semibold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4"><CardTitle className="text-base">Projection Chart</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `฿${(v / 1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Area type="monotone" dataKey="คาดการณ์" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
              <Area type="monotone" dataKey="เป้าหมาย" stroke="#ef4444" fill="none" strokeDasharray="5 5" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
