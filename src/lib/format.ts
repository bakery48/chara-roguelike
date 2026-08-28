/** 表示用の整形ユーティリティ。 */

export function num(n: number): string {
  const v = Math.floor(n)
  if (v < 10000) return v.toLocaleString('ja-JP')
  if (v < 100_000_000) return `${(v / 10000).toFixed(v < 100000 ? 2 : 1)}万`
  return `${(v / 100_000_000).toFixed(2)}億`
}

export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}時間${m}分`
  if (m > 0) return `${m}分${sec}秒`
  return `${sec}秒`
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function dateLabel(at: number): string {
  const d = new Date(at)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
