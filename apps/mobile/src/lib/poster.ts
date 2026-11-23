import * as VideoThumbnails from 'expo-video-thumbnails';

/** Native pickers report the duration, so there is nothing to measure here. */
export async function probeDurationMs(_uri: string): Promise<number | undefined> {
  return undefined;
}

export type Poster = { blob: Blob; width: number; height: number };

/** A still frame from the start of the video, used in grids and before playback begins. */
export async function makePoster(uri: string): Promise<Poster | null> {
  try {
    const thumb = await VideoThumbnails.getThumbnailAsync(uri, { time: 500, quality: 0.8 });
    const blob = await (await fetch(thumb.uri)).blob();
    return { blob, width: thumb.width, height: thumb.height };
  } catch {
    return null;
  }
}
