import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';

type Stats = { posts: number; likes: number; comments: number; followers: number; storyViews: number };

/** A private seven-day summary of what happened around the person's own account. */
export default function Week() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [streak, setStreak] = useState<{ current: number; best: number; today: boolean } | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase.rpc('posting_streak').then(({ data }) => {
      const r = data?.[0];
      if (r) setStreak({ current: r.current_streak, best: r.best_streak, today: r.posted_today });
    });
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const opts = { count: 'exact', head: true } as const;
    Promise.all([
      supabase.from('posts').select('id', opts).eq('author_id', profile.id).gte('created_at', since),
      supabase.from('likes').select('post_id, posts!inner(author_id)', opts).eq('posts.author_id', profile.id).neq('user_id', profile.id).gte('created_at', since),
      supabase.from('comments').select('id, posts!inner(author_id)', opts).eq('posts.author_id', profile.id).neq('author_id', profile.id).gte('created_at', since),
      supabase.from('follows').select('follower_id', opts).eq('followee_id', profile.id).eq('state', 'active').gte('created_at', since),
      supabase.from('story_views').select('story_id, stories!inner(author_id)', opts).eq('stories.author_id', profile.id).gte('viewed_at', since),
    ]).then(([p, l, c, f, v]) =>
      setStats({ posts: p.count ?? 0, likes: l.count ?? 0, comments: c.count ?? 0, followers: f.count ?? 0, storyViews: v.count ?? 0 }),
    );
  }, [profile]);

  const tiles: [string, number | undefined][] = [
    ['Posts shared', stats?.posts],
    ['Likes received', stats?.likes],
    ['Comments received', stats?.comments],
    ['New followers', stats?.followers],
    ['Story views', stats?.storyViews],
  ];

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 32, fontWeight: '800' }}>{streak ? `${streak.current} ${streak.current === 1 ? 'day' : 'days'}` : '–'}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            Posting streak{streak ? ` · best ${streak.best}` : ''}
            {streak && streak.current > 0 && !streak.today ? ' · post today to keep it going' : ''}
          </Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>The last 7 days. Only you can see this.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {tiles.map(([label, value]) => (
            <View key={label} style={{ width: '47%', backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, gap: 2 }}>
              <Text style={{ color: colors.text, fontSize: 32, fontWeight: '800' }}>{value ?? '–'}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
