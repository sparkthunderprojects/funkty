import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Pressable, Text, View } from 'react-native';

/**
 * Covers a spoiler post's photo or video with a heavy blur until the viewer taps. `compact`
 * is for small grid tiles: just the icon, and the tap passes through to open the post.
 */
export function SpoilerVeil({ onReveal, compact }: { onReveal?: () => void; compact?: boolean }) {
  const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
  const body = (
    <>
      <BlurView tint="dark" intensity={100} experimentalBlurMethod="dimezisBlurView" style={fill} />
      <View style={[fill, { backgroundColor: 'rgba(15,15,15,0.45)', alignItems: 'center', justifyContent: 'center', gap: 6 }]}>
        <Ionicons name="eye-off-outline" size={compact ? 22 : 34} color="#fff" />
        {compact ? null : (
          <>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>Spoiler</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>Tap to reveal</Text>
          </>
        )}
      </View>
    </>
  );
  if (compact) return <View pointerEvents="none" style={fill}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Spoiler. Tap to reveal" onPress={onReveal} style={fill}>
      {body}
    </Pressable>
  );
}
