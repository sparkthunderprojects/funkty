import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';

export type ProfileTab = 'posts' | 'reels' | 'tagged' | 'saved';
const labels: Record<ProfileTab, string> = { posts: 'Posts', reels: 'Reels', tagged: 'Tagged', saved: 'Saved' };

/** Pill-shaped switch under the profile header: Posts, Reels and (on your own profile) Saved. */
export function ProfileTabs({ tabs, value, onChange }: { tabs: ProfileTab[]; value: ProfileTab; onChange: (t: ProfileTab) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 999, padding: 4 }}>
      {tabs.map((t) => {
        const on = value === t;
        return (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityLabel={labels[t]}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: on ? colors.card : 'transparent',
              shadowColor: '#000',
              shadowOpacity: on ? 0.08 : 0,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: on ? 2 : 0,
            }}
          >
            <Text style={{ color: on ? colors.text : colors.textMuted, fontSize: 14, fontWeight: on ? '700' : '600' }}>{labels[t]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
