export function formatCurrency(value: number): string {
  return "฿" + Math.round(value).toLocaleString("th-TH")
}

export function formatPercent(value: number, decimals = 1): string {
  return value.toFixed(decimals) + "%"
}
