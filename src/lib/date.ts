// Date helpers operating on ISO date strings 'YYYY-MM-DD' in local time.

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function isoToLabel(iso: string): string {
  const date = parseISO(iso)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function addDays(iso: string, n: number): string {
  const date = parseISO(iso)
  date.setDate(date.getDate() + n)
  return toISO(date)
}

export function weekdayIndex(iso: string): number {
  return parseISO(iso).getDay()
}

export function lastNDays(n: number): string[] {
  const today = todayISO()
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    days.push(addDays(today, -i))
  }
  return days
}
