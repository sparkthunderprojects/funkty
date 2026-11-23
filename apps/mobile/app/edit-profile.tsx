import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { pickImages, setAvatar, setCover } from '../src/lib/posts';
import { useSession } from '../src/lib/session';
import { supabase } from '../src/lib/supabase';
import { useTheme } from '../src/theme';
import { Avatar } from '../src/ui/Avatar';
import { ProfileBanner } from '../src/ui/RingAvatar';
import { Button } from '../src/ui/Button';
import { Screen } from '../src/ui/Screen';
import { TextField } from '../src/ui/TextField';

export default function EditProfile() {
  const { profile, refreshProfile } = useSession();
  const { colors, fontSize, spacing } = useTheme();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);
  const [location, setLocation] = useState(profile?.location ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('profiles')
      .select('avatar:media_assets!profiles_avatar_media_fk(storage_key), cover:media_assets!profiles_cover_media_id_fkey(storage_key)')
      .eq('id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as unknown as { avatar: { storage_key: string } | null; cover: { storage_key: string } | null } | null;
        setAvatarKey(d?.avatar?.storage_key ?? null);
        setCoverKey(d?.cover?.storage_key ?? null);
      });
  }, [profile]);

  if (!profile) return null;

  async function changePhoto() {
    if (!profile) return;
    const [asset] = await pickImages(false);
    if (!asset) return;
    setBusy(true);
    setError(null);
    try {
      await setAvatar(asset, profile.id);
      const { data } = await supabase
        .from('profiles')
        .select('avatar:media_assets!profiles_avatar_media_fk(storage_key)')
        .eq('id', profile.id)
        .maybeSingle();
      setAvatarKey((data as unknown as { avatar: { storage_key: string } | null } | null)?.avatar?.storage_key ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function changeCover() {
    if (!profile) return;
    const [asset] = await pickImages(false);
    if (!asset) return;
    setBusy(true);
    setError(null);
    try {
      await setCover(asset, profile.id);
      const { data } = await supabase
        .from('profiles')
        .select('cover:media_assets!profiles_cover_media_id_fkey(storage_key)')
        .eq('id', profile.id)
        .maybeSingle();
      setCoverKey((data as unknown as { cover: { storage_key: string } | null } | null)?.cover?.storage_key ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function removeCover() {
    if (!profile) return;
    await supabase.from('profiles').update({ cover_media_id: null }).eq('id', profile.id);
    setCoverKey(null);
  }

  async function save() {
    if (!profile) return;
    let site = website.trim();
    if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`;
    site = site.replace(/^http:\/\//i, 'https://');
    if (site && !/^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/[^\s]*)?$/.test(site)) {
      return setError('Enter a valid website, for example example.com.');
    }
    if (site.length > 100) return setError('That website address is too long.');
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null, bio: bio.trim() || null, is_private: isPrivate, location: location.trim() || null, website: site || null })
      .eq('id', profile.id);
    setBusy(false);
    if (updateError) return setError('Could not save your changes. Please try again.');
    await refreshProfile();
    router.back();
  }

  return (
    <Screen scroll>
      <View style={{ gap: spacing.xs }}>
        <ProfileBanner height={96} storageKey={coverKey} />
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <Pressable accessibilityRole="button" onPress={changeCover}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: fontSize.body }}>Change cover photo</Text>
          </Pressable>
          {coverKey ? (
            <Pressable accessibilityRole="button" onPress={removeCover}>
              <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: fontSize.body }}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Avatar username={profile.username} storageKey={avatarKey} size={96} />
        <Pressable accessibilityRole="button" onPress={changePhoto}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: fontSize.body }}>Change profile photo</Text>
        </Pressable>
      </View>
      <TextField label="Name" value={displayName} onChangeText={setDisplayName} maxLength={50} />
      <TextField label="Bio" value={bio} onChangeText={setBio} maxLength={150} multiline />
      <TextField label="Location" value={location} onChangeText={setLocation} maxLength={40} />
      <TextField label="Website" value={website} onChangeText={setWebsite} maxLength={100} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="example.com" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: fontSize.body }}>Private account</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>
            Only people you approve can see your posts and stories.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Private account"
          value={isPrivate}
          onValueChange={setIsPrivate}
          trackColor={{ true: colors.primary }}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: fontSize.body }}>
          {error}
        </Text>
      ) : null}
      <Button label="Save" onPress={save} loading={busy} />
    </Screen>
  );
}
