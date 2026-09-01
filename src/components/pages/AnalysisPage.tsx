import { useState } from "react"
import { useAssets, useLiabilities, useBudget, useProfile, useRetirement } from "@/store"
import { generateFullAnalysis, generateInvestmentPlan } from "@/lib/ai"
import { buildFinancialContext } from "@/lib/ai"
import { formatCurrency } from "@/lib/format"
import { PageHeader } from "@/components/PageHeader"
import { SummaryCard } from "@/components/SummaryCard"
import { AnalysisContent } from "@/components/AnalysisContent"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Loader2, RefreshCw, TrendingUp, BarChart3 } from "lucide-react"

export default function AnalysisPage() {
  const { items: assets } = useAssets()
  const { items: liabilities } = useLiabilities()
  const { entries } = useBudget()
  const profile = useProfile()
  const retirement = useRetirement()

  const [activeTab, setActiveTab] = useState<"full" | "invest">("full")
  const [fullAnalysis, setFullAnalysis] = useState<string | null>(null)
  const [investmentPlan, setInvestmentPlan] = useState<string | null>(null)
  const [loadingFull, setLoadingFull] = useState(false)
  const [loadingInvest, setLoadingInvest] = useState(false)

  const d = buildFinancialContext(assets, liabilities, entries, profile, retirement)

  const hasData = assets.length > 0 || liabilities.length > 0 || entries.length > 0

  async function runAnalysis(fn: typeof generateFullAnalysis, setContent: (s: string) => void, setLoading: (b: boolean) => void) {
    setLoading(true)
    try {
      const result = await fn(assets, liabilities, entries, profile, retirement)
      setContent(result)
    } catch {
      setContent("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่ครับ")
    } finally {
      setLoading(false)
    }
  }

  const runFullAnalysis = () => runAnalysis(generateFullAnalysis, setFullAnalysis, setLoadingFull)
  const runInvestmentPlan = () => runAnalysis(generateInvestmentPlan, setInvestmentPlan, setLoadingInvest)

  const activeContent = activeTab === "full" ? fullAnalysis : investmentPlan
  const activeLoading = activeTab === "full" ? loadingFull : loadingInvest
  const activeRefresh = activeTab === "full" ? runFullAnalysis : runInvestmentPlan

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader title="AI วิเคราะห์การเงินเชิงลึก" description="วิเคราะห์เชิงลึกและแผนการลงทุน" />

      {!hasData && (
        <Card className="mb-6">
          <CardContent className="py-12 text-center">
            <p className="text-3xl mb-3">📊</p>
            <p className="font-medium mb-2">ยังไม่มีข้อมูลการเงิน</p>
            <p className="text-sm text-muted-foreground mb-4">กรอกข้อมูลสินทรัพย์ หนี้สิน และรายรับ-รายจ่ายก่อน AI ถึงจะวิเคราะห์ได้ครับ</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <a href="/balance-sheet"><Button variant="outline">เพิ่มสินทรัพย์-หนี้</Button></a>
              <a href="/budget"><Button variant="outline">เพิ่มรายรับ-รายจ่าย</Button></a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snapshot cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Net Worth" value={formatCurrency(d.netWorth)} valueClass={d.netWorth >= 0 ? "text-emerald-600" : "text-red-500"} />
        <SummaryCard label="สุขภาพการเงิน" value={`${d.health.score}/100`} valueClass={d.health.score >= 75 ? "text-emerald-600" : d.health.score >= 50 ? "text-amber-600" : "text-red-500"} />
        <SummaryCard label="Cash Flow/เดือน" value={formatCurrency(d.cashFlow)} valueClass={d.cashFlow >= 0 ? "text-blue-600" : "text-red-500"} />
        <SummaryCard label="อัตราออม" value={`${d.savingsRatePct.toFixed(1)}%`} valueClass={d.savingsRatePct >= 20 ? "text-emerald-600" : d.savingsRatePct >= 10 ? "text-amber-600" : "text-red-500"} />
      </div>

      <Card className="shadow-sm border-border/60">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "full" | "invest")} className="gap-0">
          <CardHeader className="py-4 flex items-center justify-between flex-wrap gap-2 space-y-0">
            <TabsList className="w-full md:w-fit h-9 gap-1">
              <TabsTrigger value="full" className="flex-none gap-1.5 px-3 text-sm">
                <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>วิเคราะห์ครบถ้วน</span>
              </TabsTrigger>
              <TabsTrigger value="invest" className="flex-none gap-1.5 px-3 text-sm">
                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                <span>แผนการลงทุน</span>
              </TabsTrigger>
            </TabsList>
            {activeContent && (
              <Button variant="outline" size="sm" onClick={activeRefresh} disabled={activeLoading} className="flex-shrink-0 ml-auto">
                {activeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                <span className="hidden sm:inline">{activeLoading ? "กำลังวิเคราะห์..." : "วิเคราะห์ใหม่"}</span>
              </Button>
            )}
          </CardHeader>

          <CardContent className="pt-0">
            <TabsContent value="full">
              <AnalysisContent icon={BarChart3} content={fullAnalysis} onRefresh={runFullAnalysis} loading={loadingFull} />
            </TabsContent>
            <TabsContent value="invest">
              <AnalysisContent icon={TrendingUp} content={investmentPlan} onRefresh={runInvestmentPlan} loading={loadingInvest} />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
