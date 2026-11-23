import { Image } from 'expo-image';
import { Modal, Pressable, Text } from 'react-native';
import { mediaUrl } from '../lib/posts';

/** Full-screen look at a profile photo. Tap anywhere to close. */
export function PhotoViewer({ storageKey, username, visible, onClose }: { storageKey?: string | null; username: string; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close photo"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      >
        {storageKey ? (
          <Image
            source={{ uri: mediaUrl(storageKey) }}
            accessibilityLabel={`${username} profile photo, enlarged`}
            style={{ width: '100%', aspectRatio: 1, borderRadius: 32 }}
            contentFit="cover"
          />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16 }}>{username} has no profile photo yet.</Text>
        )}
      </Pressable>
    </Modal>
  );
}
