import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createPref } from './prefs';

export type WellbeingSettings = {
  /** Minutes per day. 0 is off. Unset means the default for the account (60 for under 18, off otherwise). */
  limitMin?: number;
  breakMin: number;
  sleepOn: boolean;
  sleepStart: number;
};

export const settings = createPref<WellbeingSettings>('funkty.wellbeing', { breakMin: 0, sleepOn: false, sleepStart: 22 });
export const usage = createPref<{ days: Record<string, number>; snoozeAt?: number; sleepShown?: string }>('funkty.usage', { days: {} });

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const effectiveLimit = (s: WellbeingSettings, isTeen: boolean) => (s.limitMin === undefined ? (isTeen ? 60 : 0) : s.limitMin);

export type Reminder = 'limit' | 'break' | 'sleep' | null;

/** Counts the time the app is open and says when to show a reminder. Time is kept on this device only. */
export function useWellbeing(isTeen: boolean): { reminder: Reminder; dismiss: () => void } {
  const s = settings.use();
  const [reminder, setReminder] = useState<Reminder>(null);
  const run = useRef(0); // seconds of continuous use
  const hiddenAt = useRef<number | null>(null);
  const reminderRef = useRef<Reminder>(null);
  reminderRef.current = reminder;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (hiddenAt.current && Date.now() - hiddenAt.current > 120_000) run.current = 0;
        hiddenAt.current = null;
      } else if (hiddenAt.current === null) hiddenAt.current = Date.now();
    });
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const u = usage.get();
      const key = dayKey();
      const today = (u.days[key] ?? 0) + 10;
      const days = Object.fromEntries(Object.entries({ ...u.days, [key]: today }).sort().slice(-14));
      usage.set({ ...u, days });
      run.current += 10;
      if (reminderRef.current) return;
      const cur = settings.get();
      const limit = effectiveLimit(cur, isTeen);
      const now = new Date();
      const hour = now.getHours();
      const asleep = cur.sleepOn && (hour >= cur.sleepStart || hour < 7);
      if (limit > 0 && today >= limit * 60 && today >= (u.snoozeAt ?? 0)) setReminder('limit');
      else if (cur.breakMin > 0 && run.current >= cur.breakMin * 60) setReminder('break');
      else if (asleep && u.sleepShown !== key) setReminder('sleep');
    }, 10_000);
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [isTeen, s.limitMin]);

  function dismiss() {
    const u = usage.get();
    if (reminder === 'limit') usage.set({ ...u, snoozeAt: (u.days[dayKey()] ?? 0) + 15 * 60 });
    if (reminder === 'break') run.current = 0;
    if (reminder === 'sleep') usage.set({ ...u, sleepShown: dayKey() });
    setReminder(null);
  }
  return { reminder, dismiss };
}
