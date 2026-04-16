import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radii } from '../../theme/designSystem';

type Props = {
  label: string;
  value: string;
  hint?: string;
  accent: string;
};

export function KpiTile({ label, value, hint, accent }: Props) {
  return (
    <View style={[styles.wrap, { borderColor: accent }]}>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: '46%',
    borderRadius: radii.md,
    borderWidth: 1,
    backgroundColor: palette.paper,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    opacity: 0.95,
  },
  label: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    marginTop: 8,
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  hint: {
    marginTop: 6,
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
