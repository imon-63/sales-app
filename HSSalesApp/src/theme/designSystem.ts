/**
 * Organic travel-style palette: warm cream canvas, soft mint sections,
 * deep forest typography, and pear–lime accents (gradient approximated with
 * emerald / emeraldLight / emeraldDeep on buttons and chips).
 */
export const palette = {
  /** Main screen canvas (warm off-white) */
  void: '#F3F4ED',
  /** Slightly cooler band / depth */
  deep: '#ECEFE8',
  /** Mint-tint panels & cards */
  night: '#E4EBE2',
  /** Lifted sheet / modals */
  paper: '#FEFEF6',
  /** Soft yellow highlight tiles */
  highlight: '#FFF9C4',

  mist: 'rgba(13, 27, 17, 0.06)',
  glass: 'rgba(255, 255, 255, 0.9)',
  stroke: 'rgba(13, 27, 17, 0.1)',

  /** Forest green — primary text & “dark” UI chrome */
  text: '#0D1B11',
  textMuted: 'rgba(13, 27, 17, 0.48)',

  /** Lime CTA (center of the reference gradient) */
  emerald: '#C5DE7A',
  emeraldLight: '#E2F0B0',
  emeraldDeep: '#A4C45A',

  /** Sage secondary (charts / alternate chips) */
  violet: '#9AAC8F',
  amber: '#FFF3B0',
  cyan: '#DDE8E0',
  rose: '#D9736A',
  success: '#6B8E78',
  /** Pulse / calendar: marking dots on days with sales */
  calendarEventDot: '#1B4D3E',
  /** Multi-dot under days — deeper forest for contrast on paper */
  calendarDotDeep: '#083D30',
  danger: '#C24C4C',

  /** Text on lime / yellow buttons */
  onAccent: '#0D1B11',

  /** Floating tab bar */
  tabBar: 'rgba(255, 255, 255, 0.94)',
  tabBarInactive: 'rgba(13, 27, 17, 0.36)',

  /** Selected pills (product / warehouse chips) */
  chipSelectedBorder: 'rgba(130, 152, 80, 0.45)',
  chipSelectedFill: 'rgba(200, 222, 140, 0.38)',
  chipAltBorder: 'rgba(110, 140, 125, 0.42)',
  chipAltFill: 'rgba(210, 228, 218, 0.45)',

  /** Inputs on light panels */
  inputInset: 'rgba(255, 255, 255, 0.72)',
} as const;

export const radii = {
  sm: 14,
  md: 20,
  lg: 28,
  xl: 32,
} as const;

export const shadows = {
  card: {
    shadowColor: '#0D1B11',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

/** Login sheet — same family as in-app surfaces */
export const loginLight = {
  canvas: '#F3F4ED',
  glow: 'rgba(197, 222, 122, 0.35)',
  glowSoft: 'rgba(197, 222, 122, 0.18)',
  sheet: '#FEFEF6',
  text: '#0D1B11',
  textMuted: 'rgba(13, 27, 17, 0.48)',
  hairline: 'rgba(13, 27, 17, 0.1)',
  inputFill: '#F5F7F1',
  segmentTrack: '#E4EBE2',
  segmentActive: '#FFFFFF',
  primary: '#C5DE7A',
  primaryDeep: '#A4C45A',
  primaryTint: 'rgba(197, 222, 122, 0.22)',
  link: '#2D4A38',
  danger: '#C24C4C',
} as const;
