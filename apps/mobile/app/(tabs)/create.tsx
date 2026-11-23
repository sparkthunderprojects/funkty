import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Picked, maxPostPhotos, pickImages, publishPhotos, publishStoryPhoto } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';
import { TextField } from '../../src/ui/TextField';

type Mode = 'post' | 'story';

export default function Create() {
  const { colors, fontSize, radius, spacing } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('post');
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    const picked = await pickImages(mode === 'post');
    if (picked.length > 0) setPhotos(picked.slice(0, mode === 'post' ? maxPostPhotos : 1));
  }

  async function share() {
    if (photos.length === 0 || !profile) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'post') await publishPhotos(photos, profile.id, caption);
      else await publishStoryPhoto(photos[0], profile.id);
      setPhotos([]);
      setCaption('');
      router.navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const first = photos[0];
  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {(['post', 'story'] as const).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            onPress={() => {
              setMode(m);
              setPhotos([]);
            }}
          >
            <Text
              style={{
                color: mode === m ? colors.text : colors.textMuted,
                fontSize: fontSize.title,
                fontWeight: '800',
                textDecorationLine: mode === m ? 'underline' : 'none',
              }}
            >
              {m === 'post' ? 'New post' : 'New story'}
            </Text>
          </Pressable>
        ))}
      </View>
      {first ? (
        <Image
          source={{ uri: first.uri }}
          accessibilityLabel="Selected photo"
          style={{ width: '100%', aspectRatio: Math.min(Math.max(first.width / first.height, 0.8), 1.91), borderRadius: radius.md }}
          contentFit="cover"
        />
      ) : (
        <View style={{ height: 240, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>No photo selected</Text>
        </View>
      )}
      {photos.length > 1 ? (
        <ScrollView horizontal contentContainerStyle={{ gap: spacing.sm }}>
          {photos.map((p, i) => (
            <Image key={i} source={{ uri: p.uri }} style={{ width: 64, height: 64, borderRadius: radius.sm }} contentFit="cover" />
          ))}
        </ScrollView>
      ) : null}
      <Button
        label={photos.length > 0 ? 'Choose different photos' : mode === 'post' ? `Choose photos (up to ${maxPostPhotos})` : 'Choose a photo'}
        variant="secondary"
        onPress={choose}
      />
      {mode === 'post' ? (
        <TextField
          label="Caption"
          value={caption}
          onChangeText={setCaption}
          placeholder="Write a caption… use #hashtags and @mentions"
          multiline
          maxLength={2200}
        />
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>Stories disappear after 24 hours.</Text>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: fontSize.body }}>
          {error}
        </Text>
      ) : null}
      <Button label={mode === 'post' ? 'Share' : 'Share to story'} onPress={share} loading={busy} disabled={photos.length === 0} />
    </Screen>
  );
}
