import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type FeedPost, friendlyError } from '../lib/posts';
import { useSession } from '../lib/session';
import { shareLink } from '../lib/share';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ActionSheet, type SheetAction } from './ActionSheet';

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
  visible: boolean;
  onClose: () => void;
  onEdited: (patch: { caption?: string | null; commentsEnabled?: boolean }) => void;
  onDeleted: () => void;
};

type Panel = 'menu' | 'confirm-delete' | 'report' | 'edit' | 'thanks';

/** The "..." menu on a post. The author edits or deletes; everyone else shares or reports. */
export function PostMenu({ post, caption: currentCaption, commentsEnabled, visible, onClose, onEdited, onDeleted }: Props) {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const [panel, setPanel] = useState<Panel>('menu');
  const [caption, setCaption] = useState(currentCaption ?? '');
  const [error, setError] = useState<string | null>(null);
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

  async function toggleComments() {
    const next = !commentsEnabled;
    const { error: e } = await supabase.rpc('edit_post', { p_post_id: post.id, p_caption: currentCaption ?? '', p_comments_enabled: next });
    if (!e) onEdited({ commentsEnabled: next });
  }

  async function remove() {
    const { error: e } = await supabase.rpc('delete_post', { p_post_id: post.id });
    if (e) return setError(friendlyError(e.message));
    close();
    onDeleted();
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
                { label: 'Share', onPress: share },
                { label: 'Delete', onPress: () => setPanel('confirm-delete'), destructive: true },
              ]
            : [
                { label: 'Share', onPress: share },
                { label: 'Report', onPress: () => setPanel('report'), destructive: true },
              ];

  return <ActionSheet visible={visible} onClose={close} actions={actions} stay />;
}
