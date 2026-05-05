import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radii } from '../../theme/designSystem';
import { useAppSelector } from '../../store/hooks';
import { selectUnreadNotificationCount } from '../../store/slices/notificationsSlice';

type Props = {
  onPress: () => void;
};

export function AppMenuButton({ onPress }: Props) {
  const insets = useSafeAreaInsets();
  const unreadCount = useAppSelector(selectUnreadNotificationCount);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open menu. ${unreadCount} unread signals.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { top: insets.top + 6 },
        pressed ? styles.fabPressed : null,
      ]}>
      <Text style={styles.icon}>☰</Text>
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.stroke,
    ...Platform.select({
      ios: {
        shadowColor: '#00E676',
        shadowOpacity: 0.15,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  fabPressed: { opacity: 0.8 },
  icon: {
    color: palette.emerald,
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: -1,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
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
