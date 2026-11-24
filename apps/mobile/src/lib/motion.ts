import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { createPref } from './prefs';

const pref = createPref<{ reduce: boolean }>('funkty.motion', { reduce: false });
export const setReduceMotion = (reduce: boolean) => pref.set({ reduce });

/** True when the person turned on Reduce motion here, or their phone has it on. */
export function useReduceMotion(): boolean {
  const mine = pref.use().reduce;
  const [system, setSystem] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => live && setSystem(!!v)).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setSystem);
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);
  return mine || system;
}
