import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { palette } from '../theme/designSystem';

type Props = {
  size?: number;
  style?: ViewStyle;
};

/**
 * Monogram mark: soft white “jewel” frame + brand accent core + subtle highlight.
 * Accent: lime core from the app palette; monogram in forest for contrast.
 */
export function HSLogo({ size = 96, style }: Props) {
  const outerR = size / 2;
  const inset = Math.max(6, Math.round(size * 0.07));
  const innerSize = size - inset * 2;
  const innerR = innerSize / 2;
  const fontSize = Math.round(innerSize * 0.36);

  return (
    <View
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: outerR,
        },
        style,
      ]}>
      <View
        style={[
          styles.inner,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerR,
          },
        ]}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -Math.round(innerSize * 0.08),
            left: -Math.round(innerSize * 0.05),
            width: Math.round(innerSize * 0.72),
            height: Math.round(innerSize * 0.42),
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.28)',
            transform: [{ rotate: '-28deg' }],
          }}
        />
        <Text style={[styles.mark, { fontSize, lineHeight: fontSize + 2 }]}>HS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  inner: {
    backgroundColor: palette.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  mark: {
    color: palette.text,
    fontWeight: '900',
    letterSpacing: -1.5,
    textShadowColor: 'rgba(255,255,255,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
