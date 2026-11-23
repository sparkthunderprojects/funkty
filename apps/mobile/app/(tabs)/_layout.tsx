import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { Avatar } from '../../src/ui/Avatar';
import { useTheme } from '../../src/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const [unreadDms, setUnreadDms] = useState(0);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const check = () =>
      supabase.rpc('inbox').then(({ data }) => setUnreadDms((data ?? []).reduce((n, c) => n + Number(c.unread), 0)));
    void check();
    const timer = setInterval(check, 30000);
    supabase
      .from('profiles')
      .select('avatar:media_assets!profiles_avatar_media_fk(storage_key)')
      .eq('id', profile.id)
      .maybeSingle()
      .then(({ data }) => setAvatar((data as unknown as { avatar: { storage_key: string } | null } | null)?.avatar?.storage_key ?? null));
    return () => clearInterval(timer);
  }, [profile]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={26} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'search' : 'search-outline'} size={26} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => <Feather name="plus-square" size={25} color={String(color)} />,
        }}
      />
      <Tabs.Screen name="activity" options={{ title: 'Activity', href: null }} />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Messages',
          tabBarBadge: unreadDms > 0 ? unreadDms : undefined,
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'paper-plane' : 'paper-plane-outline'} size={25} color={String(color)} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/messages');
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <View style={{ borderWidth: focused ? 2 : 0, borderColor: colors.text, borderRadius: 16, padding: focused ? 1 : 0 }}>
              <Avatar username={profile?.username ?? '?'} storageKey={avatar} size={focused ? 24 : 26} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
