import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radii } from '../../theme/designSystem';

type Props = {
  title: string;
  subtitle?: string;
  tag?: string;
  /** Shown on the right of the title row (e.g. overflow actions). */
  right?: React.ReactNode;
};

export function ScreenHeader({ title, subtitle, tag, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.content, right ? styles.contentWithRight : null]}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {!!tag && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          )}
        </View>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  content: {
    flex: 1,
    minWidth: 0,
    paddingRight: 64, // Safeguard for the Menu Hub
  },
  contentWithRight: {
    paddingRight: 8,
  },
  right: {
    flexShrink: 0,
    marginTop: 6,
    marginLeft: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    flexShrink: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    marginTop: 6,
    color: palette.textMuted,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  tag: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.35)',
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
  },
  tagText: {
    color: palette.violet,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
