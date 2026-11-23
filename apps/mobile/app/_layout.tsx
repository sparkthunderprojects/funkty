import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../src/lib/session';

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
        <Stack.Screen name="post/[id]" options={{ headerShown: true, title: 'Post' }} />
        <Stack.Screen name="user/[username]" options={{ headerShown: true, title: 'Profile' }} />
        <Stack.Screen name="story/[username]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="messages/index" options={{ headerShown: true, title: 'Messages' }} />
        <Stack.Screen name="messages/[username]" options={{ headerShown: true, title: 'Message' }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: true, title: 'Edit profile' }} />
        <Stack.Screen name="tag/[tag]" options={{ headerShown: true, title: 'Hashtag' }} />
        <Stack.Screen name="connections/[username]" options={{ headerShown: true, title: 'People' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Routes />
        <StatusBar style="auto" />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
