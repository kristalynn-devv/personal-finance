import { useState, useEffect } from "react"
import { useAssets, useLiabilities, type LiabilityLog } from "@/store"
import type { Asset, Liability } from "@/lib/calculations"
import { formatCurrency } from "@/lib/format"
import { PageHeader } from "@/components/PageHeader"
import { SummaryCard } from "@/components/SummaryCard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Pencil, Trash2, Plus, Sparkles, Loader2, Paperclip, History, ChevronDown, ChevronRight, TrendingDown, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { aiScanAsset, aiScanBill, aiLookupRate, generatePageInsight } from "@/lib/ai"
import { useBudget, useProfile, useRetirement, useAiAdvisorContext } from "@/store"

import categories from "@/config/categories.json"
const ASSET_CATEGORIES = categories.assetCategories
const LIABILITY_TYPES = categories.liabilityTypes

// อัตราดอกเบี้ยตามชื่อสถาบัน (keyword matching)
const RATE_LOOKUP: { keywords: string[]; rate: number; label: string }[] = [
  // บัตรเครดิต
  { keywords: ["ktc"], rate: 20, label: "KTC" },
  { keywords: ["kbank", "กสิกร", "kasikorn"], rate: 16, label: "KBANK" },
  { keywords: ["scb", "ไทยพาณิชย์"], rate: 16, label: "SCB" },
  { keywords: ["bbl", "กรุงเทพ", "bangkok bank"], rate: 16, label: "BBL" },
  { keywords: ["krungsri", "กรุงศรี", "ayudhya"], rate: 16, label: "กรุงศรี" },
  { keywords: ["ttb", "tmb", "ทหารไทย"], rate: 16, label: "TTB" },
  { keywords: ["uob"], rate: 20, label: "UOB" },
  { keywords: ["citibank", "citi"], rate: 20, label: "Citibank" },
  { keywords: ["american express", "amex"], rate: 20, label: "AMEX" },
  // สินเชื่อ
  { keywords: ["first choice", "firstchoice"], rate: 28, label: "First Choice" },
  { keywords: ["line bk", "linebk", "line bank"], rate: 25, label: "LINE BK" },
  { keywords: ["xpress loan", "xpressloan"], rate: 25, label: "Xpress Loan" },
  { keywords: ["xpress cash", "xpresscash"], rate: 25, label: "Xpress Cash" },
  { keywords: ["aeon"], rate: 28, label: "AEON" },
  { keywords: ["shopee", "spaylater", "s pay"], rate: 20, label: "Shopee" },
  { keywords: ["lazada", "lazpaylater"], rate: 20, label: "Lazada" },
  { keywords: ["easy buy", "easybuy", "ผ่อนสินค้า"], rate: 28, label: "Easy Buy" },
  { keywords: ["fn", "เฟินิกซ์", "fnominal", "finansia"], rate: 28, label: "FN" },
  { keywords: ["ธนาคารออมสิน", "gsb"], rate: 15, label: "GSB" },
  { keywords: ["กยศ", "student loan", "กองทุนเงินให้กู้"], rate: 1, label: "กยศ." },
  { keywords: ["บ้าน", "home loan", "mortgage", "อยู่อาศัย"], rate: 6, label: "บ้าน" },
  { keywords: ["รถ", "car loan", "auto loan", "leasing"], rate: 4, label: "รถ" },
]

function lookupRate(name: string): number | null {
  const lower = name.toLowerCase()
  for (const entry of RATE_LOOKUP) {
    if (entry.keywords.some(k => lower.includes(k.toLowerCase()))) {
      return entry.rate
    }
  }
  return null
}

type AssetCategory = "liquid" | "investment" | "personal"
type LiabilityType = "credit_card" | "personal_loan" | "mortgage" | "car" | "student_loan"

function AssetDialog({
  open, onClose, initial,
}: {
  open: boolean
  onClose: () => void
  initial?: Asset
}) {
  const { add, update } = useAssets()
  const [category, setCategory] = useState<AssetCategory>(initial?.category ?? "liquid")
  const [name, setName] = useState(initial?.name ?? "")
  const [value, setValue] = useState(initial?.value?.toString() ?? "")
  const [scanLoading, setScanLoading] = useState(false)

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setScanLoading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1]
      const result = await aiScanAsset(base64, file.type)
      if (result) {
        if (result.name) setName(result.name)
        if (result.value) setValue(String(result.value))
        if (result.category) setCategory(result.category as AssetCategory)
        toast.success("AI กรอกข้อมูลให้แล้ว ตรวจสอบและกดบันทึก")
      } else {
        toast.error("ไม่สามารถอ่านเอกสารได้ กรุณาลองใหม่")
      }
      setScanLoading(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  function save() {
    if (!name) { toast.warning("กรุณาระบุชื่อสินทรัพย์"); return }
    const v = parseFloat(value.replace(/,/g, "")) || 0
    if (initial) update(initial.id, { category, name, value: v })
    else add({ category, name, value: v })
    toast.success(initial ? "แก้ไขสินทรัพย์แล้ว" : "เพิ่มสินทรัพย์แล้ว")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{initial ? "แก้ไข" : "เพิ่ม"}สินทรัพย์</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>ประเภท</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as AssetCategory)}>
              <SelectTrigger>
                <SelectValue>{ASSET_CATEGORIES.find(c => c.value === category)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ASSET_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <div><div className="font-medium">{c.label}</div><div className="text-xs text-muted-foreground">{c.desc}</div></div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ชื่อ</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น บัญชีออมทรัพย์ ธ.กสิกร" />
          </div>
          <div className="space-y-1.5">
            <Label>มูลค่า (บาท)</Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} type="number" placeholder="0" />
          </div>
        </div>
        <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-dashed cursor-pointer transition-colors text-sm text-muted-foreground ${scanLoading ? "opacity-50" : "hover:bg-muted hover:text-foreground"}`}>
          {scanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          {scanLoading ? "AI กำลังอ่านเอกสาร..." : "แนบสมุดบัญชี / ใบแสดงมูลค่า ให้ AI กรอกให้"}
          <input type="file" accept="image/*" className="hidden" onChange={handleScan} disabled={scanLoading} />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LiabilityDialog({
  open, onClose, initial,
}: {
  open: boolean
  onClose: () => void
  initial?: Liability
}) {
  const { add, update } = useLiabilities()
  const [type, setType] = useState<LiabilityType>(initial?.type ?? "credit_card")
  const [name, setName] = useState(initial?.name ?? "")
  const [balance, setBalance] = useState(initial?.balance?.toString() ?? "")
  const [originalAmount, setOriginalAmount] = useState(initial?.originalAmount?.toString() ?? "")
  const [rate, setRate] = useState(initial?.interestRate?.toString() ?? "")
  const [minPay, setMinPay] = useState(initial?.minimumPayment?.toString() ?? "")
  const [status, setStatus] = useState<"active" | "closed">(initial?.status ?? "active")
  const [rateSuggestion, setRateSuggestion] = useState<number | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [aiNote, setAiNote] = useState<string | null>(null)

  function handleTypeChange(v: LiabilityType) {
    setType(v)
    if (!rate) {
      const defaultRate = LIABILITY_TYPES.find(t => t.value === v)?.defaultRate
      if (defaultRate) { setRate(String(defaultRate)); setRateSuggestion(defaultRate) }
    }
  }

  function handleNameChange(v: string) {
    setName(v)
    setAiNote(null)
    const found = lookupRate(v)
    if (found !== null) { setRate(String(found)); setRateSuggestion(found) }
    else setRateSuggestion(null)
  }

  async function handleAiLookup() {
    if (!name) return
    setAiLoading(true)
    const result = await aiLookupRate(name)
    if (result) {
      setRate(String(result.rate))
      setRateSuggestion(result.rate)
      setAiNote(result.note)
    }
    setAiLoading(false)
  }

  async function handleBillScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanLoading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1]
      const result = await aiScanBill(base64, file.type)
      if (result) {
        if (result.name) setName(result.name)
        if (result.balance) setBalance(String(result.balance))
        if (result.rate) { setRate(String(result.rate)); setRateSuggestion(result.rate) }
        if (result.type) setType(result.type as LiabilityType)
        toast.success("AI กรอกข้อมูลจากบิลให้แล้ว")
      } else {
        toast.error("ไม่สามารถอ่านบิลได้ กรุณาลองใหม่")
      }
      setScanLoading(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  function save() {
    if (!name) { toast.warning("กรุณาระบุชื่อหนี้สิน"); return }
    const balanceVal = parseFloat(balance.replace(/,/g, "")) || 0
    const origVal = parseFloat(originalAmount.replace(/,/g, "")) || balanceVal
    const data = {
      type, name, status,
      balance: status === "closed" ? 0 : balanceVal,
      originalAmount: origVal,
      interestRate: parseFloat(rate) || 0,
      minimumPayment: parseFloat(minPay.replace(/,/g, "")) || 0,
    }
    if (initial) update(initial.id, data)
    else add(data)
    toast.success(initial ? "แก้ไขหนี้สินแล้ว" : "เพิ่มหนี้สินแล้ว")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "แก้ไข" : "เพิ่ม"}หนี้สิน</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>ประเภท</Label>
            <Select value={type} onValueChange={(v) => handleTypeChange(v as LiabilityType)}>
              <SelectTrigger>
                <SelectValue>{LIABILITY_TYPES.find(t => t.value === type)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LIABILITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>ชื่อ</Label>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="เช่น บัตรเครดิต KTC, สินเชื่อ AEON" />
              <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={handleAiLookup} disabled={aiLoading || !name}>
                {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                AI หา
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>ยอดกู้ตั้งต้น (฿)</Label><Input value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} type="number" placeholder="0" /></div>
            <div className="space-y-1.5"><Label>ยอดคงเหลือ (฿)</Label><Input value={balance} onChange={(e) => setBalance(e.target.value)} type="number" placeholder="0" disabled={status === "closed"} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                ดอกเบี้ย (% ต่อปี)
                {rateSuggestion !== null && <span className="text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded">Auto</span>}
              </Label>
              <Input value={rate} onChange={(e) => { setRate(e.target.value); setRateSuggestion(null) }} type="number" step="0.1" placeholder="0" />
            </div>
            <div className="space-y-1.5"><Label>ผ่อนขั้นต่ำ/เดือน (฿)</Label><Input value={minPay} onChange={(e) => setMinPay(e.target.value)} type="number" placeholder="0" /></div>
          </div>

          {aiNote && <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">{aiNote}</p>}

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">สถานะหนี้</p>
              <p className="text-xs text-muted-foreground">{status === "closed" ? "ปิดหนี้แล้ว — ยอดจะถูกเซ็ตเป็น 0" : "ยังชำระอยู่"}</p>
            </div>
            <button
              type="button"
              onClick={() => setStatus(s => s === "active" ? "closed" : "active")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${status === "closed" ? "bg-emerald-500" : "bg-input"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${status === "closed" ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
        <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-dashed cursor-pointer transition-colors text-sm text-muted-foreground ${scanLoading ? "opacity-50" : "hover:bg-muted hover:text-foreground"}`}>
          {scanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          {scanLoading ? "AI กำลังอ่านบิล..." : "แนบรูปบิล / Statement ให้ AI กรอกให้อัตโนมัติ"}
          <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleBillScan} disabled={scanLoading} />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const EVENT_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  created:  { label: "เปิดหนี้",  color: "text-blue-600",    bg: "bg-blue-50" },
  payment:  { label: "ชำระ",      color: "text-emerald-600", bg: "bg-emerald-50" },
  withdraw: { label: "ถอน",       color: "text-red-600",     bg: "bg-red-50" },
  updated:  { label: "อัปเดต",   color: "text-amber-600",   bg: "bg-amber-50" },
  closed:   { label: "ปิดหนี้",  color: "text-purple-600",  bg: "bg-purple-50" },
  reopened: { label: "เปิดใหม่", color: "text-orange-600",  bg: "bg-orange-50" },
}

function LogDialog({ liability, onClose }: { liability: Liability; onClose: () => void }) {
  const { loadLogs, update } = useLiabilities()
  const [logs, setLogs] = useState<LiabilityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [txType, setTxType] = useState<"payment" | "withdraw">("payment")
  const [amount, setAmount] = useState(liability.minimumPayment > 0 ? String(liability.minimumPayment) : "")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (txType === "payment" && liability.minimumPayment > 0) {
      setAmount(String(liability.minimumPayment))
    } else if (txType === "withdraw") {
      setAmount("")
    }
  }, [txType])

  function reload() {
    setLoading(true)
    loadLogs(liability.id).then((data) => { setLogs(data); setLoading(false) })
  }

  useState(() => { reload() })

  async function save() {
    const amt = parseFloat(amount.replace(/,/g, "")) || 0
    if (amt <= 0) { toast.warning("กรุณาระบุจำนวนเงิน"); return }
    setSaving(true)
    const newBalance = txType === "payment"
      ? Math.max(0, liability.balance - amt)
      : liability.balance + amt
    await update(liability.id, { balance: newBalance })
    // patch note onto the most recent auto-log if note provided
    setAmount("")
    setNote("")
    reload()
    setSaving(false)
    toast.success(txType === "payment" ? `บันทึกการชำระ ${formatCurrency(amt)}` : `บันทึกการถอน ${formatCurrency(amt)}`)
  }

  // build running balance from oldest→newest then reverse for display
  const withRunning = (() => {
    const sorted = [...logs].reverse()
    let running = 0
    return sorted.map((log) => {
      if (log.balanceAfter !== null) running = log.balanceAfter
      return { ...log, running }
    }).reverse()
  })()

  const totalPaid = logs.filter(l => l.eventType === "payment" && l.balanceBefore !== null && l.balanceAfter !== null)
    .reduce((s, l) => s + (l.balanceBefore! - l.balanceAfter!), 0)
  const totalWithdrawn = logs.filter(l => l.eventType === "withdraw" && l.balanceBefore !== null && l.balanceAfter !== null)
    .reduce((s, l) => s + (l.balanceAfter! - l.balanceBefore!), 0)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>สมุดบัญชี — {liability.name}</DialogTitle>
        </DialogHeader>

        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">ยอดกู้ตั้งต้น</p>
            <p className="text-base font-bold tabular-nums">{formatCurrency(liability.originalAmount)}</p>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
            <p className="text-[10px] text-red-600">คงเหลือปัจจุบัน</p>
            <p className="text-base font-bold text-red-600 tabular-nums">{formatCurrency(liability.balance)}</p>
            {liability.originalAmount > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                ชำระแล้ว {((1 - liability.balance / liability.originalAmount) * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-emerald-50 px-3 py-2">
            <p className="text-[10px] text-emerald-700">ชำระรวม</p>
            <p className="text-sm font-bold text-emerald-700 tabular-nums">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="rounded-lg bg-orange-50 px-3 py-2">
            <p className="text-[10px] text-orange-600">ถอนรวม</p>
            <p className="text-sm font-bold text-orange-600 tabular-nums">{formatCurrency(totalWithdrawn)}</p>
          </div>
        </div>

        {/* Entry form */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
          <div className="flex gap-1">
            <button
              onClick={() => setTxType("payment")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md font-medium transition-colors ${txType === "payment" ? "bg-emerald-100 text-emerald-700" : "hover:bg-muted text-muted-foreground"}`}
            >
              <TrendingDown className="w-3.5 h-3.5" />ชำระหนี้
            </button>
            <button
              onClick={() => setTxType("withdraw")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md font-medium transition-colors ${txType === "withdraw" ? "bg-red-100 text-red-600" : "hover:bg-muted text-muted-foreground"}`}
            >
              <TrendingUp className="w-3.5 h-3.5" />ถอนเพิ่ม
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="จำนวนเงิน (฿)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              className="h-8 text-sm"
            />
            <Input
              placeholder="หมายเหตุ (ไม่บังคับ)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              className="h-8 text-sm"
            />
            <Button size="sm" className="h-8 shrink-0" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "บันทึก"}
            </Button>
          </div>
          {amount && parseFloat(amount) > 0 && (
            <p className="text-xs text-muted-foreground">
              {txType === "payment" ? "คงเหลือหลังชำระ" : "คงเหลือหลังถอน"}:{" "}
              <span className={`font-semibold ${txType === "payment" ? "text-emerald-600" : "text-red-600"}`}>
                {formatCurrency(txType === "payment" ? Math.max(0, liability.balance - (parseFloat(amount) || 0)) : liability.balance + (parseFloat(amount) || 0))}
              </span>
              <span className="text-muted-foreground ml-1">(ปัจจุบัน {formatCurrency(liability.balance)})</span>
            </p>
          )}
        </div>

        {/* Ledger table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</div>
          ) : withRunning.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีรายการ</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">วันที่</TableHead>
                  <TableHead className="text-xs">ประเภท</TableHead>
                  <TableHead className="text-xs text-right">จำนวน</TableHead>
                  <TableHead className="text-xs text-right">คงเหลือ</TableHead>
                  <TableHead className="text-xs">หมายเหตุ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withRunning.map((log) => {
                  const ev = EVENT_LABEL[log.eventType] ?? { label: log.eventType, color: "text-foreground", bg: "" }
                  const date = new Date(log.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
                  const diff = log.balanceBefore !== null && log.balanceAfter !== null
                    ? log.balanceAfter - log.balanceBefore : null
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{date}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${ev.bg} ${ev.color}`}>{ev.label}</span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {diff !== null && diff !== 0 && (
                          <span className={diff < 0 ? "text-emerald-600" : "text-red-600"}>
                            {diff < 0 ? "-" : "+"}{formatCurrency(Math.abs(diff))}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-medium">{formatCurrency(log.running)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.note ?? ""}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter><Button variant="outline" onClick={onClose}>ปิด</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function BalanceSheetPage() {
  const assets = useAssets()
  const liabilities = useLiabilities()
  const { entries } = useBudget()
  const profile = useProfile()
  const retirement = useRetirement()
  const [assetDialog, setAssetDialog] = useState<{ open: boolean; item?: Asset }>({ open: false })
  const [liabilityDialog, setLiabilityDialog] = useState<{ open: boolean; item?: Liability }>({ open: false })
  const [logDialog, setLogDialog] = useState<Liability | null>(null)
  const [showClosed, setShowClosed] = useState(false)

  const activeDebts = liabilities.items.filter(l => l.status !== "closed")
  const closedDebts = liabilities.items.filter(l => l.status === "closed")

  const totalAssets = assets.items.reduce((s, a) => s + a.value, 0)
  const totalLiabilities = activeDebts.reduce((s, l) => s + l.balance, 0)
  const netWorth = totalAssets - totalLiabilities

  const mortgageBalance = activeDebts.filter(l => l.type === "mortgage").reduce((s, l) => s + l.balance, 0)
  const personalAssets = assets.items.filter(a => a.category === "personal").reduce((s, a) => s + a.value, 0)
  const homeEquity = personalAssets - mortgageBalance
  const hasMortgage = activeDebts.some(l => l.type === "mortgage")

  const catLabel = (cat: string) => ASSET_CATEGORIES.find((c) => c.value === cat)?.label ?? cat
  const typeLabel = (t: string) => LIABILITY_TYPES.find((x) => x.value === t)?.label ?? t

  const aiCtx = useAiAdvisorContext()
  useEffect(() => {
    const totalLiabilitiesVal = activeDebts.reduce((s, l) => s + l.balance, 0)
    const context = [
      `สินทรัพย์รวม: ${formatCurrency(totalAssets)}`,
      `หนี้สินรวม: ${formatCurrency(totalLiabilitiesVal)}`,
      `Net Worth: ${formatCurrency(totalAssets - totalLiabilitiesVal)}`,
      `Home Equity: ${hasMortgage ? formatCurrency(homeEquity) : "ไม่มีบ้าน"}`,
      assets.items.length > 0 ? `สินทรัพย์:\n${assets.items.map(a => `  - ${a.name} (${catLabel(a.category)}): ${formatCurrency(a.value)}`).join("\n")}` : "",
      activeDebts.length > 0 ? `หนี้สิน:\n${activeDebts.map(l => `  - ${l.name}: คงเหลือ ${formatCurrency(l.balance)} ดอกเบี้ย ${l.interestRate}%`).join("\n")}` : "",
    ].filter(Boolean).join("\n")
    aiCtx.set(() => generatePageInsight(context, "วิเคราะห์สถานะสินทรัพย์และหนี้สิน บอกว่าโครงสร้างดีไหม ควรปรับอะไร และมีจุดเสี่ยงตรงไหน", "balance-sheet"), "งบแสดงสถานะการเงิน")
  }, [assets.items.length, activeDebts.length, totalAssets])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader title="งบแสดงสถานะการเงิน" description="บันทึกสินทรัพย์และหนี้สินทั้งหมดของคุณ" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="สินทรัพย์รวม" value={formatCurrency(totalAssets)} valueClass="text-emerald-600" />
        <SummaryCard label="หนี้สินรวม" value={formatCurrency(totalLiabilities)} valueClass="text-red-500" />
        <SummaryCard label="ความมั่งคั่งสุทธิ" value={formatCurrency(netWorth)} valueClass={netWorth >= 0 ? "text-blue-600" : "text-red-500"} />
        <SummaryCard label="Home Equity (บ้าน−จำนอง)" value={hasMortgage ? formatCurrency(homeEquity) : "—"} valueClass={hasMortgage ? (homeEquity >= 0 ? "text-purple-600" : "text-red-500") : "text-muted-foreground"} />
      </div>

      {/* Assets */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base">สินทรัพย์ (Assets)</CardTitle>
          <Button onClick={() => setAssetDialog({ open: true })}><Plus className="w-4 h-4 mr-1" />เพิ่ม</Button>
        </CardHeader>
        <CardContent className="pt-0">
          {assets.items.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีข้อมูลสินทรัพย์</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-right">มูลค่า</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell><Badge variant="secondary">{catLabel(a.category)}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(a.value)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => setAssetDialog({ open: true, item: a })}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { assets.remove(a.id); toast.success("ลบสินทรัพย์แล้ว") }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Liabilities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base">หนี้สิน (Liabilities)</CardTitle>
          <Button onClick={() => setLiabilityDialog({ open: true })}><Plus className="w-4 h-4 mr-1" />เพิ่ม</Button>
        </CardHeader>
        <CardContent className="pt-0">
          {activeDebts.length === 0 && closedDebts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีข้อมูลหนี้สิน</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="text-right">คงเหลือ / ตั้งต้น</TableHead>
                    <TableHead className="text-right">ดอกเบี้ย</TableHead>
                    <TableHead className="text-right">ขั้นต่ำ/เดือน</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeDebts.map((l) => {
                    const pct = l.originalAmount > 0 ? Math.max(0, Math.min(100, (1 - l.balance / l.originalAmount) * 100)) : 0
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell><Badge variant="secondary">{typeLabel(l.type)}</Badge></TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-red-500">{formatCurrency(l.balance)}</span>
                          {l.originalAmount > 0 && (
                            <>
                              <span className="text-muted-foreground text-xs"> / {formatCurrency(l.originalAmount)}</span>
                              <Progress value={pct} className="h-1 mt-1 w-24 ml-auto" />
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{l.interestRate}%</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(l.minimumPayment)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => setLogDialog(l)} title="ประวัติ"><History className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => setLiabilityDialog({ open: true, item: l })}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { liabilities.remove(l.id); toast.success("ลบหนี้สินแล้ว") }}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Total row */}
              {activeDebts.length > 1 && (() => {
                const BIG_TYPES = ["mortgage", "car"]
                const consumer = activeDebts.filter(l => !BIG_TYPES.includes(l.type))
                const big = activeDebts.filter(l => BIG_TYPES.includes(l.type))
                const hasBig = big.length > 0
                return (
                  <div className="mt-2 pt-2 border-t space-y-1.5 px-1">
                    {/* All debts */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">รวมทั้งหมด ({activeDebts.length} รายการ)</span>
                      <div className="flex gap-6">
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">คงเหลือ</p>
                          <p className="text-sm font-bold font-mono text-red-600">{formatCurrency(activeDebts.reduce((s, l) => s + l.balance, 0))}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">ขั้นต่ำ/เดือน</p>
                          <p className="text-sm font-bold font-mono">{formatCurrency(activeDebts.reduce((s, l) => s + l.minimumPayment, 0))}</p>
                        </div>
                      </div>
                    </div>
                    {/* Split rows */}
                    {hasBig && (
                      <>
                        <div className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                          <span className="text-muted-foreground">หนี้ผู้บริโภค ({consumer.length} รายการ)</span>
                          <div className="flex gap-6">
                            <div className="text-right">
                              <p className="font-mono font-semibold text-red-500">{formatCurrency(consumer.reduce((s, l) => s + l.balance, 0))}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-muted-foreground">{formatCurrency(consumer.reduce((s, l) => s + l.minimumPayment, 0))}/เดือน</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs bg-purple-50/60 rounded px-2 py-1">
                          <span className="text-purple-700">บ้าน/รถ ({big.length} รายการ)</span>
                          <div className="flex gap-6">
                            <div className="text-right">
                              <p className="font-mono font-semibold text-purple-700">{formatCurrency(big.reduce((s, l) => s + l.balance, 0))}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-purple-500">{formatCurrency(big.reduce((s, l) => s + l.minimumPayment, 0))}/เดือน</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}

              {closedDebts.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <button
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                    onClick={() => setShowClosed(v => !v)}
                  >
                    {showClosed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    หนี้ที่ปิดแล้ว ({closedDebts.length} รายการ)
                  </button>
                  {showClosed && (
                    <Table>
                      <TableBody>
                        {closedDebts.map((l) => (
                          <TableRow key={l.id} className="opacity-50">
                            <TableCell className="font-medium text-sm">{l.name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">ปิดแล้ว</Badge></TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{formatCurrency(l.originalAmount)}</TableCell>
                            <TableCell className="text-right font-mono">{l.interestRate}%</TableCell>
                            <TableCell />
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" onClick={() => setLogDialog(l)} title="ประวัติ"><History className="w-3.5 h-3.5" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => setLiabilityDialog({ open: true, item: l })}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { liabilities.remove(l.id); toast.success("ลบหนี้สินแล้ว") }}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AssetDialog key={assetDialog.item?.id ?? "new-asset"} open={assetDialog.open} onClose={() => setAssetDialog({ open: false })} initial={assetDialog.item} />
      <LiabilityDialog key={liabilityDialog.item?.id ?? "new-liability"} open={liabilityDialog.open} onClose={() => setLiabilityDialog({ open: false })} initial={liabilityDialog.item} />
      {logDialog && <LogDialog liability={logDialog} onClose={() => setLogDialog(null)} />}
    </div>
  )
}
