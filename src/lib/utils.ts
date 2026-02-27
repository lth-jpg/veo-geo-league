export function getMonthRange(year?: number, month?: number) {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth()
  const start = new Date(y, m, 1, 0, 0, 0, 0)
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

export function getTodayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { start, end }
}

export function calcMonthlyAverage(scores: number[]): number {
  if (scores.length === 0) return 0
  const sorted = [...scores].sort((a, b) => b - a)
  const top15 = sorted.slice(0, 15)
  const sum = top15.reduce((a, b) => a + b, 0)
  return sum / 15
}

export function formatScore(score: number): string {
  return score.toLocaleString('en-US')
}

export function formatAverage(avg: number): string {
  return avg.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function getMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function scoreBar(total: number, max = 15000): number {
  return Math.min((total / max) * 100, 100)
}
