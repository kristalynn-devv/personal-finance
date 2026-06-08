import { useState } from "react"
import { useBudget, budgetAvgMonthly } from "@/store"
import { calcTaxPayable } from "@/lib/calculations"
import { formatCurrency, formatPercent } from "@/lib/format"
import { PageHeader } from "@/components/PageHeader"
import { SummaryCard } from "@/components/SummaryCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Paperclip, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { aiScanTaxDoc, aiSuggestDeductions } from "@/lib/ai"

const BRACKETS = [
  { min: 0, max: 150000, rate: 0 },
  { min: 150001, max: 300000, rate: 5 },
  { min: 300001, max: 500000, rate: 10 },
  { min: 500001, max: 750000, rate: 15 },
  { min: 750001, max: 1000000, rate: 20 },
  { min: 1000001, max: 2000000, rate: 25 },
  { min: 2000001, max: 5000000, rate: 30 },
  { min: 5000001, max: Infinity, rate: 35 },
]

function bracketTax(taxableIncome: number, bracket: typeof BRACKETS[0]): number {
  if (taxableIncome <= bracket.min) return 0
  const taxable = Math.min(taxableIncome, bracket.max === Infinity ? taxableIncome : bracket.max) - bracket.min
  return Math.max(0, taxable) * bracket.rate / 100
}

export default function TaxPage() {
  const { entries } = useBudget()
  const defaultSalary = Math.round(budgetAvgMonthly(entries, "income") * 12)

  const [income, setIncome] = useState({ salary: defaultSalary, business: 0, dividend: 0, rental: 0 })
  const [ded, setDed] = useState({
    lifeInsurance: 0, healthInsurance: 0, pvd: 0, ssf: 0, rmf: 0, thaiEsg: 0, donation: 0, socialSecurity: 0, spouseAllowance: 0, children: 0, parents: 0, homeLoanInterest: 0,
  })
  const [whatIfRmf, setWhatIfRmf] = useState(0)
  const [scanLoading, setScanLoading] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)

  const totalIncome = income.salary + income.business + income.dividend + income.rental
  const expenseDeduction = Math.min(income.salary * 0.5, 100000)
  const totalDeductions = expenseDeduction + 60000 + ded.spouseAllowance + ded.children + ded.parents +
    ded.lifeInsurance + ded.healthInsurance + ded.pvd + ded.ssf + ded.rmf + ded.thaiEsg + ded.donation + ded.socialSecurity + Math.min(ded.homeLoanInterest, 100000)
  const taxableIncome = Math.max(0, totalIncome - totalDeductions)
  const taxPayable = calcTaxPayable(taxableIncome)
  const effectiveRate = totalIncome > 0 ? (taxPayable / totalIncome) * 100 : 0
  const withRmf = Math.max(0, taxableIncome - whatIfRmf)
  const taxWithRmf = calcTaxPayable(withRmf)
  const taxSaved = taxPayable - taxWithRmf

  const n = (key: keyof typeof ded) => (v: string) => setDed((d) => ({ ...d, [key]: parseFloat(v) || 0 }))

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setScanLoading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1]
      const result = await aiScanTaxDoc(base64, file.type)
      if (result) {
        if (result.salary) setIncome(i => ({ ...i, salary: result.salary }))
        if (result.business) setIncome(i => ({ ...i, business: result.business }))
        if (result.dividend) setIncome(i => ({ ...i, dividend: result.dividend }))
        if (result.rental) setIncome(i => ({ ...i, rental: result.rental }))
        setDed(d => ({
          ...d,
          lifeInsurance: result.lifeInsurance || d.lifeInsurance,
          healthInsurance: result.healthInsurance || d.healthInsurance,
          socialSecurity: result.socialSecurity || d.socialSecurity,
          pvd: result.pvd || d.pvd,
          rmf: result.rmf || d.rmf,
          ssf: result.ssf || d.ssf,
          donation: result.donation || d.donation,
        }))
        toast.success("กรอกข้อมูลจากเอกสารแล้ว ตรวจสอบและแก้ไขได้")
      } else { toast.error("ไม่สามารถอ่านเอกสารได้ กรุณาลองใหม่") }
      setScanLoading(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  async function handleSuggest() {
    setSuggestLoading(true); setSuggestion(null)
    const result = await aiSuggestDeductions(totalIncome, ded)
    setSuggestion(result)
    setSuggestLoading(false)
    toast.success("AI แนะนำค่าลดหย่อนเรียบร้อยแล้ว")
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader title="วางแผนภาษี" description="คำนวณภาษีเงินได้บุคคลธรรมดาและวางแผนลดหย่อน" />

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="py-4 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">รายได้</CardTitle>
            <label className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-input bg-background text-sm font-medium cursor-pointer hover:bg-muted transition-colors ${scanLoading ? "opacity-50 pointer-events-none" : ""}`}>
              {scanLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
              {scanLoading ? "กำลังอ่าน..." : "แนบเอกสาร"}
              <input type="file" accept="image/*" className="hidden" onChange={handleScan} disabled={scanLoading} />
            </label>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {[
              { label: "เงินเดือน/ค่าจ้าง (฿/ปี)", key: "salary" },
              { label: "รายได้จากธุรกิจ (฿)", key: "business" },
              { label: "เงินปันผล (฿)", key: "dividend" },
              { label: "ค่าเช่า (฿)", key: "rental" },
            ].map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input type="number" value={(income as any)[f.key] || ""} onChange={(e) => setIncome((i) => ({ ...i, [f.key]: parseFloat(e.target.value) || 0 }))} placeholder="0" />
              </div>
            ))}
            <div className="text-xs text-muted-foreground pt-2 space-y-1 border-t">
              <div className="flex justify-between"><span>ค่าใช้จ่าย 50% (สูงสุด 100,000)</span><span className="font-medium">{formatCurrency(expenseDeduction)}</span></div>
              <div className="flex justify-between"><span>ลดหย่อนส่วนตัว</span><span className="font-medium">{formatCurrency(60000)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">ค่าลดหย่อน</CardTitle>
            <Button variant="outline" onClick={handleSuggest} disabled={suggestLoading || totalIncome === 0}>
              {suggestLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              AI แนะนำ
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                { label: "คู่สมรส", key: "spouseAllowance" },
                { label: "บุตร", key: "children" },
                { label: "บิดามารดา", key: "parents" },
                { label: "ประกันชีวิต", key: "lifeInsurance" },
                { label: "ประกันสุขภาพ", key: "healthInsurance" },
                { label: "ประกันสังคม", key: "socialSecurity" },
                { label: "PVD", key: "pvd" },
                { label: "SSF", key: "ssf" },
                { label: "RMF", key: "rmf" },
                { label: "Thai ESG", key: "thaiEsg" },
                { label: "ดอกเบี้ยบ้าน (สูงสุด 100,000)", key: "homeLoanInterest" },
                { label: "เงินบริจาค", key: "donation" },
              ].map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Input type="number" value={(ded as any)[f.key] || ""} onChange={(e) => n(f.key as keyof typeof ded)(e.target.value)} placeholder="0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {suggestion && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardHeader className="py-3 flex-row items-center gap-2 space-y-0">
            <Sparkles className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm text-primary">AI แนะนำค่าลดหย่อนเพิ่มเติม</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{suggestion}</div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <SummaryCard label="รายได้รวม" value={formatCurrency(totalIncome)} />
        <SummaryCard label="ลดหย่อนรวม" value={formatCurrency(totalDeductions)} valueClass="text-blue-600" />
        <SummaryCard label="เงินได้สุทธิ" value={formatCurrency(taxableIncome)} />
        <SummaryCard label="ภาษีที่ต้องชำระ" value={formatCurrency(taxPayable)} sub={`อัตราจริง ${formatPercent(effectiveRate)}`} valueClass="text-red-500" />
      </div>

      <Card className="mb-4">
        <CardHeader className="py-4"><CardTitle className="text-base">รายละเอียดลดหย่อน</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1.5 text-sm">
            {[
              { label: "ค่าใช้จ่าย 50% (สูงสุด 100,000)", value: expenseDeduction },
              { label: "ลดหย่อนส่วนตัว", value: 60000 },
              { label: "คู่สมรส", value: ded.spouseAllowance },
              { label: "บุตร", value: ded.children },
              { label: "บิดามารดา", value: ded.parents },
              { label: "ประกันชีวิต", value: ded.lifeInsurance },
              { label: "ประกันสุขภาพ", value: ded.healthInsurance },
              { label: "ประกันสังคม", value: ded.socialSecurity },
              { label: "PVD", value: ded.pvd },
              { label: "SSF", value: ded.ssf },
              { label: "RMF", value: ded.rmf },
              { label: "Thai ESG", value: ded.thaiEsg },
              { label: "ดอกเบี้ยบ้าน", value: Math.min(ded.homeLoanInterest, 100000) },
              { label: "เงินบริจาค", value: ded.donation },
            ].filter((r) => r.value > 0).map((r) => (
              <div key={r.label} className="flex justify-between">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium tabular-nums">{formatCurrency(r.value)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>รวมทั้งหมด</span>
              <span className="text-blue-600 tabular-nums">{formatCurrency(totalDeductions)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="py-4"><CardTitle className="text-base">อัตราภาษีแบบขั้นบันได (2567)</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ช่วงเงินได้สุทธิ</TableHead>
                <TableHead className="text-right">อัตรา</TableHead>
                <TableHead className="text-right">ภาษีในช่วงนี้</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BRACKETS.map((b) => {
                const tax = bracketTax(taxableIncome, b)
                const active = taxableIncome > b.min
                return (
                  <TableRow key={b.min} className={!active ? "opacity-40" : ""}>
                    <TableCell className="text-xs">{formatCurrency(b.min)} – {b.max === Infinity ? "ขึ้นไป" : formatCurrency(b.max)}</TableCell>
                    <TableCell className="text-right"><Badge variant={b.rate === 0 ? "secondary" : "outline"}>{b.rate}%</Badge></TableCell>
                    <TableCell className={`text-right font-mono font-medium ${tax > 0 ? "text-red-500" : "text-muted-foreground"}`}>{formatCurrency(tax)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4"><CardTitle className="text-base">What-if: ซื้อ RMF เพิ่ม ประหยัดภาษีได้เท่าไหร่?</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-4 items-center">
            <div className="space-y-1.5 flex-1">
              <Label>ซื้อ RMF เพิ่ม (฿)</Label>
              <Input type="number" value={whatIfRmf || ""} onChange={(e) => setWhatIfRmf(parseFloat(e.target.value) || 0)} placeholder="0" />
            </div>
            <div className="text-right min-w-36 pt-5">
              <p className="text-xs text-muted-foreground mb-0.5">ประหยัดภาษีได้</p>
              <p className="text-2xl font-bold text-emerald-600 tabular-nums">{formatCurrency(taxSaved)}</p>
              {taxSaved > 0 && <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(taxPayable)} → {formatCurrency(taxWithRmf)}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
