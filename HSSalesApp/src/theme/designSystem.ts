/**
 * Forest Night — deep dark-green canvas with vivid #22C55E accent.
 * Premium trading-dashboard feel: near-black greens, glowing emerald highlights.
 */
export const palette = {
  /** Near-black green canvas layers */
  void:      '#060C08',
  deep:      '#091410',
  night:     '#0E1D14',
  paper:     '#142819',
  highlight: '#1A3320',

  mist:   'rgba(34, 197, 94, 0.06)',
  glass:  'rgba(6, 12, 8, 0.97)',
  stroke: 'rgba(34, 197, 94, 0.18)',

  /** Text — warm white with green tint */
  text:       '#ECFDF5',
  textMuted:  'rgba(134, 239, 172, 0.62)',
  textLabel:  'rgba(167, 243, 208, 0.80)',

  /** Primary accent — vivid emerald green */
  emerald:      '#22C55E',
  emeraldLight: 'rgba(34, 197, 94, 0.14)',
  emeraldDeep:  '#16A34A',

  /** Secondary — lighter spring green */
  violet: '#86EFAC',
  amber:  'rgba(34, 197, 94, 0.07)',
  cyan:   'rgba(134, 239, 172, 0.10)',

  rose:    '#F43F5E',
  success: '#22C55E',
  danger:  '#F43F5E',

  calendarEventDot: '#22C55E',
  calendarDotDeep:  '#16A34A',

  /** Near-black text on vivid green buttons */
  onAccent: '#021206',

  tabBar:         'rgba(6, 12, 8, 0.98)',
  tabBarInactive: 'rgba(134, 239, 172, 0.38)',

  chipSelectedBorder: 'rgba(34, 197, 94, 0.32)',
  chipSelectedFill:   'rgba(34, 197, 94, 0.12)',
  chipAltBorder:      'rgba(134, 239, 172, 0.26)',
  chipAltFill:        'rgba(134, 239, 172, 0.09)',

  inputInset: 'rgba(3, 8, 4, 0.94)',

  cardBg:           'rgba(10, 20, 13, 0.93)',
  cardBgElevated:   'rgba(14, 28, 18, 0.96)',
  cardBgPrimary:    'rgba(18, 36, 22, 0.97)',
  cardBorder:       'rgba(34, 197, 94, 0.12)',
  cardBorderAccent: 'rgba(134, 239, 172, 0.24)',
} as const;

export const radii = {
  sm: 14,
  md: 20,
  lg: 28,
  xl: 32,
} as const;

export const shadows = {
  card: {
    shadowColor: '#22C55E',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} as const;

/** Login sheet */
export const loginLight = {
  canvas:        '#060C08',
  glow:          'rgba(34, 197, 94, 0.30)',
  glowSoft:      'rgba(34, 197, 94, 0.10)',
  sheet:         '#0E1D14',
  text:          '#ECFDF5',
  textMuted:     'rgba(134, 239, 172, 0.62)',
  hairline:      'rgba(34, 197, 94, 0.18)',
  inputFill:     '#091410',
  segmentTrack:  '#091410',
  segmentActive: '#0E1D14',
  primary:       '#22C55E',
  primaryDeep:   '#16A34A',
  primaryTint:   'rgba(34, 197, 94, 0.14)',
  link:          '#86EFAC',
  danger:        '#F43F5E',
} as const;
