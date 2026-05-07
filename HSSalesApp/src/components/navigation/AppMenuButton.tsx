import React from 'react';
import { useNavigationState } from '@react-navigation/native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '../../theme/designSystem';
import { useAppSelector } from '../../store/hooks';
import { selectUnreadNotificationCount } from '../../store/slices/notificationsSlice';

type Props = {
  onPress: () => void;
};

export function AppMenuButton({ onPress }: Props) {
  const insets = useSafeAreaInsets();
  const unreadCount = useAppSelector(selectUnreadNotificationCount);
  const activeRoute = useNavigationState((state) => {
    let cur: any = state;
    while (cur?.routes?.[cur.index ?? 0]?.state) {
      cur = cur.routes[cur.index ?? 0].state;
    }
    return cur?.routes?.[cur?.index ?? 0]?.name;
  });
  const isDashboard =
    activeRoute === 'AdminHome' ||
    activeRoute === 'SalesHome' ||
    activeRoute === 'Work';
  const activeMenu =
    activeRoute === 'StockRoom'
      ? { icon: '▦', label: 'Stock' }
      : activeRoute === 'ReceiveStock'
        ? { icon: '↓', label: 'Purchase' }
        : activeRoute === 'TransferStock'
          ? { icon: '↔', label: 'Move' }
          : { icon: '⌂', label: 'Home' };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open menu. Current: ${activeMenu.label}. ${unreadCount} unread signals.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        isDashboard ? null : styles.fabWide,
        isDashboard ? null : styles.fabWideTight,
        { top: insets.top + 6 },
        pressed ? styles.fabPressed : null,
      ]}>
      <View style={styles.homeChip}>
        <Text style={styles.homeIcon}>{activeMenu.icon}</Text>
      </View>
      <Text style={styles.homeText}>{activeMenu.label}</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText} allowFontScaling={false}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    zIndex: 9999,
    minWidth: 56,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
    backgroundColor: 'rgba(27, 119, 49, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(208, 247, 193, 0.20)',
    paddingHorizontal: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.16,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  fabWide: {
    minWidth: 70,
    height: 26,
    paddingHorizontal: 2,
    borderRadius: 11,
  },
  fabWideTight: {
    gap: 1,
  },
  fabPressed: { opacity: 0.8 },
  homeChip: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  homeIcon: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 0,
    lineHeight: 13,
  },
  homeText: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.rose,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.paper,
    paddingHorizontal: 2,
  },
  badgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '900',
  },
});
