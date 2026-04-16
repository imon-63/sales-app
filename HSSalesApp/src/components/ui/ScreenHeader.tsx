import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radii } from '../../theme/designSystem';

type Props = {
  title: string;
  subtitle: string;
  tag?: string;
};

export function ScreenHeader({ title, subtitle, tag }: Props) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {!!tag && (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },
  title: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 6,
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    maxWidth: 320,
  },
  tag: {
    marginLeft: 12,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.highlight,
  },
  tagText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
