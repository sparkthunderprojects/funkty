import type { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Share } from 'react-native';
import { appLink } from './share';

export type InviteChannel = 'whatsapp' | 'telegram' | 'x' | 'facebook' | 'sms' | 'email';

export const inviteChannels: { key: InviteChannel; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
  { key: 'telegram', label: 'Telegram', icon: 'paper-plane-outline' },
  { key: 'x', label: 'X', icon: 'at-outline' },
  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook' },
  { key: 'sms', label: 'Messages', icon: 'chatbubble-outline' },
  { key: 'email', label: 'Email', icon: 'mail-outline' },
];

export const inviteUrl = (username: string) => appLink(`/user/${username}`);
export const inviteText = (username: string) => `Join me on Funkty! I'm @${username}.`;

/** Web share links open the app when it is installed and the browser version when it is not, so no app list is needed. */
function channelUrl(channel: InviteChannel, text: string, url: string): string {
  const both = encodeURIComponent(`${text} ${url}`);
  switch (channel) {
    case 'whatsapp':
      return `https://wa.me/?text=${both}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    case 'sms':
      return Platform.OS === 'ios' ? `sms:&body=${both}` : `sms:?body=${both}`;
    case 'email':
      return `mailto:?subject=${encodeURIComponent('Join me on Funkty')}&body=${both}`;
  }
}

export async function inviteVia(channel: InviteChannel, username: string): Promise<void> {
  try {
    await Linking.openURL(channelUrl(channel, inviteText(username), inviteUrl(username)));
  } catch {
    // The app or browser could not open the link: nothing to report.
  }
}

/** The system share sheet lists every installed app, including ones without a web share link. */
export async function inviteWithSheet(username: string): Promise<void> {
  const text = inviteText(username);
  const url = inviteUrl(username);
  try {
    await Share.share(Platform.OS === 'ios' ? { message: text, url } : { message: `${text} ${url}` });
  } catch {
    // Dismissed or unsupported.
  }
}
