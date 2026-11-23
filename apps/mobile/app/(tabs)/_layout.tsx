import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { Avatar } from '../../src/ui/Avatar';
import { tabBarHeight, useTabBarOffset } from '../../src/ui/layout';
import { useTheme } from '../../src/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { profile } = useSession();
  const offset = useTabBarOffset();
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('profiles')
      .select('avatar:media_assets!profiles_avatar_media_fk(storage_key)')
      .eq('id', profile.id)
      .maybeSingle()
      .then(({ data }) => setAvatar((data as unknown as { avatar: { storage_key: string } | null } | null)?.avatar?.storage_key ?? null));
  }, [profile]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false,
        // A floating pill: it sits above the content, so screens add bottom padding with useTabBarSpace().
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: offset,
          height: tabBarHeight,
          borderRadius: tabBarHeight / 2,
          backgroundColor: colors.card,
          borderTopWidth: 0,
          paddingBottom: 0,
          paddingTop: 0,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        },
        tabBarItemStyle: { height: tabBarHeight, alignItems: 'center', justifyContent: 'center' },
        // Without a label the icon would hug the top of its item, so give it the full height and centre it.
        tabBarIconStyle: { height: tabBarHeight, width: 48, alignItems: 'center', justifyContent: 'center' },
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
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ color }) => <Feather name="plus-square" size={25} color={String(color)} />,
        }}
      />
      <Tabs.Screen name="activity" options={{ title: 'Activity', href: null }} />
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'film' : 'film-outline'} size={25} color={String(color)} />,
        }}
      />
      <Tabs.Screen name="inbox" options={{ title: 'Messages', href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <View style={{ borderWidth: focused ? 2 : 0, borderColor: colors.primary, borderRadius: 16, padding: focused ? 1 : 0 }}>
              <Avatar username={profile?.username ?? '?'} storageKey={avatar} size={focused ? 24 : 26} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
