import { useState } from "react"
import { useBudget, budgetAvgMonthly, budgetMonthTotal, budgetAnnualTotal, budgetBonusAnnual, type BudgetCategory } from "@/store"
import { formatCurrency } from "@/lib/format"
import { PageHeader } from "@/components/PageHeader"
import { SummaryCard } from "@/components/SummaryCard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, Paperclip, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { aiScanStatement } from "@/lib/ai"
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
import categories from "@/config/categories.json"
const CATS = categories.budgetCategories

export default function BudgetPage() {
  const { entries, add, updateAmount, remove } = useBudget()
  const [tab, setTab] = useState<BudgetCategory>("income")
  const [newName, setNewName] = useState("")
  const [scanLoading, setScanLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<number | "all">(new Date().getMonth())

  async function addEntry() {
    const trimmed = newName.trim()
    if (!trimmed) { toast.warning("กรุณาพิมพ์ชื่อรายการก่อน"); return }
    try {
      await add({ category: tab, name: trimmed, amounts: Array(12).fill(0) })
      setNewName("")
      toast.success("เพิ่มรายการสำเร็จ")
    } catch (err) {
      console.error("add budget error", err)
      toast.error("เกิดข้อผิดพลาด: " + String(err))
    }
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setScanLoading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1]
      const results = await aiScanStatement(base64, file.type)
      if (results && results.length > 0) {
        for (const r of results) {
          await add({ category: r.category, name: r.name, amounts: r.amounts.length === 12 ? r.amounts : Array(12).fill(r.amounts[0] ?? 0) })
        }
        toast.success(`AI เพิ่ม ${results.length} รายการจาก ${file.name}`)
      } else {
        toast.error("ไม่สามารถอ่านเอกสารได้ กรุณาลองใหม่")
      }
      setScanLoading(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const activeEntries = entries.filter((e) => e.category === tab)
  const rowTotal = (amounts: number[]) => amounts.reduce((a, b) => a + b, 0)

  const chartData = MONTHS.map((m, i) => ({
    name: m,
    รายรับ: budgetMonthTotal(entries, i, "income"),
    โบนัส: budgetMonthTotal(entries, i, "bonus"),
    ออม: budgetMonthTotal(entries, i, "saving"),
    รายจ่ายคงที่: budgetMonthTotal(entries, i, "fixed_expense"),
    รายจ่ายผันแปร: budgetMonthTotal(entries, i, "variable_expense"),
  }))

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader title="งบรายรับ-รายจ่าย" description="วางแผนรายรับและรายจ่ายรายเดือน" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {CATS.map((c) => (
          <SummaryCard
            key={c.value}
            label={c.label}
            value={formatCurrency(budgetAnnualTotal(entries, c.value as BudgetCategory))}
            sub={c.value === "bonus" ? `รวม/ปี` : `เฉลี่ย ${formatCurrency(budgetAvgMonthly(entries, c.value as BudgetCategory))}/เดือน`}
            valueClass={c.color}
          />
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader className="py-4"><CardTitle className="text-base">ภาพรวมรายเดือน</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="รายรับ" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="โบนัส" fill="#14b8a6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="ออม" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="รายจ่ายคงที่" fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="รายจ่ายผันแปร" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 space-y-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as BudgetCategory)}>
            <TabsList className="w-full h-9 gap-1">
              {CATS.map((c) => <TabsTrigger key={c.value} value={c.value} className="flex-1 text-xs px-1">{c.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <div className="flex gap-2 items-center">
            <label className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-input bg-background text-xs font-medium cursor-pointer hover:bg-muted hover:text-foreground transition-colors flex-shrink-0 ${scanLoading ? "opacity-50 pointer-events-none" : ""}`}>
              {scanLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{scanLoading ? "กำลังอ่าน..." : "แนบ Slip"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleScan} disabled={scanLoading} />
            </label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ชื่อรายการ..." className="flex-1 min-w-0" onKeyDown={(e) => e.key === "Enter" && addEntry()} />
            <Button onClick={addEntry} size="icon" className="flex-shrink-0"><Plus className="w-4 h-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Month selector — mobile only */}
          <div className="flex md:hidden gap-1 overflow-x-auto pb-2 mb-2 scrollbar-none">
            <button
              onClick={() => setSelectedMonth("all")}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedMonth === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              ทุกเดือน
            </button>
            {MONTHS.map((m, i) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(i)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedMonth === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {m}
              </button>
            ))}
          </div>

          {activeEntries.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีรายการ — เพิ่มเองหรือแนบ Slip ให้ AI กรอกให้</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground sticky left-0 bg-card min-w-28">รายการ</th>
                  <th className={`${selectedMonth === "all" ? "table-cell" : "hidden"} md:table-cell text-right py-2 px-1.5 font-medium text-primary min-w-24`}>ทุกเดือน</th>
                  {MONTHS.map((m, i) => (
                    <th key={m} className={`${selectedMonth === i ? "table-cell" : "hidden"} md:table-cell text-right py-2 px-1.5 font-medium min-w-20 ${selectedMonth === i ? "text-primary md:text-muted-foreground" : "text-muted-foreground"}`}>{m}</th>
                  ))}
                  <th className="text-right py-2 px-1.5 font-medium text-muted-foreground min-w-20">รวม/ปี</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {activeEntries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-1.5 pr-3 font-medium sticky left-0 bg-card text-xs">{entry.name}</td>
                    <td className={`${selectedMonth === "all" ? "table-cell" : "hidden"} md:table-cell py-1 px-1`}>
                      <Input
                        type="number"
                        placeholder="fill ทุกเดือน"
                        className="w-24 text-right text-xs px-2 border-primary/40 focus:border-primary"
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0
                          for (let i = 0; i < 12; i++) updateAmount(entry.id, i, v)
                        }}
                      />
                    </td>
                    {entry.amounts.map((amt, mi) => (
                      <td key={mi} className={`${selectedMonth === mi ? "table-cell" : "hidden"} md:table-cell py-1 px-1`}>
                        <Input value={amt || ""} type="number" className="w-20 text-right text-xs px-2" onChange={(e) => updateAmount(entry.id, mi, parseFloat(e.target.value) || 0)} />
                      </td>
                    ))}
                    <td className="py-1.5 text-right font-mono font-medium text-xs">{formatCurrency(rowTotal(entry.amounts))}</td>
                    <td className="py-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { remove(entry.id); toast.success("ลบรายการแล้ว") }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t-2">
                  <td className="py-2 sticky left-0 bg-card text-xs">รวม</td>
                  <td className={`${selectedMonth === "all" ? "table-cell" : "hidden"} md:table-cell`} />
                  {MONTHS.map((m, i) => (
                    <td key={m} className={`${selectedMonth === i ? "table-cell" : "hidden"} md:table-cell py-2 text-right font-mono px-1.5 text-xs`}>{formatCurrency(budgetMonthTotal(entries, i, tab))}</td>
                  ))}
                  <td className="py-2 text-right font-mono text-xs">{formatCurrency(budgetAnnualTotal(entries, tab))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
