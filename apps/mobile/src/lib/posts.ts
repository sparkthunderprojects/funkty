import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export const maxImageWidth = 1440;

export type FeedPost = {
  id: string;
  caption: string | null;
  created_at: string;
  author_id: string;
  profiles: { username: string; display_name: string | null } | null;
  post_stats: { like_count: number; comment_count: number } | null;
  post_media: {
    position: number;
    alt_text: string | null;
    media_assets: { storage_key: string; width: number | null; height: number | null } | null;
  }[];
};

export const feedSelect =
  'id, caption, created_at, author_id, profiles(username, display_name), post_stats(like_count, comment_count), post_media(position, alt_text, media_assets(storage_key, width, height))';

export function mediaUrl(storageKey: string): string {
  return supabase.storage.from('media').getPublicUrl(storageKey).data.publicUrl;
}

export function firstImage(post: FeedPost) {
  const media = [...post.post_media].sort((a, b) => a.position - b.position)[0];
  if (!media?.media_assets) return null;
  const { storage_key, width, height } = media.media_assets;
  return {
    url: mediaUrl(storage_key),
    alt: media.alt_text,
    ratio: width && height ? Math.min(Math.max(width / height, 0.8), 1.91) : 1,
  };
}

/** Maps a Postgres/RPC error to a sentence a person can act on. */
export function friendlyError(message: string | undefined): string {
  switch (message) {
    case 'email_not_verified':
      return 'Confirm your email address first. Check your inbox for the link we sent.';
    case 'action_restricted':
      return 'Your account is currently restricted from doing this.';
    case 'rate_limited':
      return 'You are doing that too quickly. Try again in a little while.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export async function pickImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

/**
 * Re-encodes to JPEG (this also drops EXIF such as GPS location), uploads to the caller's own
 * folder, registers it, and publishes the post. Throws an Error whose message is user-safe.
 */
export async function publishPhoto(
  asset: { uri: string; width: number; height: number },
  userId: string,
  caption: string,
): Promise<string> {
  const actions = asset.width > maxImageWidth ? [{ resize: { width: maxImageWidth } }] : [];
  const out = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const blob = await (await fetch(out.uri)).blob();
  const key = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

  const upload = await supabase.storage.from('media').upload(key, blob, { contentType: 'image/jpeg' });
  if (upload.error) throw new Error('Upload failed. Check your connection and try again.');

  const registered = await supabase.rpc('register_image', {
    p_storage_key: key,
    p_mime_type: 'image/jpeg',
    p_bytes: blob.size,
    p_width: out.width,
    p_height: out.height,
  });
  if (registered.error || !registered.data) {
    await supabase.storage.from('media').remove([key]);
    throw new Error(friendlyError(registered.error?.message));
  }

  const published = await supabase.rpc('publish_post', {
    p_caption: caption.trim(),
    p_media_ids: [registered.data.id],
  });
  if (published.error || !published.data) throw new Error(friendlyError(published.error?.message));
  return published.data.id;
}
