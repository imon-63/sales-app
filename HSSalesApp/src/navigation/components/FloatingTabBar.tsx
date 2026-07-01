import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import React, { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Animated,
  Easing,
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

const TAB_BAR_PILL_WIDTH: DimensionValue = Platform.OS === 'android'
  ? `${Math.round((TAB_BAR_PILL_WIDTH_RATIO + 0.12) * 100)}%`
  : `${Math.round(TAB_BAR_PILL_WIDTH_RATIO * 100)}%`;

// ── Animated tab item ─────────────────────────────────────────────────────────

function TabItem({
  isFocused,
  icon,
  label,
  onPress,
  onLongPress,
}: {
  isFocused: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useRef(new Animated.Value(isFocused ? 1.18 : 1)).current;
  const glowOpacity = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const dotScale = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: isFocused ? 1.22 : 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: isFocused ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(dotScale, {
        toValue: isFocused ? 1 : 0,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFocused, scale, glowOpacity, dotScale]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}>

      {/* Glow ring behind icon */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            opacity: glowOpacity,
            transform: [{ scale }],
          },
        ]}
      />

      {/* Icon */}
      <Animated.View
        style={[
          styles.iconSlot,
          isFocused && styles.iconSlotActive,
          { transform: [{ scale }] },
        ]}>
        {icon}
      </Animated.View>

      {/* Active dot indicator */}
      <Animated.View
        style={[
          styles.dot,
          { transform: [{ scale: dotScale }], opacity: dotScale },
        ]}
      />
    </Pressable>
  );
}

// ── Pill bar ──────────────────────────────────────────────────────────────────

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const onTabBarHeight = useContext(BottomTabBarHeightCallbackContext);

  useLayoutEffect(() => {
    onTabBarHeight?.(0);
    return () => onTabBarHeight?.(0);
  }, [onTabBarHeight]);

  return (
    <View pointerEvents="box-none" style={styles.safe}>
      <View style={[styles.pillWrap, { marginBottom: insets.bottom + 6 }]}>
        <View style={styles.pill}>
          {state.routes.map((route) => {
            const { options } = descriptors[route.key];
            const isFocused = state.routes[state.index]?.key === route.key;
            const label = options.title ?? route.name;
            const color = isFocused ? palette.emerald : palette.tabBarInactive;
            const icon = options.tabBarIcon?.({
              focused: isFocused,
              color,
              size: Math.round(TAB_BAR_ICON_DIAMETER * 0.50),
            });

            return (
              <TabItem
                key={route.key}
                isFocused={isFocused}
                icon={icon}
                label={label}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              />
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
    paddingHorizontal: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: TAB_BAR_PILL_HEIGHT + 6,
    width: TAB_BAR_PILL_WIDTH,
    maxWidth: Platform.OS === 'android' ? 440 : 380,
    paddingHorizontal: TAB_BAR_PILL_EDGE_INSET + 4,
    borderRadius: TAB_BAR_PILL_BORDER_RADIUS + 4,
    backgroundColor: palette.night,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.22)',
    ...Platform.select({
      ios: {
        shadowColor: '#22C55E',
        shadowOpacity: 0.28,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 18 },
      default: {},
    }),
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  glowRing: {
    position: 'absolute',
    width: TAB_BAR_ICON_DIAMETER + 10,
    height: TAB_BAR_ICON_DIAMETER + 10,
    borderRadius: (TAB_BAR_ICON_DIAMETER + 10) / 2,
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.30)',
  },
  iconSlot: {
    width: TAB_BAR_ICON_DIAMETER,
    height: TAB_BAR_ICON_DIAMETER,
    borderRadius: TAB_BAR_ICON_DIAMETER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlotActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#22C55E',
        shadowOpacity: 0.65,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: palette.emerald,
    marginTop: 3,
    shadowColor: palette.emerald,
    shadowOpacity: 0.90,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
