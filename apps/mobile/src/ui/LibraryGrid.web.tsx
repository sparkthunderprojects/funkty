import type { PickedMedia } from '../lib/posts';

export type LibraryPick = PickedMedia & { libId: string };

/** Browsers cannot list the photo library, so the web build uses the system file picker instead. */
export function LibraryGrid(_props: {
  kinds: 'photos' | 'videos' | 'both';
  selected: Map<string, number>;
  multiple: boolean;
  onTap: (pick: LibraryPick) => void;
  onDenied: () => void;
}) {
  return null;
}
