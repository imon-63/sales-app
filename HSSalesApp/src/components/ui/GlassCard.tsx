import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { palette, radii, shadows } from '../../theme/designSystem';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accentColor?: string;
};

export function GlassCard({ children, style, accentColor }: Props) {
  return (
    <View style={[styles.card, style]}>
      {!!accentColor && (
        <View style={[styles.accent, { backgroundColor: accentColor }]} />
      )}
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.cardBg,
    borderColor: palette.cardBorder,
    borderWidth: 1,
    borderRadius: radii.lg,
    ...shadows.card,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 8,
    borderTopLeftRadius: radii.lg,
    borderBottomLeftRadius: radii.lg,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  inner: {
    padding: 16,
  },
});
