/**
 * Dark-mode green-priority palette: deep forest canvas (green-tinted, not neutral black),
 * vibrant neon-green accents, dark glassmorphism, premium feel.
 */
export const palette = {
  /** Main screen canvas — dark green that pairs with emerald accents */
  void: '#0A1814',
  /** Slightly deeper band / depth */
  deep: '#0E221A',
  /** Dark green panels & cards */
  night: '#152A1F',
  /** Lifted sheet / modals */
  paper: '#1E3428',
  /** Subtle green highlight tiles */
  highlight: '#0F3A22',

  mist: 'rgba(0, 230, 118, 0.08)',
  /** Surfaces behind type — higher opacity for legibility */
  glass: 'rgba(24, 48, 34, 0.94)',
  stroke: 'rgba(140, 255, 190, 0.22)',

  /** Primary body / titles — high contrast on dark green */
  text: '#F4FBF6',
  /** Secondary copy — still WCAG-friendly on void/glass */
  textMuted: 'rgba(215, 240, 225, 0.82)',
  /** Form labels, table headers — between text and muted */
  textLabel: 'rgba(195, 228, 208, 0.92)',

  /** Neon green CTA (primary accent) */
  emerald: '#00E676',
  emeraldLight: 'rgba(0, 230, 118, 0.18)',
  emeraldDeep: '#00C853',

  /** Mint secondary accent (charts / alternate chips) */
  violet: '#69F0AE',
  amber: 'rgba(0, 230, 118, 0.08)',
  cyan: 'rgba(0, 200, 83, 0.12)',
  rose: '#FF5252',
  success: '#00E676',
  /** Calendar: marking dots on days with sales */
  calendarEventDot: '#00E676',
  /** Multi-dot — brighter for contrast on dark */
  calendarDotDeep: '#69F0AE',
  danger: '#FF5252',

  /** Text on neon green buttons */
  onAccent: '#0A0F0D',

  /** Floating tab bar */
  tabBar: 'rgba(22, 48, 34, 0.97)',
  tabBarInactive: 'rgba(200, 235, 215, 0.52)',

  /** Selected pills (product / warehouse chips) */
  chipSelectedBorder: 'rgba(0, 230, 118, 0.35)',
  chipSelectedFill: 'rgba(0, 230, 118, 0.12)',
  chipAltBorder: 'rgba(105, 240, 174, 0.30)',
  chipAltFill: 'rgba(105, 240, 174, 0.10)',

  /** Inputs on dark panels */
  inputInset: 'rgba(12, 30, 20, 0.88)',
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
  canvas: '#0A1814',
  glow: 'rgba(0, 230, 118, 0.25)',
  glowSoft: 'rgba(0, 230, 118, 0.12)',
  sheet: '#1E3428',
  text: '#F4FBF6',
  textMuted: 'rgba(215, 240, 225, 0.82)',
  hairline: 'rgba(140, 255, 190, 0.22)',
  inputFill: '#152A1F',
  segmentTrack: '#0F1A14',
  segmentActive: '#1A2F22',
  primary: '#00E676',
  primaryDeep: '#00C853',
  primaryTint: 'rgba(0, 230, 118, 0.18)',
  link: '#69F0AE',
  danger: '#FF5252',
} as const;
