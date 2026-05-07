/**
 * Dark-mode green-priority palette: deep forest canvas (green-tinted, not neutral black),
 * vibrant neon-green accents, dark glassmorphism, premium feel.
 */
export const palette = {
  /** Main screen canvas — dark green that pairs with emerald accents */
  void: '#052B16',
  /** Slightly deeper band / depth */
  deep: '#07341B',
  /** Dark green panels & cards */
  night: '#0B4A24',
  /** Lifted sheet / modals */
  paper: '#0F5D2C',
  /** Subtle green highlight tiles */
  highlight: '#126A34',

  mist: 'rgba(154, 255, 120, 0.10)',
  /** Surfaces behind type — higher opacity for legibility */
  glass: 'rgba(10, 64, 32, 0.92)',
  stroke: 'rgba(188, 255, 162, 0.20)',

  /** Primary body / titles — high contrast on dark green */
  text: '#F3FFF0',
  /** Secondary copy — still WCAG-friendly on void/glass */
  textMuted: 'rgba(216, 244, 208, 0.82)',
  /** Form labels, table headers — between text and muted */
  textLabel: 'rgba(205, 236, 194, 0.92)',

  /** Neon green CTA (primary accent) */
  emerald: '#9DFF75',
  emeraldLight: 'rgba(157, 255, 117, 0.16)',
  emeraldDeep: '#61D65A',

  /** Mint secondary accent (charts / alternate chips) */
  violet: '#BFFF9F',
  amber: 'rgba(157, 255, 117, 0.08)',
  cyan: 'rgba(97, 214, 90, 0.12)',
  rose: '#FF5252',
  success: '#9DFF75',
  /** Calendar: marking dots on days with sales */
  calendarEventDot: '#9DFF75',
  /** Multi-dot — brighter for contrast on dark */
  calendarDotDeep: '#BFFF9F',
  danger: '#FF5252',

  /** Text on neon green buttons */
  onAccent: '#06290F',

  /** Floating tab bar */
  tabBar: 'rgba(8, 56, 27, 0.96)',
  tabBarInactive: 'rgba(219, 244, 210, 0.55)',

  /** Selected pills (product / warehouse chips) */
  chipSelectedBorder: 'rgba(157, 255, 117, 0.32)',
  chipSelectedFill: 'rgba(157, 255, 117, 0.12)',
  chipAltBorder: 'rgba(191, 255, 159, 0.26)',
  chipAltFill: 'rgba(191, 255, 159, 0.09)',

  /** Inputs on dark panels */
  inputInset: 'rgba(5, 45, 21, 0.90)',
} as const;

export const radii = {
  sm: 14,
  md: 20,
  lg: 28,
  xl: 32,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
} as const;

/** Login sheet — dark green family */
export const loginLight = {
  canvas: '#052B16',
  glow: 'rgba(157, 255, 117, 0.20)',
  glowSoft: 'rgba(157, 255, 117, 0.1)',
  sheet: '#0F5D2C',
  text: '#F3FFF0',
  textMuted: 'rgba(216, 244, 208, 0.82)',
  hairline: 'rgba(188, 255, 162, 0.2)',
  inputFill: '#0B4A24',
  segmentTrack: '#072E17',
  segmentActive: '#0B4A24',
  primary: '#9DFF75',
  primaryDeep: '#61D65A',
  primaryTint: 'rgba(157, 255, 117, 0.16)',
  link: '#BFFF9F',
  danger: '#FF5252',
} as const;
