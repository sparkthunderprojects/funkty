import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tap } from '../../src/lib/haptics';
import { setReduceMotion, useReduceMotion } from '../../src/lib/motion';
import { useSession } from '../../src/lib/session';
import { dayKey, effectiveLimit, settings, usage } from '../../src/lib/wellbeing';
import { useTheme } from '../../src/theme';

const limits = [0, 30, 60, 90, 120];
const breaks = [0, 10, 20, 30];
const hours = [20, 21, 22, 23];

const minutes = (secs: number) => (secs < 60 ? '<1m' : secs < 3600 ? `${Math.round(secs / 60)}m` : `${Math.floor(secs / 3600)}h ${Math.round((secs % 3600) / 60)}m`);

export default function Wellbeing() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const s = settings.use();
  const u = usage.use();
  const reduce = useReduceMotion();
  const isTeen = !!profile?.is_teen;
  const limit = effectiveLimit(s, isTeen);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { key: dayKey(d), label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), secs: u.days[dayKey(d)] ?? 0 };
  });
  const max = Math.max(60, ...days.map((d) => d.secs));
  const total = days.reduce((a, d) => a + d.secs, 0);
  const today = u.days[dayKey()] ?? 0;

  function chips<T extends number>(values: readonly T[], current: T, label: (v: T) => string, pick: (v: T) => void) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {values.map((v) => {
          const on = v === current;
          return (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                pick(v);
              }}
              style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? colors.primary : colors.surface }}
            >
              <Text style={{ color: on ? colors.onPrimary : colors.text, fontWeight: '600' }}>{label(v)}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  const h = (n: number) => `${n > 12 ? n - 12 : n}${n >= 12 ? 'pm' : 'am'}`;
  const heading = { color: colors.text, fontSize: 17, fontWeight: '700' } as const;
  const muted = { color: colors.textMuted, fontSize: 14 } as const;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={heading}>Your time on Funkty</Text>
          <Text style={muted}>Today {minutes(today)}. This week {minutes(total)}, about {minutes(total / 7)} a day.</Text>
          <View accessible accessibilityLabel={`Time per day this week: ${days.map((d) => `${d.label} ${minutes(d.secs)}`).join(', ')}`} style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 8 }}>
            {days.map((d) => (
              <View key={d.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View style={{ width: '100%', height: Math.max(4, (d.secs / max) * 70), backgroundColor: d.key === dayKey() ? colors.primary : colors.surface, borderRadius: 6 }} />
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{d.label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ ...muted, fontSize: 12 }}>Time is counted on this device only and is never sent to Funkty.</Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={heading}>Daily limit</Text>
          <Text style={muted}>
            {isTeen && s.limitMin === undefined ? 'Set to 1 hour for your account. ' : ''}You'll get a reminder when you reach it. You can snooze it for 15 minutes.
          </Text>
          {chips(limits, limit, (v) => (v === 0 ? 'Off' : v < 60 ? `${v}m` : `${v / 60}h${v % 60 ? ' 30m' : ''}`), (v) => settings.set({ ...s, limitMin: v }))}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={heading}>Take a break</Text>
          <Text style={muted}>A nudge after this long without leaving the app.</Text>
          {chips(breaks, s.breakMin, (v) => (v === 0 ? 'Off' : `${v}m`), (v) => settings.set({ ...s, breakMin: v }))}
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...heading, flex: 1 }}>Sleep reminder</Text>
            <Switch accessibilityLabel="Sleep reminder" value={s.sleepOn} onValueChange={(v) => settings.set({ ...s, sleepOn: v })} />
          </View>
          <Text style={muted}>A reminder to wind down if you open Funkty late at night, until 7am.</Text>
          {s.sleepOn ? chips(hours, s.sleepStart, h, (v) => settings.set({ ...s, sleepStart: v })) : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...heading, flex: 1 }}>Reduce motion</Text>
            <Switch accessibilityLabel="Reduce motion" value={reduce} onValueChange={setReduceMotion} />
          </View>
          <Text style={muted}>Turns off screen slide animations and the loading pulse. This is also on automatically if your phone's Reduce Motion is on.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
