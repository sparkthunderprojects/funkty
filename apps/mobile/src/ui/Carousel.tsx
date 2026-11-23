import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { PostImage } from '../lib/posts';
import { useTheme } from '../theme';

type Props = { images: PostImage[]; label: string; onDoubleTap?: () => void };

/** Swipeable photo set with page dots and a counter. Double tap triggers onDoubleTap. */
export function Carousel({ images, label, onDoubleTap }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const lastTap = useRef(0);
  const ratio = images[0]?.ratio ?? 1;
  const height = width / ratio;

  function tap() {
    const now = Date.now();
    if (now - lastTap.current < 300) onDoubleTap?.();
    lastTap.current = now;
  }

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ width: '100%', aspectRatio: ratio }}>
      {width > 0 ? (
        <FlatList
          data={images}
          style={{ width, height }}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item, index: i }) => (
            <Pressable style={{ width, height }} onPress={tap} accessibilityLabel={item.alt ?? `${label}, photo ${i + 1} of ${images.length}`}>
              <Image
                source={{ uri: item.url }}
                style={{ width, height, backgroundColor: colors.surface }}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          )}
        />
      ) : null}
      {images.length > 1 ? (
        <>
          <View
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
              {index + 1}/{images.length}
            </Text>
          </View>
          <View style={{ position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
            {images.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === index ? colors.primary : 'rgba(255,255,255,0.7)',
                }}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
