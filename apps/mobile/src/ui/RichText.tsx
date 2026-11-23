import { useRouter } from 'expo-router';
import { Text, type TextStyle } from 'react-native';
import { useTheme } from '../theme';

const token = /(#[\p{L}\p{N}_]{1,50}|@[a-z0-9._]{3,30})/giu;

/** Renders #hashtags and @mentions as links. */
export function RichText({ text, style, lead }: { text: string; style?: TextStyle; lead?: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const parts = text.split(token);
  return (
    <Text style={style}>
      {lead ? <Text style={{ fontWeight: '700' }}>{lead} </Text> : null}
      {parts.map((part, i) => {
        if (part.startsWith('#') && part.length > 1) {
          return (
            <Text
              key={i}
              accessibilityRole="link"
              style={{ color: colors.primary }}
              onPress={() => router.push({ pathname: '/tag/[tag]', params: { tag: part.slice(1).toLowerCase() } })}
            >
              {part}
            </Text>
          );
        }
        if (part.startsWith('@') && part.length > 3) {
          return (
            <Text
              key={i}
              accessibilityRole="link"
              style={{ color: colors.primary }}
              onPress={() => router.push({ pathname: '/user/[username]', params: { username: part.slice(1).toLowerCase() } })}
            >
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}
