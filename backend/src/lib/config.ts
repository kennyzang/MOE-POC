import prisma from './prisma'

// In-memory cache so risk recalc (called on every grade/attendance save) doesn't
// hit SQLite for the same threshold value thousands of times per demo session.
const cache = new Map<string, string>()

export async function getConfig(key: string, defaultValue: string): Promise<string> {
  if (cache.has(key)) return cache.get(key)!
  const record = await prisma.systemConfig.findUnique({ where: { key } })
  const value = record?.value ?? defaultValue
  cache.set(key, value)
  return value
}

export async function getConfigFloat(key: string, defaultValue: number): Promise<number> {
  const v = await getConfig(key, String(defaultValue))
  const parsed = parseFloat(v)
  return isNaN(parsed) ? defaultValue : parsed
}

export async function getConfigInt(key: string, defaultValue: number): Promise<number> {
  const v = await getConfig(key, String(defaultValue))
  const parsed = parseInt(v, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

// Call this after a PUT /config/thresholds so the next read fetches fresh values.
export function invalidateConfig(key: string): void {
  cache.delete(key)
}

export function invalidateAllConfig(): void {
  cache.clear()
}
