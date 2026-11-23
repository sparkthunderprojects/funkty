import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { pickImage, publishPhoto } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';
import { TextField } from '../../src/ui/TextField';

type Picked = { uri: string; width: number; height: number };

export default function Create() {
  const { colors, fontSize, radius } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const [photo, setPhoto] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    const asset = await pickImage();
    if (asset) setPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
  }

  async function share() {
    if (!photo || !profile) return;
    setBusy(true);
    setError(null);
    try {
      await publishPhoto(photo, profile.id, caption);
      setPhoto(null);
      setCaption('');
      router.navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '800' }}>New post</Text>
      {photo ? (
        <Image
          source={{ uri: photo.uri }}
          accessibilityLabel="Selected photo"
          style={{ width: '100%', aspectRatio: Math.min(Math.max(photo.width / photo.height, 0.8), 1.91), borderRadius: radius.md }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            height: 240,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>No photo selected</Text>
        </View>
      )}
      <Button label={photo ? 'Choose a different photo' : 'Choose a photo'} variant="secondary" onPress={choose} />
      <TextField
        label="Caption"
        value={caption}
        onChangeText={setCaption}
        placeholder="Write a caption…"
        multiline
        maxLength={2200}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: fontSize.body }}>
          {error}
        </Text>
      ) : null}
      <Button label="Share" onPress={share} loading={busy} disabled={!photo} />
    </Screen>
  );
}
