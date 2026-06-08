import { useState, useEffect } from "react"
import { useLiabilities, useBudget, budgetBonusAnnual, useAiAdvisorContext } from "@/store"
import { calcDebtPayoffSchedule, type DebtStrategy } from "@/lib/calculations"
import { formatCurrency } from "@/lib/format"
import { PageHeader } from "@/components/PageHeader"
import { SummaryCard } from "@/components/SummaryCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { generatePageInsight } from "@/lib/ai"

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f97316", "#8b5cf6", "#06b6d4"]

export default function DebtPage() {
  const { items } = useLiabilities()
  const { entries } = useBudget()
  const [strategy, setStrategy] = useState<DebtStrategy>("avalanche")
  const [extra, setExtra] = useState(0)
  const [lumpSum, setLumpSum] = useState(0)
  const [lumpSumDebtId, setLumpSumDebtId] = useState<string>("auto")

  const mortgages = items.filter((l) => l.type === "mortgage" && l.status !== "closed")
  const consumerDebts = items.filter((l) => l.type !== "mortgage" && l.status !== "closed")
  const bonusAnnual = budgetBonusAnnual(entries)
  const aiCtx = useAiAdvisorContext()

  const result = calcDebtPayoffSchedule(consumerDebts, extra, strategy)

  // Lump sum simulation: apply payment, roll freed minimums into extra
  const lumpSumResult = (() => {
    if (!lumpSum || consumerDebts.length === 0) return null
    let debtsAfterLump = consumerDebts.map((d) => ({ ...d }))
    if (lumpSumDebtId === "auto") {
      const sorted = [...debtsAfterLump].sort((a, b) => b.interestRate - a.interestRate)
      let remaining = lumpSum
      for (const d of sorted) {
        const target = debtsAfterLump.find((x) => x.id === d.id)!
        const pay = Math.min(remaining, target.balance)
        target.balance -= pay
        remaining -= pay
        if (remaining <= 0) break
      }
    } else {
      const target = debtsAfterLump.find((d) => d.id === lumpSumDebtId)
      if (target) target.balance = Math.max(0, target.balance - lumpSum)
    }
    // Freed minimums from paid-off debts roll into monthly extra
    const freedMinimums = debtsAfterLump.filter((d) => d.balance <= 0).reduce((s, d) => s + d.minimumPayment, 0)
    const remaining = debtsAfterLump.filter((d) => d.balance > 0)
    return calcDebtPayoffSchedule(remaining, extra + freedMinimums, strategy)
  })()

  const savedMonths = lumpSumResult ? result.monthsToPayoff - lumpSumResult.monthsToPayoff : 0
  const savedInterest = lumpSumResult ? result.totalInterest - lumpSumResult.totalInterest : 0

  const bestDebt = consumerDebts.length > 0
    ? [...consumerDebts].sort((a, b) => b.interestRate - a.interestRate)[0]
    : null

  const payoffDate = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + result.monthsToPayoff)
    return d.toLocaleDateString("th-TH", { month: "long", year: "numeric" })
  })()

  const maxMonth = result.monthsToPayoff
  const chartData = Array.from({ length: maxMonth }, (_, i) => {
    const point: Record<string, number | string> = { month: `เดือน ${i + 1}` }
    result.debtOrder.forEach((debt, di) => {
      point[debt.name] = result.schedule[di]?.[i]?.balance ?? 0
    })
    return point
  })

  useEffect(() => {
    const context = [
      `กลยุทธ์: ${strategy === "avalanche" ? "Avalanche (ดบ.สูงก่อน)" : strategy === "snowball" ? "Snowball (ยอดน้อยก่อน)" : "Custom"}`,
      `หนี้ทั้งหมด:\n${consumerDebts.map(l => `  - ${l.name}: ยอด ${formatCurrency(l.balance)} ดอกเบี้ย ${l.interestRate}% ขั้นต่ำ ${formatCurrency(l.minimumPayment)}/เดือน`).join("\n") || "  ไม่มี"}`,
      `โป๊ะพิเศษ: ${formatCurrency(extra)}/เดือน`,
      `ดอกเบี้ยรวมตลอดอายุหนี้: ${formatCurrency(result.totalInterest)}`,
      `หนี้หมดใน: ${result.monthsToPayoff} เดือน`,
      bonusAnnual > 0 ? `โบนัสปีนี้: ${formatCurrency(bonusAnnual)}` : "",
    ].filter(Boolean).join("\n")
    aiCtx.set(() => generatePageInsight(context, "วิเคราะห์ว่าควรโป๊ะหนี้ตัวไหนก่อนและเพราะอะไร ถ้ามีโบนัสควรแบ่งจ่ายหนี้อย่างไร", "debt"), "จัดการหนี้")
  }, [consumerDebts.length, strategy, extra, bonusAnnual])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader title="แผนการจัดการหนี้" description="วางแผนชำระหนี้อย่างมีประสิทธิภาพ" />

      {mortgages.length > 0 && (
        <Card className="mb-4 border-purple-200 bg-purple-50/40">
          <CardHeader className="py-3">
            <CardTitle className="text-base text-purple-800">สินเชื่อบ้าน (แยกต่างหาก)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead className="text-right">ยอดคงเหลือ</TableHead>
                  <TableHead className="text-right">ดอกเบี้ย</TableHead>
                  <TableHead className="text-right">ผ่อน/เดือน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mortgages.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right font-mono text-purple-700">{formatCurrency(m.balance)}</TableCell>
                    <TableCell className="text-right"><Badge variant="secondary">{m.interestRate}%</Badge></TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(m.minimumPayment)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {consumerDebts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-4xl mb-3">💳</p>
            <p className="text-muted-foreground mb-4">ยังไม่มีข้อมูลหนี้สิน</p>
            <a href="/balance-sheet"><Button variant="outline">ไปเพิ่มหนี้สิน</Button></a>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Combined controls */}
          <Card className="mb-4">
            <CardContent className="pt-5 pb-5 space-y-5">
              {/* Strategy + monthly extra */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>กลยุทธ์การชำระหนี้</Label>
                  <Tabs value={strategy} onValueChange={(v) => setStrategy(v as DebtStrategy)}>
                    <TabsList className="w-full gap-1">
                      <TabsTrigger value="avalanche" className="flex-1">🏔 Avalanche</TabsTrigger>
                      <TabsTrigger value="snowball" className="flex-1">⛄ Snowball</TabsTrigger>
                      <TabsTrigger value="custom" className="flex-1">✏️ Custom</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <p className="text-xs text-muted-foreground">
                    {strategy === "avalanche" ? "ชำระหนี้ดอกเบี้ยสูงก่อน (ประหยัดดอกเบี้ยสูงสุด)" : strategy === "snowball" ? "ชำระยอดน้อยก่อน (เห็นผลเร็ว)" : "กำหนดลำดับเอง"}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>เงินเพิ่มที่จะโปะ/เดือน (฿)</Label>
                  <Input type="number" value={extra || ""} onChange={(e) => setExtra(parseFloat(e.target.value) || 0)} placeholder="0" />
                  <p className="text-xs text-muted-foreground">เพิ่มเงินโปะหนี้เพื่อลดระยะเวลา</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-dashed" />

              {/* Lump sum prepayment */}
              <div className="space-y-3">
                <p className="text-sm font-medium">คำนวณผลของการโป๊ะก้อน</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>เงินก้อนที่จะโป๊ะ (฿)</Label>
                    <Input
                      type="number"
                      value={lumpSum || ""}
                      onChange={(e) => setLumpSum(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                    {bonusAnnual > 0 && (
                      <div className="flex gap-1.5 flex-wrap pt-0.5">
                        {[0.25, 0.5, 1].map((frac) => (
                          <button
                            key={frac}
                            onClick={() => setLumpSum(Math.round(bonusAnnual * frac))}
                            className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
                          >
                            {frac === 1 ? "โบนัสทั้งหมด" : `โบนัส ${frac * 100}%`} ({formatCurrency(bonusAnnual * frac)})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>โป๊ะหนี้ไหน</Label>
                    <select
                      value={lumpSumDebtId}
                      onChange={(e) => setLumpSumDebtId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="auto">อัตโนมัติ (ดอกเบี้ยสูงก่อน)</option>
                      {consumerDebts.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} — {d.interestRate}% ({formatCurrency(d.balance)})</option>
                      ))}
                    </select>
                    {lumpSumDebtId === "auto" && bestDebt && (
                      <p className="text-xs text-muted-foreground">แนะนำ: โป๊ะ "{bestDebt.name}" ก่อน (ดบ. {bestDebt.interestRate}%)</p>
                    )}
                  </div>
                </div>

                {lumpSum > 0 && lumpSumResult !== null && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">หนี้หมดเร็วขึ้น</p>
                      <p className="text-lg font-bold text-teal-600 tabular-nums">{savedMonths} เดือน</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">ประหยัดดอกเบี้ย</p>
                      <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(savedInterest)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">หนี้หมดใหม่</p>
                      <p className="text-lg font-bold text-blue-600 tabular-nums">{lumpSumResult.monthsToPayoff} เดือน</p>
                      <p className="text-xs text-muted-foreground">(เดิม {result.monthsToPayoff})</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <SummaryCard label="หนี้ผู้บริโภครวม" value={formatCurrency(consumerDebts.reduce((s, l) => s + l.balance, 0))} valueClass="text-red-500" />
            <SummaryCard label="ดอกเบี้ยทั้งหมด" value={formatCurrency(result.totalInterest)} valueClass="text-orange-600" />
            <SummaryCard label="หนี้หมดเมื่อ" value={payoffDate} sub={`${result.monthsToPayoff} เดือน`} valueClass="text-blue-600" />
          </div>

          {chartData.length > 0 && (
            <Card className="mb-4">
              <CardHeader className="py-4"><CardTitle className="text-base">ยอดหนี้คงเหลือตามเวลา</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={Math.floor(maxMonth / 6)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                    <Legend />
                    {result.debtOrder.map((debt, i) => (
                      <Line key={debt.id} type="monotone" dataKey={debt.name} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="py-4"><CardTitle className="text-base">รายการหนี้ (เรียงตามกลยุทธ์)</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead className="text-right">ยอดคงเหลือ</TableHead>
                    <TableHead className="text-right">ดอกเบี้ย</TableHead>
                    <TableHead className="text-right">ขั้นต่ำ/เดือน</TableHead>
                    <TableHead className="text-right">หนี้หมดใน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.debtOrder.map((debt, di) => (
                    <TableRow key={debt.id}>
                      <TableCell className="font-medium">{debt.name}</TableCell>
                      <TableCell className="text-right font-mono text-red-500">{formatCurrency(debt.balance)}</TableCell>
                      <TableCell className="text-right"><Badge variant="secondary">{debt.interestRate}%</Badge></TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(debt.minimumPayment)}</TableCell>
                      <TableCell className="text-right font-medium text-blue-600">{result.payoffMonths[di] ?? 0} เดือน</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

    </div>
  )
}
