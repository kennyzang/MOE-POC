/** Safely extract a single string from express req.query value */
export function qs(val: unknown): string | undefined {
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return val[0] as string | undefined
  return undefined
}
