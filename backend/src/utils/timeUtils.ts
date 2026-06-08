export function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  return toMin(s1) < toMin(e2) && toMin(s2) < toMin(e1)
}
