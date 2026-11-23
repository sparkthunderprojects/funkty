/** Browsers do not report the length of a picked file, so read it from the video's metadata. */
export function probeDurationMs(uri: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const done = () => resolve(Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined);
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration)) return done();
      // Some WebM files omit the length; seeking far past the end makes the browser work it out.
      video.ontimeupdate = () => {
        video.ontimeupdate = null;
        done();
      };
      video.currentTime = 1e6;
    };
    video.onerror = () => resolve(undefined);
    video.src = uri;
  });
}

export type Poster = { body: Blob; width: number; height: number };

/** A still frame from near the start of the video, drawn to a canvas. Null if the browser cannot decode it. */
export function makePoster(uri: string): Promise<Poster | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    const fail = () => resolve(null);
    video.onerror = fail;
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      const scale = Math.min(1, 720 / Math.max(video.videoWidth, 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return fail();
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob ? { body: blob, width: canvas.width, height: canvas.height } : null), 'image/jpeg', 0.8);
    };
    video.src = uri;
  });
}
