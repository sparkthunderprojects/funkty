import { BlurView } from 'expo-blur';
import { Platform, View, type ViewStyle } from 'react-native';

/**
 * A frosted-glass surface for controls that sit on top of photos and video. It blurs what is
 * behind it and adds a dark tint so white icons and text stay readable on bright pictures.
 * Use it over media only: on a flat white screen there is nothing to blur.
 */
export function Glass({
  radius = 999,
  padding = 8,
  intensity = 40,
  style,
  children,
}: {
  radius?: number;
  padding?: number;
  intensity?: number;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.22)',
          backgroundColor: Platform.OS === 'android' ? 'rgba(20,20,20,0.55)' : 'rgba(20,20,20,0.28)',
        },
        style,
      ]}
    >
      <BlurView
        tint="dark"
        intensity={intensity}
        experimentalBlurMethod="dimezisBlurView"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ padding, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}
