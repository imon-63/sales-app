/**
 * Electric Sky-Blue + Hot Amber on near-black.
 * Maximum contrast, premium trading-dashboard feel.
 */
export const palette = {
  /** Near-black canvas */
  void: '#01070F',
  deep: '#020C1C',
  night: '#03152A',
  paper: '#051E3C',
  highlight: '#072850',

  mist: 'rgba(0, 168, 255, 0.08)',
  glass: 'rgba(1, 7, 15, 0.96)',
  stroke: 'rgba(0, 168, 255, 0.20)',

  /** Primary text — icy blue-white */
  text: '#E8F5FF',
  textMuted: 'rgba(130, 185, 225, 0.76)',
  textLabel: 'rgba(110, 168, 215, 0.90)',

  /** Primary accent — electric sky blue */
  emerald: '#00A8FF',
  emeraldLight: 'rgba(0, 168, 255, 0.15)',
  emeraldDeep: '#007ACC',

  /** Secondary accent — hot amber/gold */
  violet: '#FFB300',
  amber: 'rgba(0, 168, 255, 0.08)',
  cyan: 'rgba(255, 179, 0, 0.12)',
  rose: '#FF3B5C',
  success: '#00D68F',
  calendarEventDot: '#00A8FF',
  calendarDotDeep: '#007ACC',
  danger: '#FF3B5C',

  /** Text on blue CTA buttons */
  onAccent: '#000C1A',

  tabBar: 'rgba(1, 8, 18, 0.97)',
  tabBarInactive: 'rgba(130, 185, 225, 0.44)',

  chipSelectedBorder: 'rgba(0, 168, 255, 0.32)',
  chipSelectedFill: 'rgba(0, 168, 255, 0.12)',
  chipAltBorder: 'rgba(255, 179, 0, 0.28)',
  chipAltFill: 'rgba(255, 179, 0, 0.10)',

  inputInset: 'rgba(0, 5, 14, 0.93)',

  cardBg: 'rgba(2, 14, 34, 0.93)',
  cardBgElevated: 'rgba(3, 20, 46, 0.96)',
  cardBgPrimary: 'rgba(4, 28, 60, 0.97)',
  cardBorder: 'rgba(0, 168, 255, 0.14)',
  cardBorderAccent: 'rgba(255, 179, 0, 0.32)',
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
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
} as const;

/** Login sheet */
export const loginLight = {
  canvas: '#01070F',
  glow: 'rgba(0, 168, 255, 0.24)',
  glowSoft: 'rgba(0, 168, 255, 0.10)',
  sheet: '#051E3C',
  text: '#E8F5FF',
  textMuted: 'rgba(130, 185, 225, 0.76)',
  hairline: 'rgba(0, 168, 255, 0.20)',
  inputFill: '#03152A',
  segmentTrack: '#020C1C',
  segmentActive: '#03152A',
  primary: '#00A8FF',
  primaryDeep: '#007ACC',
  primaryTint: 'rgba(0, 168, 255, 0.15)',
  link: '#FFB300',
  danger: '#FF3B5C',
} as const;
