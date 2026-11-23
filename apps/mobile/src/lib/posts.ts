import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export const maxImageWidth = 1440;
export const maxPostPhotos = 10;

const avatarEmbed = 'avatar:media_assets!profiles_avatar_media_fk(storage_key)';

export type Author = {
  username: string;
  display_name: string | null;
  avatar: { storage_key: string } | null;
};

export type FeedPost = {
  id: string;
  caption: string | null;
  created_at: string;
  author_id: string;
  profiles: Author | null;
  post_stats: { like_count: number; comment_count: number } | null;
  post_media: {
    position: number;
    alt_text: string | null;
    media_assets: { storage_key: string; width: number | null; height: number | null } | null;
  }[];
};

export const feedSelect = `id, caption, created_at, author_id, profiles!posts_author_id_fkey(username, display_name, ${avatarEmbed}), post_stats(like_count, comment_count), post_media(position, alt_text, media_assets(storage_key, width, height))`;
export const authorSelect = `username, display_name, ${avatarEmbed}`;

export function mediaUrl(storageKey: string): string {
  return supabase.storage.from('media').getPublicUrl(storageKey).data.publicUrl;
}

export type PostImage = { url: string; alt: string | null; ratio: number };

export function postImages(post: FeedPost): PostImage[] {
  return [...post.post_media]
    .sort((a, b) => a.position - b.position)
    .flatMap((m) => {
      if (!m.media_assets) return [];
      const { storage_key, width, height } = m.media_assets;
      return [
        {
          url: mediaUrl(storage_key),
          alt: m.alt_text,
          ratio: width && height ? Math.min(Math.max(width / height, 0.8), 1.91) : 1,
        },
      ];
    });
}

export function firstImage(post: FeedPost): PostImage | null {
  return postImages(post)[0] ?? null;
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
    case 'not_found':
      return 'That is not available any more.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

export type Picked = { uri: string; width: number; height: number };

export async function pickImages(multiple: boolean): Promise<Picked[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? maxPostPhotos : 1,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/**
 * Re-encodes to JPEG (this also drops EXIF such as GPS location), uploads to the caller's own
 * folder and registers it. Returns the media id. Throws an Error whose message is user-safe.
 */
export async function uploadImage(asset: Picked, userId: string): Promise<string> {
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
  return registered.data.id;
}

export async function publishPhotos(assets: Picked[], userId: string, caption: string): Promise<string> {
  const ids: string[] = [];
  for (const asset of assets) ids.push(await uploadImage(asset, userId));
  const published = await supabase.rpc('publish_post', { p_caption: caption.trim(), p_media_ids: ids });
  if (published.error || !published.data) throw new Error(friendlyError(published.error?.message));
  return published.data.id;
}

export async function publishStoryPhoto(asset: Picked, userId: string): Promise<void> {
  const id = await uploadImage(asset, userId);
  const { error } = await supabase.rpc('publish_story', { p_media_id: id });
  if (error) throw new Error(friendlyError(error.message));
}

export async function setAvatar(asset: Picked, userId: string): Promise<void> {
  const id = await uploadImage(asset, userId);
  const { error } = await supabase.from('profiles').update({ avatar_media_id: id }).eq('id', userId);
  if (error) throw new Error(friendlyError(error.message));
}
