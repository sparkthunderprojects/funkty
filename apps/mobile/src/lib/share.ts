import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

/** A link that opens the given in-app path, on web (with the hosting base path) and on native. */
export function appLink(path: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}${path}`;
  }
  return Linking.createURL(path);
}

/** Opens the system share sheet. Silent when the person dismisses it or the browser has no share support. */
export async function shareLink(message: string, path: string): Promise<void> {
  const url = appLink(path);
  try {
    await Share.share(Platform.OS === 'ios' ? { message, url } : { message: `${message} ${url}` });
  } catch {
    // Dismissed or unsupported: nothing to report.
  }
}
