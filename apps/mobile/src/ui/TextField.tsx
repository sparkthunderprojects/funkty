import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { useTheme } from '../theme';

type Props = TextInputProps & { label: string; error?: string | null };

export function TextField({ label, error, style, ...input }: Props) {
  const { colors, radius, spacing, fontSize } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.caption, fontWeight: '600' }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        {...input}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.md,
            fontSize: fontSize.body,
            paddingHorizontal: spacing.md,
          },
          style,
        ]}
      />
      {error ? (
        <Text style={{ color: colors.danger, fontSize: fontSize.caption }}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, minHeight: 52 },
});
