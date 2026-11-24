import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { Logo } from './Logo';
import { useReduceMotion } from '../lib/motion';

/** Full-screen Funkty mark on the app background, with a gentle pulse. */
export function Splash() {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);
  return (
    <View
      accessibilityLabel="Loading Funkty"
      style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
        <Logo height={96} />
      </Animated.View>
    </View>
  );
}

/**
 * Covers the screen with the logo until `ready`, shows it for at least `minMs` so it never
 * flashes, then fades out and gets out of the way.
 */
export function SplashOverlay({ ready: feedReady, minMs = 700, maxMs = 6000 }: { ready: boolean; minMs?: number; maxMs?: number }) {
  const [waited, setWaited] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const ready = feedReady || timedOut;
  const [gone, setGone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), minMs);
    return () => clearTimeout(t);
  }, [minMs]);
  useEffect(() => {
    // Never trap people behind the logo if the feed is slow or fails.
    const t = setTimeout(() => setTimedOut(true), maxMs);
    return () => clearTimeout(t);
  }, [maxMs]);
  useEffect(() => {
    if (!ready || !waited) return;
    Animated.timing(fade, { toValue: 0, duration: reduce ? 0 : 250, useNativeDriver: true }).start(() => setGone(true));
  }, [ready, waited, fade, reduce]);
  if (gone) return null;
  return (
    <Animated.View pointerEvents={ready && waited ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, { opacity: fade }]}>
      <Splash />
    </Animated.View>
  );
}
