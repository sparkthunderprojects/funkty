import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { ActionSheet } from './ActionSheet';

/** Location and website lines. Opening a website asks first, because it leaves Funkty. */
export function ProfileLines({ location, website }: { location?: string | null; website?: string | null }) {
  const { colors, fontSize, spacing } = useTheme();
  const [confirm, setConfirm] = useState(false);
  if (!location && !website) return null;
  const host = website ? website.replace(/^https:\/\//, '').replace(/\/$/, '') : '';
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.sm }}>
      {location ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Feather name="map-pin" size={14} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>{location}</Text>
        </View>
      ) : null}
      {website ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open ${host}`}
          onPress={() => setConfirm(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 220 }}
        >
          <Feather name="link" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: fontSize.caption, fontWeight: '600' }} numberOfLines={1}>
            {host}
          </Text>
        </Pressable>
      ) : null}
      <ActionSheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        actions={[
          { label: `Leave Funkty and open ${host}`, onPress: () => void Linking.openURL(website as string) },
          { label: 'Cancel', onPress: () => undefined },
        ]}
      />
    </View>
  );
}

