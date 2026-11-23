import { Text } from 'react-native';
import { useTheme } from '../theme';

/** "123/150" that appears once you are within 20% of the limit, and turns red at the limit. */
export function CharCount({ value, max }: { value: string; max: number }) {
  const { colors } = useTheme();
  if (value.length < max * 0.8) return null;
  const full = value.length >= max;
  return (
    <Text
      accessibilityLabel={`${value.length} of ${max} characters`}
      style={{ color: full ? colors.danger : colors.textMuted, fontSize: 12, textAlign: 'right' }}
    >
      {value.length}/{max}
    </Text>
  );
}
