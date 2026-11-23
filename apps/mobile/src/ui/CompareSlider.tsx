import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import type { PostImage } from '../lib/posts';

/** Before/after viewer: drag the handle to reveal the second photo over the first. */
export function CompareSlider({ before, after, label }: { before: PostImage; after: PostImage; label: string }) {
  const [width, setWidth] = useState(0);
  const [pos, setPos] = useState(0.5);
  const widthRef = useRef(0);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => setPos(clamp(e.nativeEvent.locationX / (widthRef.current || 1))),
      onPanResponderMove: (e) => setPos(clamp(e.nativeEvent.locationX / (widthRef.current || 1))),
    }),
  ).current;

  const ratio = before.ratio;
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityLabel={`${label}. Drag to compare before and after.`}
      accessibilityRole="adjustable"
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      style={{ width: '100%', aspectRatio: ratio, overflow: 'hidden', backgroundColor: '#000' }}
    >
      <Image source={{ uri: after.url }} contentFit="cover" style={{ position: 'absolute', width: '100%', height: '100%' }} pointerEvents="none" />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: width * pos, overflow: 'hidden' }} pointerEvents="none">
        <Image source={{ uri: before.url }} contentFit="cover" style={{ width, height: '100%' }} />
      </View>
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: width * pos - 1, width: 2, backgroundColor: '#fff' }} pointerEvents="none" />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: '50%', left: width * pos - 16, marginTop: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#000' }}>⇄</Text>
      </View>
      <Tag text="Before" side="left" />
      <Tag text="After" side="right" />
    </View>
  );
}

function clamp(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function Tag({ text, side }: { text: string; side: 'left' | 'right' }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 10, [side]: 10, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}
