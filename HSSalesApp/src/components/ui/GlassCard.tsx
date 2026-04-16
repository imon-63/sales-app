import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { palette, radii, shadows } from '../../theme/designSystem';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function GlassCard({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.glass,
    borderColor: palette.stroke,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
    ...shadows.card,
  },
});
