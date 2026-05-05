import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { palette } from '../theme/designSystem';

const BRAND = require('../assets/hs-brand-logo.png');

/** Shown along an arc inside the circular mark (not as a separate block above). */
const ARC_NAME = 'Homaira Siddika Enterprise';

/**
 * Trig angles: 0° = right, 90° = down — arc hugs the bottom-right rim.
 * Start > end so text runs “backwards” along the arc: Homaira begins on the left, reads toward the right.
 */
const ARC_BR_START = 108;
const ARC_BR_END = 12;

/** Arc on brand PNG: soft warm white + deep forest shadow (reads on varied artwork). */
const ARC_TEXT_ON_IMAGE = {
  color: palette.text,
  textShadow: {
    textShadowColor: 'rgba(6, 22, 14, 0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
} as const;

/** Arc on emerald disk: crisp white + neutral depth (avoids washed mint-on-green). */
const ARC_TEXT_ON_EMERALD = {
  color: '#FFFFFF',
  textShadow: {
    textShadowColor: 'rgba(8, 24, 16, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
} as const;

type Props = {
  size?: number;
  style?: ViewStyle;
  /** Official HS mark (PNG). Default keeps the lightweight monogram for small chrome. */
  variant?: 'monogram' | 'brand';
  /** Tagline under the brand mark. */
  motto?: string;
};

type ArcChar = { char: string; angle: number };

/** Angular gap between words along the arc (relative to one letter = 1). */
const ARC_SPACE_UNITS = 0.58;

function buildArcPlacements(
  text: string,
  startDeg: number,
  endDeg: number,
): ArcChar[] {
  const chars = text.split('');
  const totalUnits = chars.reduce((acc, c) => acc + (c === ' ' ? ARC_SPACE_UNITS : 1), 0);
  const start = (startDeg * Math.PI) / 180;
  const span = ((endDeg - startDeg) * Math.PI) / 180;
  const placements: ArcChar[] = [];
  let u = 0;
  for (const char of chars) {
    if (char === ' ') {
      u += ARC_SPACE_UNITS;
      continue;
    }
    const angle = start + (u / totalUnits) * span;
    placements.push({ char, angle });
    u += 1;
  }
  return placements;
}

function CircularArcText({
  text,
  diameter,
  radius,
  startDeg,
  endDeg,
  fontSize,
  color,
  textShadow,
}: {
  text: string;
  diameter: number;
  radius: number;
  startDeg: number;
  endDeg: number;
  fontSize: number;
  color: string;
  textShadow?: {
    textShadowColor: string;
    textShadowOffset: { width: number; height: number };
    textShadowRadius: number;
  };
}) {
  const cx = diameter / 2;
  const cy = diameter / 2;
  const placements = useMemo(
    () => buildArcPlacements(text, startDeg, endDeg),
    [text, startDeg, endDeg],
  );
  const arcRunsBackward = endDeg < startDeg;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.arcLayer, { width: diameter, height: diameter }]}>
      {placements.map(({ char, angle }, i) => {
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        const rotateDeg = (angle * 180) / Math.PI + (arcRunsBackward ? -90 : 90);
        const w = Math.max(fontSize * 0.62, 8);
        const h = Math.max(fontSize * 1.15, 10);
        return (
          <View
            key={`${i}-${char}`}
            style={[
              styles.arcCharBox,
              {
                left: x - w / 2,
                top: y - h / 2,
                width: w,
                height: h,
                transform: [{ rotate: `${rotateDeg}deg` }],
              },
            ]}>
            <Text
              style={[
                styles.arcCharText,
                {
                  fontSize,
                  color,
                  lineHeight: fontSize + 1,
                  ...textShadow,
                },
              ]}>
              {char}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * App mark: either the official brand artwork or the compact HS monogram.
 */
export function HSLogo({ size = 96, style, variant = 'monogram', motto }: Props) {
  if (variant === 'brand') {
    const d = size;
    const r = d / 2;
    const arcFont = Math.max(5.5, Math.min(10.5, d / (ARC_NAME.replace(/\s/g, '').length * 0.52)));
    const arcRadius = (d / 2) * 0.8;

    return (
      <View style={[styles.brandColumn, style]}>
        <View style={[styles.brandMarkWrap, { width: d, height: d }]}>
          <View
            style={[
              styles.brandCircle,
              {
                width: d,
                height: d,
                borderRadius: r,
              },
            ]}>
            <Image
              source={BRAND}
              style={styles.brandImgFill}
              resizeMode="cover"
              accessibilityLabel="HS Sales"
            />
            <CircularArcText
              text={ARC_NAME}
              diameter={d}
              radius={arcRadius}
              startDeg={ARC_BR_START}
              endDeg={ARC_BR_END}
              fontSize={arcFont}
              color={ARC_TEXT_ON_IMAGE.color}
              textShadow={ARC_TEXT_ON_IMAGE.textShadow}
            />
          </View>
        </View>
        {!!motto && (
          <Text
            style={[styles.brandMotto, { maxWidth: d + 48 }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}>
            {motto}
          </Text>
        )}
      </View>
    );
  }

  const outerR = size / 2;
  const inset = Math.max(6, Math.round(size * 0.07));
  const innerSize = size - inset * 2;
  const innerR = innerSize / 2;
  const fontSize = Math.round(innerSize * 0.36);
  const arcFont = Math.max(5, Math.min(9, size / (ARC_NAME.replace(/\s/g, '').length * 0.55)));
  const arcRadius = innerR * 0.88;

  return (
    <View style={[styles.monogramWrap, { width: size, height: size }, style]}>
      <View
        style={[
          styles.outer,
          {
            width: size,
            height: size,
            borderRadius: outerR,
          },
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
              backgroundColor: 'rgba(255,255,255,0.18)',
              transform: [{ rotate: '-28deg' }],
            }}
          />
          <CircularArcText
            text={ARC_NAME}
            diameter={innerSize}
            radius={arcRadius}
            startDeg={ARC_BR_START}
            endDeg={ARC_BR_END}
            fontSize={arcFont}
            color={ARC_TEXT_ON_EMERALD.color}
            textShadow={ARC_TEXT_ON_EMERALD.textShadow}
          />
          <Text style={[styles.mark, { fontSize, lineHeight: fontSize + 2 }]}>HS</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandColumn: {
    alignItems: 'center',
  },
  brandMarkWrap: {
    position: 'relative',
    alignSelf: 'center',
  },
  monogramWrap: {
    position: 'relative',
    alignSelf: 'center',
  },
  arcLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  arcCharBox: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arcCharText: {
    fontWeight: '800',
    textAlign: 'center',
  },
  /** Flush circular crop: no inset padding, no contrasting border. */
  brandCircle: {
    overflow: 'hidden',
    backgroundColor: palette.deep,
  },
  brandImgFill: {
    width: '100%',
    height: '100%',
  },
  brandMotto: {
    marginTop: 12,
    minHeight: 48,
    textAlign: 'center',
    color: palette.textLabel,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.6,
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  outer: {
    backgroundColor: palette.paper,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.stroke,
    shadowColor: '#00E676',
    shadowOpacity: 0.2,
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
    borderColor: 'rgba(255,255,255,0.25)',
  },
  mark: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
