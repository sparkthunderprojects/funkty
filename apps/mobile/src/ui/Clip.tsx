import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

type Props = {
  uri: string;
  poster?: string | null;
  /** Plays while true. The player is created whether or not it is active, so mount it only when needed. */
  active: boolean;
  muted: boolean;
  style?: ViewStyle;
  contentFit?: 'cover' | 'contain';
  onTap?: () => void;
  onDoubleTap?: () => void;
};

/** One video with a poster until the first frame, tap to pause and resume, and optional double tap. */
export function Clip({ uri, poster, active, muted, style, contentFit = 'cover', onTap, onDoubleTap }: Props) {
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = muted;
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (active && !paused) player.play();
    else player.pause();
  }, [player, active, paused]);

  useEffect(() => {
    if (!active) {
      setPaused(false);
      player.currentTime = 0;
    }
  }, [player, active]);

  function press() {
    const now = Date.now();
    if (onDoubleTap && now - lastTap < 280) {
      setLastTap(0);
      onDoubleTap();
      return;
    }
    setLastTap(now);
    setPaused((p) => !p);
    onTap?.();
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Play video' : 'Pause video'} onPress={press} style={[{ backgroundColor: '#000' }, style]}>
      <VideoView player={player} nativeControls={false} contentFit={contentFit} style={{ width: '100%', height: '100%' }} onFirstFrameRender={() => setReady(true)} />
      {poster && !ready ? (
        <Image source={{ uri: poster }} contentFit={contentFit} style={{ position: 'absolute', width: '100%', height: '100%' }} />
      ) : null}
      {paused ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play" size={64} color="rgba(255,255,255,0.85)" />
        </View>
      ) : null}
    </Pressable>
  );
}
