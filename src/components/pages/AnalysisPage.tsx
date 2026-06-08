import { useState } from "react"
import { useAssets, useLiabilities, useBudget, useProfile, useRetirement } from "@/store"
import { generateFullAnalysis, generateInvestmentPlan } from "@/lib/ai"
import { buildFinancialContext } from "@/lib/ai"
import { formatCurrency } from "@/lib/format"
import { PageHeader } from "@/components/PageHeader"
import { SummaryCard } from "@/components/SummaryCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Loader2, RefreshCw, TrendingUp, BarChart3 } from "lucide-react"

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />
        if (line.startsWith("##")) return <h3 key={i} className="font-semibold text-base mt-3">{line.replace(/^#+\s*/, "")}</h3>
        if (line.startsWith("#")) return <h2 key={i} className="font-bold text-lg mt-4">{line.replace(/^#+\s*/, "")}</h2>
        if (line.match(/^\d+\./)) return <p key={i} className="font-medium mt-2">{line}</p>
        if (line.startsWith("- ") || line.startsWith("• ")) return <p key={i} className="pl-3 text-muted-foreground">{line}</p>
        if (line.match(/^[📊💡⚠️✅🏖️🧾📈🎯🏦💰🔄⚡👤💳]/)) return <p key={i} className="font-medium mt-3">{line}</p>
        return <p key={i} className="text-muted-foreground">{line}</p>
      })}
    </div>
  )
}

function AnalysisCard({ title, icon: Icon, content, onRefresh, loading }: { title: string; icon: any; content: string | null; onRefresh: () => void; loading: boolean }) {
  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader className="py-4 flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {content && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {loading ? "กำลังวิเคราะห์..." : "วิเคราะห์ใหม่"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {loading && (
          <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm">AI กำลังวิเคราะห์ข้อมูลการเงินของคุณ...</span>
          </div>
        )}
        {!loading && !content && (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium mb-1">พร้อมวิเคราะห์</p>
            <p className="text-muted-foreground text-sm mb-5">AI จะวิเคราะห์ข้อมูลการเงินของคุณแบบเชิงลึก</p>
            <Button onClick={onRefresh}>
              <Icon className="w-4 h-4" />
              เริ่มวิเคราะห์
            </Button>
          </div>
        )}
        {!loading && content && <MarkdownText text={content} />}
      </CardContent>
    </Card>
  )
}

export default function AnalysisPage() {
  const { items: assets } = useAssets()
  const { items: liabilities } = useLiabilities()
  const { entries } = useBudget()
  const profile = useProfile()
  const retirement = useRetirement()

  const [fullAnalysis, setFullAnalysis] = useState<string | null>(null)
  const [investmentPlan, setInvestmentPlan] = useState<string | null>(null)
  const [loadingFull, setLoadingFull] = useState(false)
  const [loadingInvest, setLoadingInvest] = useState(false)

  const d = buildFinancialContext(assets, liabilities, entries, profile, retirement)

  const hasData = assets.length > 0 || liabilities.length > 0 || entries.length > 0

  async function runFullAnalysis() {
    setLoadingFull(true)
    try {
      const result = await generateFullAnalysis(assets, liabilities, entries, profile, retirement)
      setFullAnalysis(result)
    } catch {
      setFullAnalysis("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่ครับ")
    } finally {
      setLoadingFull(false)
    }
  }

  async function runInvestmentPlan() {
    setLoadingInvest(true)
    try {
      const result = await generateInvestmentPlan(assets, liabilities, entries, profile, retirement)
      setInvestmentPlan(result)
    } catch {
      setInvestmentPlan("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่ครับ")
    } finally {
      setLoadingInvest(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader title="AI วิเคราะห์การเงินเชิงลึก" description="วิเคราะห์เชิงลึกและแผนการลงทุน" />

      {!hasData && (
        <Card className="mb-6">
          <CardContent className="py-12 text-center">
            <p className="text-3xl mb-3">📊</p>
            <p className="font-medium mb-2">ยังไม่มีข้อมูลการเงิน</p>
            <p className="text-sm text-muted-foreground mb-4">กรอกข้อมูลสินทรัพย์ หนี้สิน และรายรับ-รายจ่ายก่อน AI ถึงจะวิเคราะห์ได้ครับ</p>
            <div className="flex gap-2 justify-center">
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

      <Tabs defaultValue="full">
        <TabsList className="w-fit mb-4 h-9 gap-1">
          <TabsTrigger value="full" className="gap-1.5 px-3 text-sm">
            <BarChart3 className="w-3.5 h-3.5" />
            วิเคราะห์ครบถ้วน
          </TabsTrigger>
          <TabsTrigger value="invest" className="gap-1.5 px-3 text-sm">
            <TrendingUp className="w-3.5 h-3.5" />
            แผนการลงทุน
          </TabsTrigger>
        </TabsList>

        <TabsContent value="full">
          <AnalysisCard
            title="วิเคราะห์การเงินครบถ้วน"
            icon={BarChart3}
            content={fullAnalysis}
            onRefresh={runFullAnalysis}
            loading={loadingFull}
          />
        </TabsContent>

        <TabsContent value="invest">
          <AnalysisCard
            title="แผนการลงทุนส่วนบุคคล"
            icon={TrendingUp}
            content={investmentPlan}
            onRefresh={runInvestmentPlan}
            loading={loadingInvest}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
