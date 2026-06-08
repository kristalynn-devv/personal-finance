import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Props {
  label: string
  value: string
  sub?: string
  valueClass?: string
}

export function SummaryCard({ label, value, sub, valueClass }: Props) {
  return (
    <Card className="shadow-sm border-border/60">
      <CardContent className="px-4 py-3.5">
        <p className="text-xs text-muted-foreground mb-1 font-medium truncate">{label}</p>
        <p className={cn("text-[22px] font-bold tabular-nums leading-tight", valueClass)}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}
