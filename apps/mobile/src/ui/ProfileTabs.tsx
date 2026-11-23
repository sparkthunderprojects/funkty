import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';

export type ProfileTab = 'posts' | 'reels' | 'saved';
const icons: Record<ProfileTab, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap, string]> = {
  posts: ['grid', 'grid-outline', 'Posts'],
  reels: ['film', 'film-outline', 'Reels'],
  saved: ['bookmark', 'bookmark-outline', 'Saved'],
};

/** Icon tab row under the profile header: Posts, Reels and (on your own profile) Saved. */
export function ProfileTabs({ tabs, value, onChange }: { tabs: ProfileTab[]; value: ProfileTab; onChange: (t: ProfileTab) => void }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border }}>
      {tabs.map((t) => {
        const [filled, outline, label] = icons[t];
        const on = value === t;
        return (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 2, borderColor: on ? colors.text : 'transparent', marginBottom: -1 }}
          >
            <Ionicons name={on ? filled : outline} size={24} color={on ? colors.text : colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}
