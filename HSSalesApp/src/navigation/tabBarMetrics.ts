import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Must stay aligned with `FloatingTabBar` layout (outer pill height). */
export const TAB_BAR_PILL_HEIGHT = 48;
/** Gap between pill inner edge and tab highlight (top/bottom/sides). */
export const TAB_BAR_PILL_EDGE_INSET = 3;
/** Diameter of the icon / active highlight circle — nearly full bar height. */
export const TAB_BAR_ICON_DIAMETER =
  TAB_BAR_PILL_HEIGHT - 2 * TAB_BAR_PILL_EDGE_INSET;
/** Capsule corners: half of bar height. */
export const TAB_BAR_PILL_BORDER_RADIUS = TAB_BAR_PILL_HEIGHT / 2;
/** Fraction of screen width for the pill (rest is side margin). */
export const TAB_BAR_PILL_WIDTH_RATIO = 0.8;
export const TAB_BAR_CONTENT_GAP = 10;

/**
 * Bottom inset for scroll roots so content clears the floating tab bar
 * (pill + spacing + device home indicator).
 */
export function useTabScreenBottomPadding() {
  const { bottom } = useSafeAreaInsets();
  return TAB_BAR_PILL_HEIGHT + TAB_BAR_CONTENT_GAP + bottom;
}
