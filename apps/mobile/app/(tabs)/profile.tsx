import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';

type Stats = { posts: number; followers: number; following: number };

export default function Profile() {
  const { profile, signOut } = useSession();
  const { colors, fontSize, spacing } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('profile_stats')
      .select('posts_count, followers_count, following_count')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStats({ posts: data.posts_count, followers: data.followers_count, following: data.following_count });
      });
  }, [profile]);

  if (!profile) return null;
  return (
    <Screen>
      <Text style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '800' }}>
        {profile.display_name || profile.username}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>@{profile.username}</Text>
      {profile.bio ? <Text style={{ color: colors.text, fontSize: fontSize.body }}>{profile.bio}</Text> : null}
      <View style={{ flexDirection: 'row', gap: spacing.lg, marginVertical: spacing.md }}>
        {([['Posts', stats?.posts], ['Followers', stats?.followers], ['Following', stats?.following]] as const).map(
          ([label, value]) => (
            <View key={label}>
              <Text style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '800' }}>{value ?? 0}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>{label}</Text>
            </View>
          ),
        )}
      </View>
      {profile.is_private ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>Your account is private.</Text>
      ) : null}
      <View style={{ flex: 1 }} />
      <Button label="Log out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
