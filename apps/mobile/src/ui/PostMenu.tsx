import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type FeedPost, friendlyError } from '../lib/posts';
import { useSession } from '../lib/session';
import { shareLink } from '../lib/share';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ActionSheet, type SheetAction } from './ActionSheet';
import { CollectionSheet, CreditsSheet, SeriesSheet } from './PostSheets';

const reportReasons: [string, string][] = [
  ['spam', 'Spam'],
  ['nudity_sexual', 'Nudity or sexual content'],
  ['harassment', 'Bullying or harassment'],
  ['hate_speech', 'Hate speech'],
  ['violence', 'Violence'],
  ['self_harm', 'Self-harm'],
  ['other', 'Something else'],
];

type Props = {
  post: FeedPost;
  caption: string | null;
  commentsEnabled: boolean;
  spoiler: boolean;
  compare: boolean;
  imageCount: number;
  series: { id: string; title: string } | null;
  credits: { position: number; role: string; name: string }[];
  saved?: boolean;
  onSaved?: () => void;
  visible: boolean;
  onClose: () => void;
  onEdited: (patch: {
    caption?: string | null;
    commentsEnabled?: boolean;
    spoiler?: boolean;
    compare?: boolean;
    series?: { id: string; title: string } | null;
    credits?: { position: number; role: string; name: string }[];
    addedUpdate?: { id: string; body: string; created_at: string };
  }) => void;
  onDeleted: () => void;
  onMuted?: () => void;
};

type Panel = 'menu' | 'confirm-delete' | 'report' | 'edit' | 'note' | 'collections' | 'series' | 'credits' | 'update' | 'thanks';

/** The "..." menu on a post. The author edits or deletes; everyone else shares or reports. */
export function PostMenu({ post, caption: currentCaption, commentsEnabled, spoiler, compare, imageCount, series, credits, saved, onSaved, visible, onClose, onEdited, onDeleted, onMuted }: Props) {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const [panel, setPanel] = useState<Panel>('menu');
  const [caption, setCaption] = useState(currentCaption ?? '');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [updateText, setUpdateText] = useState('');
  const mine = profile?.id === post.author_id;
  const username = post.profiles?.username ?? 'unknown';

  function close() {
    setPanel('menu');
    setError(null);
    onClose();
  }

  async function saveCaption() {
    const { error: e } = await supabase.rpc('edit_post', { p_post_id: post.id, p_caption: caption });
    if (e) return setError(friendlyError(e.message));
    onEdited({ caption: caption.trim() || null });
    close();
  }

  // Load the viewer's private note whenever the menu opens.
  useEffect(() => {
    if (!visible || !profile) return;
    supabase
      .from('saves')
      .select('note')
      .eq('post_id', post.id)
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data }) => setNote(data?.note ?? ''));
  }, [visible, post.id, profile]);

  async function postUpdate() {
    const { data, error: e } = await supabase.rpc('add_post_update', { p_post_id: post.id, p_body: updateText });
    if (e || !data) return setError(friendlyError(e?.message));
    onEdited({ addedUpdate: { id: data.id, body: data.body, created_at: data.created_at } });
    setUpdateText('');
    close();
  }

  async function saveNote() {
    // A note lives on a save, so save the post first if needed.
    if (!saved) {
      const { error: se } = await supabase.rpc('save_post', { p_post_id: post.id });
      if (se) return setError(friendlyError(se.message));
      onSaved?.();
    }
    const { error: e } = await supabase.rpc('set_save_note', { p_post_id: post.id, p_note: note });
    if (e) return setError(friendlyError(e.message));
    close();
  }

  async function toggleComments() {
    const next = !commentsEnabled;
    const { error: e } = await supabase.rpc('edit_post', { p_post_id: post.id, p_caption: currentCaption ?? '', p_comments_enabled: next });
    if (!e) onEdited({ commentsEnabled: next });
  }

  async function toggleSpoiler() {
    const next = !spoiler;
    const { error: e } = await supabase.rpc('edit_post', { p_post_id: post.id, p_caption: currentCaption ?? '', p_is_spoiler: next });
    if (!e) onEdited({ spoiler: next });
  }

  async function toggleCompare() {
    const next = !compare;
    const { error: e } = await supabase.rpc('set_post_compare', { p_post_id: post.id, p_on: next });
    if (!e) onEdited({ compare: next });
  }

  async function remove() {
    const { error: e } = await supabase.rpc('delete_post', { p_post_id: post.id });
    if (e) return setError(friendlyError(e.message));
    close();
    onDeleted();
  }

  async function mute() {
    const { error: e } = await supabase.rpc('mute_user', { p_target: post.author_id });
    if (e) return setError(friendlyError(e.message));
    close();
    onMuted?.();
  }

  async function report(code: string) {
    await supabase.rpc('report_content', { p_target_type: 'post', p_target_id: post.id, p_reason_code: code });
    setPanel('thanks');
  }

  if (panel === 'edit') {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
            <Text accessibilityRole="button" onPress={close} style={{ color: colors.text, fontSize: 16, width: 70 }}>
              Cancel
            </Text>
            <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '700' }}>Edit info</Text>
            <Text accessibilityRole="button" onPress={saveCaption} style={{ color: colors.primary, fontSize: 16, fontWeight: '700', width: 70, textAlign: 'right' }}>
              Done
            </Text>
          </View>
          <TextInput
            accessibilityLabel="Caption"
            value={caption}
            onChangeText={setCaption}
            multiline
            autoFocus
            maxLength={2200}
            placeholder="Write a caption…"
            placeholderTextColor={colors.textMuted}
            style={{ color: colors.text, fontSize: 16, padding: spacing.md, minHeight: 120, textAlignVertical: 'top', outlineStyle: 'none' } as never}
          />
          {error ? <Text style={{ color: colors.danger, paddingHorizontal: spacing.md }}>{error}</Text> : null}
        </SafeAreaView>
      </Modal>
    );
  }

  if (panel === 'collections') {
    return <CollectionSheet postId={post.id} visible={visible} onClose={close} onSaved={onSaved} />;
  }
  if (panel === 'series') {
    return <SeriesSheet postId={post.id} currentId={series?.id ?? null} visible={visible} onClose={close} onChanged={(s) => onEdited({ series: s })} />;
  }
  if (panel === 'credits') {
    return <CreditsSheet postId={post.id} initial={credits.map(({ role, name }) => ({ role, name }))} visible={visible} onClose={close} onSaved={(c) => onEdited({ credits: c })} />;
  }

  if (panel === 'update') {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
            <Text accessibilityRole="button" onPress={close} style={{ color: colors.text, fontSize: 16, width: 70 }}>
              Cancel
            </Text>
            <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '700' }}>Post an update</Text>
            <Text accessibilityRole="button" onPress={postUpdate} style={{ color: colors.primary, fontSize: 16, fontWeight: '700', width: 70, textAlign: 'right' }}>
              Post
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.md }}>
            Adds a dated note under your post, like "It's finished!" or "Fixed the typo". Up to 10 per post.
          </Text>
          <TextInput
            accessibilityLabel="Update"
            value={updateText}
            onChangeText={setUpdateText}
            multiline
            autoFocus
            maxLength={500}
            placeholder="What changed?"
            placeholderTextColor={colors.textMuted}
            style={{ color: colors.text, fontSize: 16, padding: spacing.md, minHeight: 120, textAlignVertical: 'top', outlineStyle: 'none' } as never}
          />
          {error ? <Text style={{ color: colors.danger, paddingHorizontal: spacing.md }}>{error}</Text> : null}
        </SafeAreaView>
      </Modal>
    );
  }

  if (panel === 'note') {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
            <Text accessibilityRole="button" onPress={close} style={{ color: colors.text, fontSize: 16, width: 70 }}>
              Cancel
            </Text>
            <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '700' }}>Private note</Text>
            <Text accessibilityRole="button" onPress={saveNote} style={{ color: colors.primary, fontSize: 16, fontWeight: '700', width: 70, textAlign: 'right' }}>
              Done
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.md }}>
            Only you can see this. Saving a note also saves the post, and you can search your notes.
          </Text>
          <TextInput
            accessibilityLabel="Private note"
            value={note}
            onChangeText={setNote}
            multiline
            autoFocus
            maxLength={500}
            placeholder="Why did you save this?"
            placeholderTextColor={colors.textMuted}
            style={{ color: colors.text, fontSize: 16, padding: spacing.md, minHeight: 120, textAlignVertical: 'top', outlineStyle: 'none' } as never}
          />
          {error ? <Text style={{ color: colors.danger, paddingHorizontal: spacing.md }}>{error}</Text> : null}
        </SafeAreaView>
      </Modal>
    );
  }

  // Every action decides for itself whether the sheet closes or moves to another step.
  const then = (fn: () => void) => () => {
    close();
    fn();
  };
  const share = then(() => void shareLink(`${username} on Funkty`, `/post/${post.id}`));
  const actions: SheetAction[] =
    panel === 'confirm-delete'
      ? [
          { label: 'Delete this post for good?', onPress: () => undefined },
          { label: 'Delete', onPress: () => void remove(), destructive: true },
          { label: 'Cancel', onPress: close },
        ]
      : panel === 'report'
        ? [{ label: 'Why are you reporting this?', onPress: () => undefined }, ...reportReasons.map(([code, label]): SheetAction => ({ label, onPress: () => void report(code) }))]
        : panel === 'thanks'
          ? [{ label: 'Thanks. We will review this post.', onPress: close }]
          : mine
            ? [
                { label: 'Edit caption', onPress: () => { setCaption(currentCaption ?? ''); setPanel('edit'); } },
                { label: commentsEnabled ? 'Turn off commenting' : 'Turn on commenting', onPress: then(() => void toggleComments()) },
                { label: spoiler ? 'Remove spoiler mark' : 'Mark as spoiler', onPress: then(() => void toggleSpoiler()) },
                { label: note ? 'Edit private note' : 'Add private note', onPress: () => setPanel('note') },
                { label: 'Post an update', onPress: () => { setUpdateText(''); setPanel('update'); } },
                { label: series ? `Series: ${series.title}` : 'Add to a series', onPress: () => setPanel('series') },
                { label: credits.length ? 'Edit credits' : 'Add credits', onPress: () => setPanel('credits') },
                ...(imageCount === 2 ? [{ label: compare ? 'Show as normal photos' : 'Show as before and after', onPress: then(() => void toggleCompare()) }] : []),
                { label: 'Save to collection', onPress: () => setPanel('collections') },
                { label: 'Share', onPress: share },
                { label: 'Delete', onPress: () => setPanel('confirm-delete'), destructive: true },
              ]
            : [
                { label: note ? 'Edit private note' : 'Add private note', onPress: () => setPanel('note') },
                { label: 'Save to collection', onPress: () => setPanel('collections') },
                { label: 'Share', onPress: share },
                { label: `Mute ${post.profiles?.username ?? 'account'}`, onPress: () => void mute() },
                { label: 'Report', onPress: () => setPanel('report'), destructive: true },
              ];

  return <ActionSheet visible={visible} onClose={close} actions={actions} stay />;
}
