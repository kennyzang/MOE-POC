import prisma from './prisma'

// Brunei weekend: Friday (5) and Saturday (6)
const BRUNEI_WEEKEND = new Set([5, 6])

export async function getHolidaySet(schoolId?: string): Promise<Set<string>> {
  const holidays = await prisma.publicHoliday.findMany({
    where: schoolId
      ? { OR: [{ schoolId }, { schoolId: null }] }
      : { schoolId: null },
    select: { date: true },
  })
  return new Set(holidays.map(h => toDateKey(h.date)))
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function isWorkingDay(date: Date, holidayKeys: Set<string>): boolean {
  const dow = date.getDay()
  if (BRUNEI_WEEKEND.has(dow)) return false
  if (holidayKeys.has(toDateKey(date))) return false
  return true
}

export async function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  schoolId?: string,
): Promise<number> {
  const holidays = await getHolidaySet(schoolId)
  let count = 0
  const cur = new Date(startDate)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  while (cur <= end) {
    if (isWorkingDay(cur, holidays)) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}
