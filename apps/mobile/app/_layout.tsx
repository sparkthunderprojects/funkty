import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppHeader } from '../src/ui/AppHeader';
import { useTheme } from '../src/theme';
import { SessionProvider, useSession } from '../src/lib/session';

type HeaderProps = { options: { title?: string }; back?: unknown; navigation: { goBack: () => void } };
const pushed = (title: string) => ({
  headerShown: true,
  title,
  header: ({ options, back, navigation }: HeaderProps) => (
    <AppHeader title={options.title} onBack={back ? () => navigation.goBack() : undefined} />
  ),
});

function Routes() {
  const { loading, session, profile } = useSession();
  if (loading) return null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !profile}>
        <Stack.Screen name="finish-setup" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !!profile}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post/[id]" options={pushed('Post')} />
        <Stack.Screen name="user/[username]" options={pushed('Profile')} />
        <Stack.Screen name="story/[username]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="highlight/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="messages/index" options={pushed('Messages')} />
        <Stack.Screen name="messages/[username]" options={pushed('Message')} />
        <Stack.Screen name="settings/index" options={pushed('Settings')} />
        <Stack.Screen name="settings/blocked" options={pushed('Blocked accounts')} />
        <Stack.Screen name="settings/archive" options={pushed('Archive')} />
        <Stack.Screen name="settings/muted" options={pushed('Muted accounts')} />
        <Stack.Screen name="settings/liked" options={pushed('Posts you\'ve liked')} />
        <Stack.Screen name="series/[id]" options={pushed('Series')} />
        <Stack.Screen name="collections/index" options={pushed('Collections')} />
        <Stack.Screen name="collections/[id]" options={pushed('Collection')} />
        <Stack.Screen name="settings/status" options={pushed('Account status')} />
        <Stack.Screen name="settings/notes" options={pushed('Your notes')} />
        <Stack.Screen name="settings/week" options={pushed('Your week')} />
        <Stack.Screen name="edit-profile" options={pushed('Edit profile')} />
        <Stack.Screen name="tag/[tag]" options={pushed('Hashtag')} />
        <Stack.Screen name="connections/[username]" options={pushed('People')} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { scheme } = useTheme();
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Routes />
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
