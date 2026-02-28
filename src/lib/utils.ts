export function getMonthRange(year?: number, month?: number) {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth()
  const start = new Date(y, m, 1, 0, 0, 0, 0)
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

// Accepts scored objects; doubles effective score when isDoubleDay is true.
// Sorts descending, takes top scoreCount, sums, divides by count of taken scores.
export function calcMonthlyAverage(
  scores: { total: number; isDoubleDay?: boolean }[],
  scoreCount = 15
): number {
  if (scores.length === 0) return 0
  const effectives = scores.map(s => s.isDoubleDay ? s.total * 2 : s.total)
  const sorted = [...effectives].sort((a, b) => b - a)
  const topN = sorted.slice(0, scoreCount)
  const sum = topN.reduce((a, b) => a + b, 0)
  return sum / scoreCount
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
