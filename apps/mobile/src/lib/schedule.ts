/** Quick choices for when a post goes out. `null` means share now. */
export type ScheduleKey = 'now' | 'hour' | 'evening' | 'tomorrow' | 'weekend';

export const scheduleOptions: { key: ScheduleKey; label: string }[] = [
  { key: 'now', label: 'Now' },
  { key: 'hour', label: 'In 1 hour' },
  { key: 'evening', label: 'This evening' },
  { key: 'tomorrow', label: 'Tomorrow 9am' },
  { key: 'weekend', label: 'Saturday 10am' },
];

export function scheduleDate(key: ScheduleKey, from = new Date()): Date | null {
  const d = new Date(from);
  switch (key) {
    case 'now':
      return null;
    case 'hour':
      return new Date(from.getTime() + 3_600_000);
    case 'evening':
      d.setHours(20, 0, 0, 0);
      if (d.getTime() <= from.getTime() + 60_000) d.setDate(d.getDate() + 1);
      return d;
    case 'tomorrow':
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    case 'weekend': {
      const add = ((6 - d.getDay() + 7) % 7) || 7;
      d.setDate(d.getDate() + add);
      d.setHours(10, 0, 0, 0);
      return d;
    }
  }
}

export function describeWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
