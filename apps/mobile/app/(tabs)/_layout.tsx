import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { Text } from 'react-native';
import { useTheme } from '../../src/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { profile } = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const check = () =>
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .is('read_at', null)
        .then(({ count }) => setUnread(count ?? 0));
    void check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [profile]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 28 }}>⌂</Text>,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 28 }}>⌕</Text>,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 28 }}>⊕</Text>,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 28 }}>♡</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 28 }}>☺</Text>,
        }}
      />
    </Tabs>
  );
}
