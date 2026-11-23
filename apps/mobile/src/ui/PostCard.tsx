import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type FeedPost, postImages, postVideo, timeAgo } from '../lib/posts';
import { useSession } from '../lib/session';
import { shareLink } from '../lib/share';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { RingAvatar } from './RingAvatar';
import { Carousel } from './Carousel';
import { Clip } from './Clip';
import { Image } from 'expo-image';
import { Glass } from './Glass';
import { SpoilerVeil } from './SpoilerVeil';
import { tap } from '../lib/haptics';
import { CompareSlider } from './CompareSlider';
import { PostMenu } from './PostMenu';
import { RichText } from './RichText';

/** 1200 -> 1.2K, so counts stay short next to the icons. */
function compact(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.0', '')}M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}K` : String(n);
}

type Props = { post: FeedPost; liked: boolean; saved: boolean; onDeleted?: () => void; allUpdates?: boolean };

export function PostCard({ post, liked: initiallyLiked, saved: initiallySaved, onDeleted, allUpdates }: Props) {
  const { colors, fontSize, spacing } = useTheme();
  const { profile } = useSession();
  const [liked, setLiked] = useState(initiallyLiked);
  const [saved, setSaved] = useState(initiallySaved);
  const [likes, setLikes] = useState(post.post_stats?.like_count ?? 0);
  const [menu, setMenu] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const [commentsEnabled, setCommentsEnabled] = useState(post.comments_enabled);
  const [removed, setRemoved] = useState(false);
  const [spoiler, setSpoiler] = useState(post.is_spoiler);
  const [revealed, setRevealed] = useState(false);
  const [compare, setCompare] = useState(post.is_compare);
  const [series, setSeries] = useState(post.series);
  const [credits, setCredits] = useState(post.post_credits ?? []);
  const [tags, setTags] = useState(post.post_tags ?? []);
  const [updates, setUpdates] = useState(post.post_updates ?? []);
  const sortedUpdates = [...updates].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const isAuthor = profile?.id === post.author_id;
  const shownTags = tags.filter((t) => t.tagged?.username && (t.status === 'approved' || (isAuthor && t.status === 'pending')));
  const images = postImages(post);
  const video = postVideo(post);
  // A video without a poster frame would show as a black box, so it starts playing, muted.
  const [playing, setPlaying] = useState(!!video && !video.poster && !post.is_spoiler);
  const [muted, setMuted] = useState(!!video && !video.poster);
  const username = post.profiles?.username ?? 'unknown';
  const comments = post.post_stats?.comment_count ?? 0;

  const countStyle = { flexDirection: 'row', alignItems: 'center', gap: 6 } as const;
  const countText = { color: colors.text, fontSize: 14, fontWeight: '600' } as const;

  async function toggleLike() {
    const next = !liked;
    tap();
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    const { error } = await supabase.rpc(next ? 'like_post' : 'unlike_post', { p_post_id: post.id });
    if (error) {
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
    }
  }

  async function toggleSave() {
    const next = !saved;
    tap();
    setSaved(next);
    const { error } = await supabase.rpc(next ? 'save_post' : 'unsave_post', { p_post_id: post.id });
    if (error) setSaved(!next);
  }

  if (removed) return null;
  return (
    <View style={{ gap: spacing.sm, paddingVertical: 12, backgroundColor: colors.card, borderRadius: 28, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
        <Link href={{ pathname: '/user/[username]', params: { username } }} asChild>
          <Pressable accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <RingAvatar username={username} storageKey={post.profiles?.avatar?.storage_key} size={48} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15 }}>
                <Text style={{ fontWeight: '800' }}>{post.profiles?.display_name || username}</Text>
                <Text style={{ color: colors.textMuted }}> @{username}</Text>
              </Text>
              {post.profiles?.location ? (
                <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13 }}>
                  {post.profiles.location}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </Link>
        <Pressable accessibilityRole="button" accessibilityLabel="More options" onPress={() => setMenu(true)} hitSlop={12}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </Pressable>
      </View>
      <PostMenu
        post={{ ...post, post_tags: tags }}
        caption={caption}
        commentsEnabled={commentsEnabled}
        spoiler={spoiler}
        compare={compare}
        imageCount={images.length}
        series={series}
        credits={credits}
        saved={saved}
        onSaved={() => setSaved(true)}
        visible={menu}
        onClose={() => setMenu(false)}
        onEdited={(patch) => {
          if (patch.caption !== undefined) setCaption(patch.caption);
          if (patch.commentsEnabled !== undefined) setCommentsEnabled(patch.commentsEnabled);
          if (patch.compare !== undefined) setCompare(patch.compare);
          if (patch.series !== undefined) setSeries(patch.series);
          if (patch.credits !== undefined) setCredits(patch.credits);
          if (patch.tags !== undefined) setTags(patch.tags);
          if (patch.addedUpdate) setUpdates((u) => [...u, patch.addedUpdate!]);
          if (patch.spoiler !== undefined) {
            setSpoiler(patch.spoiler);
            setRevealed(false);
          }
        }}
        onDeleted={() => (onDeleted ? onDeleted() : setRemoved(true))}
        onMuted={() => (onDeleted ? onDeleted() : setRemoved(true))}
      />
      <View style={{ overflow: 'hidden' }}>
      {video ? (
        playing ? (
          <View>
            <Clip
              uri={video.url}
              poster={video.poster}
              active
              muted={muted}
              onDoubleTap={() => {
                if (!liked) void toggleLike();
              }}
              style={{ width: '100%', aspectRatio: Math.max(video.ratio, 0.8) }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={muted ? 'Unmute' : 'Mute'}
              onPress={() => setMuted((m) => !m)}
              hitSlop={8}
              style={{ position: 'absolute', right: 10, bottom: 10 }}
            >
              <Glass padding={7} intensity={30}>
                <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
              </Glass>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Play video" onPress={() => setPlaying(true)}>
            <View style={{ width: '100%', aspectRatio: Math.max(video.ratio, 0.8), backgroundColor: '#000' }}>
              {video.poster ? <Image source={{ uri: video.poster }} contentFit="cover" style={{ width: '100%', height: '100%' }} /> : null}
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.9)" />
              </View>
            </View>
          </Pressable>
        )
      ) : compare && images.length === 2 ? (
        <CompareSlider before={images[0]!} after={images[1]!} label={`Before and after by ${username}`} />
      ) : images.length > 0 ? (
        <Carousel
          images={images}
          label={`Photo by ${username}`}
          onDoubleTap={() => {
            if (!liked) void toggleLike();
          }}
        />
      ) : null}
        {spoiler && !revealed ? <SpoilerVeil onReveal={() => setRevealed(true)} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: liked }}
          onPress={toggleLike}
          hitSlop={8}
          style={countStyle}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={27} color={liked ? colors.danger : colors.text} />
          <Text style={countText}>{compact(likes)}</Text>
        </Pressable>
        {commentsEnabled ? <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Comments" hitSlop={8} style={countStyle}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
            <Text style={countText}>{compact(comments)}</Text>
          </Pressable>
        </Link> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share"
          onPress={() => void shareLink(`${username} on Funkty`, `/post/${post.id}`)}
          hitSlop={8}
        >
          <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
          accessibilityState={{ selected: saved }}
          onPress={toggleSave}
          hitSlop={8}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={26} color={colors.text} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 12, gap: 2 }}>
        {series ? (
          <Link href={{ pathname: '/series/[id]', params: { id: series.id } }} asChild>
            <Text accessibilityRole="link" style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
              Series · {series.title}
            </Text>
          </Link>
        ) : null}
        {caption ? (
          <RichText lead={username} text={caption} style={{ color: colors.text, fontSize: fontSize.body }} />
        ) : null}
        {(allUpdates ? [...sortedUpdates].reverse() : sortedUpdates.slice(-1)).map((u) => (
          <Text key={u.id} style={{ color: colors.text, fontSize: 13 }}>
            <Text style={{ fontWeight: '700' }}>Update · {timeAgo(u.created_at)} ago: </Text>
            {u.body}
          </Text>
        ))}
        {!allUpdates && updates.length > 1 ? (
          <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
            <Text accessibilityRole="link" style={{ color: colors.textMuted, fontSize: 12 }}>
              See all {updates.length} updates
            </Text>
          </Link>
        ) : null}
        {shownTags.length > 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            With{' '}
            {shownTags.map((t, i) => (
              <Text key={t.tagged_id}>
                {i > 0 ? ', ' : ''}
                <Link href={{ pathname: '/user/[username]', params: { username: t.tagged?.username ?? '' } }} asChild>
                  <Text accessibilityRole="link" style={{ color: colors.primary, fontWeight: '600' }}>@{t.tagged?.username}</Text>
                </Link>
                {t.status === 'pending' ? ' (pending)' : ''}
              </Text>
            ))}
          </Text>
        ) : null}
        {credits.length > 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {[...credits].sort((a, b) => a.position - b.position).map((c) => `${c.role}: ${c.name}`).join('  ·  ')}
          </Text>
        ) : null}
        {comments > 0 ? (
          <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
              View all {comments} {comments === 1 ? 'comment' : 'comments'}
            </Text>
          </Link>
        ) : null}
        <Text style={{ color: colors.textMuted, fontSize: 11, letterSpacing: 0.3, textTransform: 'uppercase' }}>{timeAgo(post.created_at)} ago</Text>
      </View>
    </View>
  );
}
