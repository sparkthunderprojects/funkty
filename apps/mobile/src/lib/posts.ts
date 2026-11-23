import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { readFile } from './files';
import { makePoster, probeDurationMs } from './poster';
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
  kind: string;
  comments_enabled: boolean;
  is_spoiler: boolean;
  is_compare: boolean;
  series: { id: string; title: string } | null;
  post_credits: { position: number; role: string; name: string }[];
  caption: string | null;
  created_at: string;
  author_id: string;
  profiles: Author | null;
  post_stats: { like_count: number; comment_count: number } | null;
  post_media: {
    position: number;
    alt_text: string | null;
    media_assets: {
      storage_key: string;
      width: number | null;
      height: number | null;
      kind: string;
      variants: { poster?: string } | null;
    } | null;
  }[];
};

export const feedSelect = `id, kind, comments_enabled, is_spoiler, is_compare, caption, created_at, author_id, series(id, title), post_credits(position, role, name), profiles!posts_author_id_fkey(username, display_name, ${avatarEmbed}), post_stats(like_count, comment_count), post_media(position, alt_text, media_assets(storage_key, width, height, kind, variants))`;
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
      const { storage_key, width, height, kind, variants } = m.media_assets;
      // A video is shown in grids and previews by its poster frame.
      const shown = kind === 'video' ? variants?.poster : storage_key;
      if (!shown) return [];
      return [
        {
          url: mediaUrl(shown),
          alt: m.alt_text,
          ratio: width && height ? Math.min(Math.max(width / height, 0.8), 1.91) : 1,
        },
      ];
    });
}

export type PostVideo = { url: string; poster: string | null; ratio: number };

export function postVideo(post: FeedPost): PostVideo | null {
  const asset = post.post_media.find((m) => m.media_assets?.kind === 'video')?.media_assets;
  if (!asset) return null;
  return {
    url: mediaUrl(asset.storage_key),
    poster: asset.variants?.poster ? mediaUrl(asset.variants.poster) : null,
    ratio: asset.width && asset.height ? Math.min(Math.max(asset.width / asset.height, 0.5), 1.91) : 9 / 16,
  };
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
    case 'name_taken':
      return 'You already have one with that name.';
    case 'needs_two_images':
      return 'Before/after needs a post with exactly two photos.';
    case 'invalid_credits':
      return 'Each credit needs a role and a name.';
    case 'too_many_collections':
    case 'too_many_series':
      return 'You have reached the limit of 50.';
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
  const file = await readFile(out.uri);
  const key = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

  const upload = await supabase.storage.from('media').upload(key, file.data, { contentType: 'image/jpeg' });
  if (upload.error) throw new Error(`Upload failed (${upload.error.message}). Check your connection and try again.`);

  const registered = await supabase.rpc('register_image', {
    p_storage_key: key,
    p_mime_type: 'image/jpeg',
    p_bytes: file.size,
    p_width: out.width,
    p_height: out.height,
  });
  if (registered.error || !registered.data) {
    await supabase.storage.from('media').remove([key]);
    throw new Error(friendlyError(registered.error?.message));
  }
  return registered.data.id;
}

export async function publishPhotos(assets: Picked[], userId: string, caption: string, altTexts: string[] = [], isSpoiler = false): Promise<string> {
  const ids: string[] = [];
  for (const asset of assets) ids.push(await uploadImage(asset, userId));
  const published = await supabase.rpc('publish_post', {
    p_caption: caption.trim(),
    p_media_ids: ids,
    p_alt_texts: ids.map((_, n) => (altTexts[n] ?? '').trim().slice(0, 1000)),
    p_is_spoiler: isSpoiler,
  });
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

export const maxVideoBytes = 50 * 1024 * 1024;
export const maxVideoMs = 90_000;

export type PickedMedia = {
  kind: 'photo' | 'video';
  uri: string;
  width: number;
  height: number;
  durationMs?: number;
  mime?: string;
};

export async function pickMedia(kinds: 'photos' | 'videos' | 'both', multiple: boolean): Promise<PickedMedia[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kinds === 'photos' ? ['images'] : kinds === 'videos' ? ['videos'] : ['images', 'videos'],
    quality: 1,
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? maxPostPhotos : 1,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({
    kind: a.type === 'video' ? 'video' : 'photo',
    uri: a.uri,
    width: a.width,
    height: a.height,
    durationMs: a.duration ?? undefined,
    mime: a.mimeType ?? undefined,
  }));
}

const videoTypes: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/** Uploads a video and its poster frame to the caller's own folder and registers it. Returns the media id. */
export async function uploadVideo(video: PickedMedia, userId: string): Promise<string> {
  const file = await readFile(video.uri);
  const mime = videoTypes[file.type] ? file.type : video.mime && videoTypes[video.mime] ? video.mime : 'video/mp4';
  if (file.size > maxVideoBytes) throw new Error('That video is too large. Videos can be up to 50 MB.');
  const durationMs = (await probeDurationMs(video.uri)) || video.durationMs || 0;
  if (durationMs > maxVideoMs) throw new Error('That video is too long. Videos can be up to 90 seconds.');

  const stem = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const key = `${stem}.${videoTypes[mime]}`;
  const up = await supabase.storage.from('media').upload(key, file.data, { contentType: mime });
  if (up.error) throw new Error(`Upload failed (${up.error.message}). Check your connection and try again.`);

  let posterKey: string | null = null;
  let width = video.width;
  let height = video.height;
  const poster = await makePoster(video.uri);
  if (poster) {
    const posterUp = await supabase.storage.from('media').upload(`${stem}-poster.jpg`, poster.body, { contentType: 'image/jpeg' });
    if (!posterUp.error) posterKey = `${stem}-poster.jpg`;
    width = width || poster.width;
    height = height || poster.height;
  }

  const registered = await supabase.rpc('register_video', {
    p_storage_key: key,
    p_mime_type: mime,
    p_bytes: file.size,
    p_duration_ms: Math.max(durationMs, 500),
    p_width: width || undefined,
    p_height: height || undefined,
    p_poster_key: posterKey ?? undefined,
  });
  if (registered.error || !registered.data) {
    await supabase.storage.from('media').remove(posterKey ? [key, posterKey] : [key]);
    throw new Error(
      registered.error?.message === 'invalid_duration'
        ? 'Videos must be between 1 and 90 seconds long.'
        : friendlyError(registered.error?.message),
    );
  }
  return registered.data.id;
}

export async function publishVideo(video: PickedMedia, userId: string, caption: string, isSpoiler = false): Promise<string> {
  const id = await uploadVideo(video, userId);
  const published = await supabase.rpc('publish_post', { p_caption: caption.trim(), p_media_ids: [id], p_is_spoiler: isSpoiler });
  if (published.error || !published.data) throw new Error(friendlyError(published.error?.message));
  return published.data.id;
}
