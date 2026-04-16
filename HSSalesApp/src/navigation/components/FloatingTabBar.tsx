import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import React, { useContext, useLayoutEffect } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '../../theme/designSystem';
import {
  TAB_BAR_ICON_DIAMETER,
  TAB_BAR_PILL_BORDER_RADIUS,
  TAB_BAR_PILL_EDGE_INSET,
  TAB_BAR_PILL_HEIGHT,
  TAB_BAR_PILL_WIDTH_RATIO,
} from '../tabBarMetrics';

const TAB_BAR_PILL_WIDTH: DimensionValue = `${Math.round(
  TAB_BAR_PILL_WIDTH_RATIO * 100,
)}%`;

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const onTabBarHeight = useContext(BottomTabBarHeightCallbackContext);

  useLayoutEffect(() => {
    onTabBarHeight?.(0);
    return () => onTabBarHeight?.(0);
  }, [onTabBarHeight]);

  return (
    <View pointerEvents="box-none" style={styles.safe}>
      <View style={[styles.pillWrap, { marginBottom: insets.bottom }]}>
        <View style={styles.pill}>
          {state.routes.map((route) => {
            const { options } = descriptors[route.key];
            const isFocused = state.routes[state.index]?.key === route.key;
            const label = options.title ?? route.name;
            const color = isFocused ? palette.text : palette.tabBarInactive;
            const icon = options.tabBarIcon?.({
              focused: isFocused,
              color,
              size: Math.round(TAB_BAR_ICON_DIAMETER * 0.48),
            });

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tab}>
                <View
                  style={[styles.iconSlot, isFocused && styles.iconSlotActive]}>
                  {icon}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: 'transparent',
  },
  pillWrap: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: TAB_BAR_PILL_HEIGHT,
    width: TAB_BAR_PILL_WIDTH,
    maxWidth: 360,
    paddingHorizontal: TAB_BAR_PILL_EDGE_INSET,
    borderRadius: TAB_BAR_PILL_BORDER_RADIUS,
    backgroundColor: palette.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.stroke,
    ...Platform.select({
      ios: {
        shadowColor: '#0D1B11',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  /** Intrinsic width (~icon diameter) so `space-between` gaps are even; no `flex:1` slack on ends. */
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: {
    width: TAB_BAR_ICON_DIAMETER,
    height: TAB_BAR_ICON_DIAMETER,
    borderRadius: TAB_BAR_ICON_DIAMETER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlotActive: {
    backgroundColor: palette.emeraldLight,
  },
});
