import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { MarkdownText } from "@/components/MarkdownText"

export function AnalysisContent({ icon: Icon, content, onRefresh, loading }: { icon: any; content: string | null; onRefresh: () => void; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm">AI กำลังวิเคราะห์ข้อมูลการเงินของคุณ...</span>
      </div>
    )
  }

  if (!content) {
    return (
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
    )
  }

  return <MarkdownText text={content} />
}
