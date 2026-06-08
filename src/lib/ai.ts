import type { Asset, Liability, BudgetEntry } from "@/store"
import { budgetAnnualTotal, budgetBonusAnnual } from "@/store"
import { calcFinancialHealth, calcTaxPayable } from "./calculations"
import { formatCurrency } from "./format"

export interface Message {
  role: "user" | "assistant"
  content: string
}

type Profile = { name: string; age: number; retirementAge: number; lifeExpectancy: number; inflationRate: number }
type Retirement = { monthlyExpenseAtRetirement: number; investmentReturn: number; currentPvdBalance: number; pvdRate: number; employerRate: number; monthlyDcaAmount: number; otherMonthlyIncome: number }

export function buildFinancialContext(assets: Asset[], liabilities: Liability[], entries: BudgetEntry[], profile: Profile, retirement: Retirement) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0)
  const netWorth = totalAssets - totalLiabilities
  const monthlyIncome = budgetAnnualTotal(entries, "income") / 12
  const monthlySaving = budgetAnnualTotal(entries, "saving") / 12
  const monthlyFixed = budgetAnnualTotal(entries, "fixed_expense") / 12
  const monthlyVariable = budgetAnnualTotal(entries, "variable_expense") / 12
  const monthlyDebt = liabilities.reduce((s, l) => s + l.minimumPayment, 0)
  const health = calcFinancialHealth(assets, liabilities, monthlyIncome, monthlySaving, monthlyFixed + monthlyVariable)
  const annualBonus = budgetBonusAnnual(entries)
  const annualIncome = budgetAnnualTotal(entries, "income") + annualBonus
  const tax = calcTaxPayable(Math.max(0, annualIncome - Math.min(annualIncome * 0.5, 100000) - 60000))
  const cashFlow = monthlyIncome - monthlySaving - monthlyFixed - monthlyVariable - monthlyDebt

  return {
    totalAssets, totalLiabilities, netWorth,
    monthlyIncome, monthlySaving, monthlyFixed, monthlyVariable, monthlyDebt, cashFlow,
    health, annualIncome, tax,
    savingsRatePct: monthlyIncome > 0 ? (monthlySaving / monthlyIncome) * 100 : 0,
  }
}

function buildSystemPrompt(assets: Asset[], liabilities: Liability[], entries: BudgetEntry[], profile: Profile, retirement: Retirement): string {
  const d = buildFinancialContext(assets, liabilities, entries, profile, retirement)
  return `คุณเป็นที่ปรึกษาการเงินส่วนตัวที่เป็นกันเอง สไตล์เพื่อนสนิทที่เชี่ยวชาญการเงินและชอบแซวเบาๆ ตอบภาษาไทย พูดตรงๆ ไม่อ้อมค้อม มีมุกขำขันเป็นระยะ ปลุกใจและให้กำลังใจตามสถานการณ์จริง ใส่ emoji หน้าทุกประโยคเพื่อให้อ่านสนุก อ้างอิงตัวเลขจริงของผู้ใช้เสมอ

ข้อมูลการเงินผู้ใช้:
👤 อายุ ${profile.age} ปี | เกษียณ ${profile.retirementAge} ปี | อายุขัย ${profile.lifeExpectancy} ปี | เงินเฟ้อ ${profile.inflationRate}%

💰 สินทรัพย์รวม ${formatCurrency(d.totalAssets)} | หนี้รวม ${formatCurrency(d.totalLiabilities)} | Net Worth ${formatCurrency(d.netWorth)}
สินทรัพย์: ${assets.map(a => `${a.name}(${a.category}) ${formatCurrency(a.value)}`).join(", ") || "ไม่มี"}
หนี้: ${liabilities.map(l => `${l.name} ${formatCurrency(l.balance)} ${l.interestRate}%`).join(", ") || "ไม่มี"}

📊 รายได้ ${formatCurrency(d.monthlyIncome)}/เดือน | ออม ${formatCurrency(d.monthlySaving)} (${d.savingsRatePct.toFixed(1)}%) | จ่ายหนี้ ${formatCurrency(d.monthlyDebt)} | Cash Flow ${formatCurrency(d.cashFlow)}
🏥 สุขภาพการเงิน ${d.health.score}/100 | เงินฉุกเฉิน ${d.health.emergencyFund.toFixed(1)} เดือน
🏖️ PVD ${formatCurrency(retirement.currentPvdBalance)} | DCA ${formatCurrency(retirement.monthlyDcaAmount)}/เดือน | ผลตอบแทน ${retirement.investmentReturn}%
🧾 ภาษีประมาณ ${formatCurrency(d.tax)}/ปี`
}

// ── DeepSeek config ──────────────────────────────────────────────────────────
export const DEEPSEEK_MODELS = {
  chat: "deepseek-chat",
  reasoner: "deepseek-reasoner",
  v4pro: "deepseek-v4-pro",
} as const
export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[keyof typeof DEEPSEEK_MODELS]
export type ReasoningEffort = "low" | "medium" | "high"

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

interface CallOptions {
  model?: DeepSeekModel
  maxTokens?: number
  temperature?: number
  thinking?: boolean
  reasoningEffort?: ReasoningEffort
}

async function callRaw(messages: object[], opts: CallOptions = {}): Promise<string> {
  const { model = DEEPSEEK_MODELS.chat, maxTokens = 1500, temperature = 0.7, thinking, reasoningEffort } = opts
  const body: Record<string, unknown> = { model, messages, temperature, max_tokens: maxTokens }
  if (thinking) {
    body.thinking = { type: "enabled" }
    body.reasoning_effort = reasoningEffort ?? "high"
  }
  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.PUBLIC_DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`DeepSeek error: ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content
}

function parseJSON<T>(text: string): T {
  return JSON.parse(text.trim().replace(/```json|```/g, "").trim())
}

async function callDeepSeek(systemPrompt: string, messages: Message[], opts: CallOptions = {}): Promise<string> {
  return callRaw([{ role: "system", content: systemPrompt }, ...messages], opts)
}

// ── OCR / scan helpers ────────────────────────────────────────────────────────

export async function aiScanAsset(base64: string, mimeType: string): Promise<{ name?: string; value?: number; category?: string } | null> {
  try {
    const text = await callRaw([{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
      { type: "text", text: `นี่คือเอกสารสินทรัพย์ (สมุดบัญชี, หน้าต่าง app ธนาคาร, ใบแสดงมูลค่าหน่วยลงทุน, โฉนด ฯลฯ) กรุณาดึงข้อมูลเป็น JSON: {"name": "ชื่อสินทรัพย์", "value": <มูลค่าตัวเลขบาท>, "category": "liquid|investment|personal"} ตอบ JSON เท่านั้น` },
    ]}], { temperature: 0, maxTokens: 150 })
    return parseJSON(text)
  } catch { return null }
}

export async function aiScanBill(base64: string, mimeType: string): Promise<{ name?: string; balance?: number; rate?: number; type?: string } | null> {
  try {
    const text = await callRaw([{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
      { type: "text", text: `นี่คือบิลหรือ statement หนี้สิน กรุณาดึงข้อมูลออกมาเป็น JSON: {"name": "ชื่อบัตร/สินเชื่อ", "balance": <ยอดคงเหลือตัวเลข>, "rate": <ดอกเบี้ยต่อปีตัวเลข>, "type": "credit_card|personal_loan|mortgage|car|student_loan"} ตอบ JSON เท่านั้น` },
    ]}], { temperature: 0, maxTokens: 200 })
    return parseJSON(text)
  } catch { return null }
}

export async function aiLookupRate(name: string): Promise<{ rate: number; note: string } | null> {
  try {
    const text = await callRaw([{ role: "user", content: `อัตราดอกเบี้ยต่อปีของ "${name}" ในไทยคือเท่าไหร่? ตอบเป็น JSON format: {"rate": <number>, "note": "<string>"} เท่านั้น ห้ามมีข้อความอื่น` }], { temperature: 0, maxTokens: 100 })
    return parseJSON(text)
  } catch { return null }
}

export async function aiScanStatement(base64: string, mimeType: string): Promise<{ name: string; category: string; amounts: number[] }[] | null> {
  try {
    const text = await callRaw([{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
      { type: "text", text: `นี่คือ payslip หรือ bank statement กรุณาดึงข้อมูลรายรับ-รายจ่ายออกมาเป็น JSON array:\n[{"name": "ชื่อรายการ", "category": "income|saving|fixed_expense|variable_expense", "amounts": [0,0,0,0,0,0,0,0,0,0,0,0]}]\namounts คือตัวเลขแต่ละเดือน ม.ค.-ธ.ค. ถ้าเอกสารมีเฉพาะเดือนเดียว ให้ใส่ตัวเลขในเดือนนั้นและ 0 เดือนอื่น\nตอบ JSON array เท่านั้น` },
    ]}], { temperature: 0, maxTokens: 600 })
    return parseJSON(text)
  } catch { return null }
}

export async function aiScanTaxDoc(base64: string, mimeType: string): Promise<Record<string, number> | null> {
  try {
    const text = await callRaw([{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
      { type: "text", text: `นี่คือเอกสารภาษี (ภ.ง.ด.91, ใบ 50 ทวิ, หนังสือรับรองเงินเดือน ฯลฯ) ดึงข้อมูลเป็น JSON:\n{"salary": <เงินเดือนต่อปี>, "business": <รายได้ธุรกิจ>, "dividend": <เงินปันผล>, "rental": <ค่าเช่า>, "lifeInsurance": <เบี้ยประกันชีวิต>, "healthInsurance": <เบี้ยสุขภาพ>, "socialSecurity": <ประกันสังคม>, "pvd": <PVD>, "rmf": <RMF>, "ssf": <SSF>, "donation": <เงินบริจาค>}\nใส่ 0 สำหรับช่องที่ไม่มีข้อมูล ตอบ JSON เท่านั้น` },
    ]}], { temperature: 0, maxTokens: 300 })
    return parseJSON(text)
  } catch { return null }
}

export async function aiSuggestDeductions(income: number, currentDed: Record<string, number>): Promise<string> {
  const dedThai: Record<string, string> = {
    lifeInsurance: "ประกันชีวิต", healthInsurance: "ประกันสุขภาพ", pvd: "PVD",
    ssf: "SSF", rmf: "RMF", thaiEsg: "Thai ESG", donation: "เงินบริจาค",
    socialSecurity: "ประกันสังคม", spouseAllowance: "คู่สมรส", children: "บุตร",
    parents: "บิดามารดา", homeLoanInterest: "ดอกเบี้ยบ้าน",
  }
  const dedStr = Object.entries(currentDed)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${dedThai[k] ?? k}: ${formatCurrency(v)}`)
    .join(", ") || "ยังไม่มีค่าลดหย่อน"
  try {
    return await callRaw([
      { role: "system", content: "คุณเป็นเพื่อนสนิทที่เชี่ยวชาญภาษีเงินได้บุคคลธรรมดาไทย พูดตรงๆ เป็นกันเอง มีมุก ปลุกใจ ใส่ emoji หน้าทุก bullet ให้เหมาะกับเนื้อหา ตอบภาษาไทย อ้างอิงกฎหมายภาษี 2567" },
      { role: "user", content: `รายได้ต่อปี ${formatCurrency(income)} | ค่าลดหย่อนปัจจุบัน: ${dedStr}\nแนะนำค่าลดหย่อนที่ควรเพิ่มเติมเพื่อประหยัดภาษีสูงสุด พร้อมระบุวงเงินสูงสุดที่ใช้ได้และประมาณภาษีที่ประหยัดได้ ตอบ 5-8 ข้อ` },
    ], { temperature: 0.4 })
  } catch { return "ไม่สามารถโหลดคำแนะนำได้" }
}

export async function sendMessage(messages: Message[], assets: Asset[], liabilities: Liability[], entries: BudgetEntry[], profile: Profile, retirement: Retirement): Promise<string> {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? ""
  const result = await callDeepSeek(buildSystemPrompt(assets, liabilities, entries, profile, retirement), messages)

  return result
}

export async function generateFullAnalysis(assets: Asset[], liabilities: Liability[], entries: BudgetEntry[], profile: Profile, retirement: Retirement): Promise<string> {
  const prompt = buildSystemPrompt(assets, liabilities, entries, profile, retirement)
  const request = `วิเคราะห์การเงินของฉันตรงๆ เหมือนเพื่อนที่พูดความจริงได้ ไม่ต้องเกรงใจ อ้างอิงตัวเลขจริงทุกข้อ:

1. 📊 ภาพรวม — จุดแข็ง/จุดอ่อนหลัก พูดตรงๆ เลย
2. ⚠️ ปัญหาเร่งด่วน (ถ้ามี) — บอกเลยว่าน่าเป็นห่วงแค่ไหน
3. 💡 ออมและลดรายจ่าย — ตัวเลขชัดเจน ทำได้จริง
4. 📈 ลงทุน — ประเภทสินทรัพย์และสัดส่วนที่เหมาะกับสถานการณ์นี้
5. 🧾 ประหยัดภาษี — บอกเลขที่ประหยัดได้จริง
6. ✅ 3 สิ่งที่ต้องทำทันที เรียงตามความเร่งด่วน`

  const result = await callDeepSeek(prompt, [{ role: "user", content: request }], { model: DEEPSEEK_MODELS.chat, temperature: 0.5 })

  return result
}

export async function generatePageInsight(context: string, question: string, page = "unknown"): Promise<string> {
  const result = await callRaw([
    {
      role: "system",
      content: `คุณเป็นที่ปรึกษาการเงินส่วนตัวที่เป็นกันเอง สไตล์เพื่อนสนิทที่เชี่ยวชาญการเงิน ตอบภาษาไทยเท่านั้น
พูดตรงๆ ไม่อ้อมค้อม มีอารมณ์ขัน ปลุกใจ ให้กำลังใจตามสถานการณ์จริง อ้างอิงตัวเลขจริงเสมอ
ใส่ emoji หน้าทุก bullet ให้เหมาะกับเนื้อหา ตอบเป็น bullet แต่ละข้อขึ้นบรรทัดใหม่ นำหน้าด้วย - ห้ามใช้ ** ห้ามมีหัวข้อ ห้ามมีย่อหน้า`,
    },
    { role: "user", content: `ข้อมูลการเงิน:\n${context}\n\n${question}` },
  ], { model: DEEPSEEK_MODELS.chat, temperature: 0.4 })

  return result
}

export async function generateBehaviorAnalysis(
  liabilityLogs: { liabilityName: string; eventType: string; balanceBefore: number | null; balanceAfter: number | null; createdAt: string }[],
  assets: Asset[], liabilities: Liability[], entries: BudgetEntry[], profile: Profile, retirement: Retirement
): Promise<string> {
  const d = buildFinancialContext(assets, liabilities, entries, profile, retirement)

  const payments = liabilityLogs.filter(l => l.eventType === "payment")
  const withdrawals = liabilityLogs.filter(l => l.eventType === "withdraw")
  const totalPaid = payments.reduce((s, l) => s + (l.balanceBefore ?? 0) - (l.balanceAfter ?? 0), 0)
  const totalWithdrawn = withdrawals.reduce((s, l) => s + (l.balanceAfter ?? 0) - (l.balanceBefore ?? 0), 0)

  const monthsActive = (() => {
    if (liabilityLogs.length === 0) return 0
    const oldest = new Date(liabilityLogs[liabilityLogs.length - 1].createdAt)
    return Math.max(1, Math.round((Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24 * 30)))
  })()

  const debtNames = [...new Set(payments.map(l => l.liabilityName))]
  const byDebt = debtNames.map(name => {
    const logs = payments.filter(l => l.liabilityName === name)
    const paid = logs.reduce((s, l) => s + (l.balanceBefore ?? 0) - (l.balanceAfter ?? 0), 0)
    return `${name}: ชำระ ${logs.length} ครั้ง รวม ${formatCurrency(paid)}`
  })

  const context = [
    `ข้อมูลการเงิน: Net Worth ${formatCurrency(d.netWorth)} | รายได้ ${formatCurrency(d.monthlyIncome)}/เดือน | ออม ${d.savingsRatePct.toFixed(1)}% | สุขภาพการเงิน ${d.health.score}/100`,
    `หนี้ปัจจุบัน: ${liabilities.length} รายการ ยอดรวม ${formatCurrency(d.totalLiabilities)} | ขั้นต่ำ/เดือน ${formatCurrency(d.monthlyDebt)}`,
    `ประวัติการชำระหนี้ (${monthsActive} เดือนที่ผ่านมา):`,
    payments.length > 0
      ? `  ชำระรวม ${payments.length} ครั้ง ${formatCurrency(totalPaid)}\n` + byDebt.map(b => `  - ${b}`).join("\n")
      : `  ยังไม่มีประวัติการชำระ`,
    totalWithdrawn > 0 ? `ถอน/กู้เพิ่ม: ${withdrawals.length} ครั้ง รวม ${formatCurrency(totalWithdrawn)}` : "",
  ].filter(Boolean).join("\n")

  const result = await callRaw([
    {
      role: "system",
      content: `คุณเป็นนักจิตวิทยาการเงินที่เป็นกันเอง วิเคราะห์พฤติกรรมการเงินจาก log จริง ตอบภาษาไทย พูดตรงๆ เปิดเผย มีมุก ใส่ emoji หน้าทุก bullet ให้เหมาะกับเนื้อหา บอกว่าผู้ใช้เป็นนักการเงินประเภทไหน จุดแข็ง จุดอ่อน และสิ่งที่ควรเปลี่ยน ห้ามใช้ ** ห้ามมีหัวข้อ ตอบเป็น bullet นำหน้าด้วย -`,
    },
    { role: "user", content: `ข้อมูล log และการเงิน:\n${context}\n\nวิเคราะห์ว่าฉันเป็นคนการเงินแบบไหน มีนิสัยอะไร ควรปรับอะไรบ้าง` },
  ], { model: DEEPSEEK_MODELS.chat, temperature: 0.6 })


  return result
}

export async function generateInsightFollowUp(question: string, previousContext: string, page: string): Promise<string> {
  const result = await callRaw([
    {
      role: "system",
      content: `คุณเป็นเพื่อนสนิทที่เชี่ยวชาญการเงิน ตอบภาษาไทย พูดตรงๆ เป็นกันเอง มีมุก ปลุกใจ ใส่ emoji หน้าทุก bullet ให้เหมาะกับเนื้อหา อ้างอิงตัวเลขจริงเสมอ`,
    },
    { role: "user", content: `บทสนทนาก่อนหน้า:\n${previousContext}\n\nคำถามใหม่: ${question}` },
  ], { model: DEEPSEEK_MODELS.chat, temperature: 0.5 })

  return result
}

export async function generateInvestmentPlan(assets: Asset[], liabilities: Liability[], entries: BudgetEntry[], profile: Profile, retirement: Retirement): Promise<string> {
  const prompt = buildSystemPrompt(assets, liabilities, entries, profile, retirement)
  const d = buildFinancialContext(assets, liabilities, entries, profile, retirement)

  const request = `วางแผนลงทุนสำหรับฉันเลย (อายุ ${profile.age} ปี เหลือเวลา ${profile.retirementAge - profile.age} ปี cash flow ${formatCurrency(d.cashFlow)}/เดือน) พูดตรงๆ เหมือนเพื่อนที่รู้จริง:

1. 🎯 ระดับความเสี่ยงที่เหมาะกับสถานการณ์นี้ — บอกเหตุผลด้วย
2. 📊 Asset Allocation — สัดส่วน % แต่ละประเภทพร้อมเหตุผล
3. 🏦 กองทุนแนะนำ (ชื่อจริงที่ซื้อได้ในไทย)
4. 💰 ${formatCurrency(d.cashFlow)}/เดือน แบ่งอย่างไร บอกตัวเลขชัดๆ
5. ⚡ โปะหนี้ก่อนหรือลงทุนก่อน — ตอบให้ชัดพร้อมเหตุผล`

  const result = await callDeepSeek(prompt, [{ role: "user", content: request }], { model: DEEPSEEK_MODELS.chat, temperature: 0.5 })

  return result
}
