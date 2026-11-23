import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
// The legacy entry keeps plain asset objects (uri, size, duration), which a scrolling grid needs;
// the SDK 58 Query/Asset API resolves each field asynchronously.
import * as MediaLibrary from 'expo-media-library/legacy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { PickedMedia } from '../lib/posts';
import { useTheme } from '../theme';

export type LibraryPick = PickedMedia & { libId: string };
type Props = {
  kinds: 'photos' | 'videos' | 'both';
  /** Library id -> position in the selection (1-based). */
  selected: Map<string, number>;
  multiple: boolean;
  onTap: (pick: LibraryPick) => void;
  /** Called when the person has not allowed library access, so the screen can offer the file picker. */
  onDenied: () => void;
};

const columns = 4;
const pageSize = 60;

/** The device's recent photos and videos in a four-column grid, like the Instagram post picker. */
export function LibraryGrid({ kinds, selected, multiple, onTap, onDenied }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const size = Math.floor((width - (columns - 1)) / columns);
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const cursor = useRef<{ after?: string; more: boolean; busy: boolean }>({ more: true, busy: false });

  const mediaType: MediaLibrary.MediaTypeValue[] = kinds === 'photos' ? ['photo'] : kinds === 'videos' ? ['video'] : ['photo', 'video'];

  const loadMore = useCallback(
    async (reset = false) => {
      const c = cursor.current;
      if (c.busy || (!c.more && !reset)) return;
      c.busy = true;
      try {
        const page = await MediaLibrary.getAssetsAsync({
          first: pageSize,
          after: reset ? undefined : c.after,
          mediaType,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        c.after = page.endCursor;
        c.more = page.hasNextPage;
        setAssets((prev) => (reset ? page.assets : [...prev, ...page.assets]));
      } finally {
        c.busy = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kinds],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
      if (!alive) return;
      if (!permission.granted) {
        onDenied();
        return;
      }
      cursor.current = { more: true, busy: false };
      await loadMore(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kinds]);

  async function tap(asset: MediaLibrary.Asset) {
    // iOS gives ph:// URIs; the editor and uploader need a real file path.
    const info = await MediaLibrary.getAssetInfoAsync(asset);
    const isVideo = asset.mediaType === 'video';
    onTap({
      libId: asset.id,
      kind: isVideo ? 'video' : 'photo',
      uri: info.localUri ?? asset.uri,
      width: asset.width,
      height: asset.height,
      durationMs: isVideo ? Math.round(asset.duration * 1000) : undefined,
    });
  }

  return (
    <FlatList
      data={assets}
      numColumns={columns}
      keyExtractor={(a) => a.id}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.6}
      columnWrapperStyle={{ gap: 1 }}
      ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
      renderItem={({ item }) => {
        const index = selected.get(item.id);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.mediaType === 'video' ? 'Video' : 'Photo'}
            accessibilityState={{ selected: index !== undefined }}
            onPress={() => void tap(item)}
            style={{ width: size, height: size, backgroundColor: colors.surface }}
          >
            <Image source={{ uri: item.uri }} style={{ width: size, height: size, opacity: index !== undefined ? 0.6 : 1 }} contentFit="cover" />
            {item.mediaType === 'video' ? (
              <View style={{ position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="play" size={12} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                  {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')}
                </Text>
              </View>
            ) : null}
            {multiple || index !== undefined ? (
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: index !== undefined ? 0 : 1.5,
                  borderColor: '#fff',
                  backgroundColor: index !== undefined ? colors.primary : 'rgba(0,0,0,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {index !== undefined ? <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{index}</Text> : null}
              </View>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}
