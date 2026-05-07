import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { TxKey } from '../i18n/en';
import { useT } from '../i18n/useT';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearSession } from '../store/slices/authSlice';
import { palette } from '../theme/designSystem';

import type { MainStackParamList } from './mainStackTypes';

type MenuScreenKey = 'Work' | 'StockRoom' | 'ReceiveStock' | 'TransferStock';

type NavItem = {
  key: string;
  labelKey: TxKey;
  icon: string;
  screen: MenuScreenKey;
  adminOnly?: boolean;
};

const items: NavItem[] = [
  { key: 'work', labelKey: 'menu.home', icon: '⌂', screen: 'Work' },
  { key: 'stock', labelKey: 'menu.stock', icon: '▦', screen: 'StockRoom' },
  {
    key: 'receive',
    labelKey: 'menu.purchase',
    icon: '↓',
    screen: 'ReceiveStock',
    adminOnly: true,
  },
  {
    key: 'transfer',
    labelKey: 'menu.move',
    icon: '↔',
    screen: 'TransferStock',
    adminOnly: true,
  },
];

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList>;
  onClose: () => void;
};

export function MainMenuPanel({ navigation, onClose }: Props) {
  const t = useT();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const role = user?.role;

  function go(screen: MenuScreenKey) {
    onClose();
    requestAnimationFrame(() => {
      if (screen === 'Work') {
        // Force-reset so Home always lands on the root tab, even when already inside Work.
        navigation.reset({
          index: 0,
          routes: [{ name: 'Work' }],
        });
        return;
      }
      navigation.navigate(screen);
    });
  }

  function onSignOut() {
    onClose();
    dispatch(clearSession());
  }

  const filteredItems = items.filter((it) => !it.adminOnly || role === 'admin');
  const currentScreen = (() => {
    const state = navigation.getState();
    const active = state.routes[state.index]?.name as MenuScreenKey | string | undefined;
    if (
      active === 'Work' ||
      active === 'StockRoom' ||
      active === 'ReceiveStock' ||
      active === 'TransferStock'
    ) {
      return active;
    }
    return 'Work';
  })();

  return (
    <ScrollView
      style={styles.drawer}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.topUtilityRow}>
          <View style={styles.profileDot}>
            <Text style={styles.profileDotText}>
              {(user?.name?.trim()?.[0] ?? 'H').toUpperCase()}
            </Text>
          </View>
          <Pressable
            onPress={onSignOut}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            style={({ pressed }) => [styles.signOutHeader, pressed && styles.signOutHeaderPressed]}>
            <View style={styles.signOutInner}>
              <View style={styles.signOutIconChip}>
                <Text style={styles.signOutIcon}>⎋</Text>
              </View>
              <Text style={styles.signOutHeaderText}>{t('menu.signOut')}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionHeader}>{t('menu.section')}</Text>
        <View style={styles.menuList}>
          {filteredItems.map((it) => {
            const isActive = it.screen === currentScreen;
            return (
              <Pressable
                key={it.key}
                onPress={() => go(it.screen)}
                style={({ pressed }) => [
                  styles.menuRow,
                  isActive && styles.menuRowPrimary,
                  pressed && styles.menuRowPressed,
                ]}>
                <View style={styles.menuRowLeft}>
                  <View style={styles.menuIconChip}>
                    <Text style={styles.menuIcon}>{it.icon}</Text>
                  </View>
                  <Text style={styles.menuLabel}>{t(it.labelKey)}</Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.userFooter}>
        <View style={styles.userBadge}>
          <View style={styles.userBadgeDot}>
            <Text style={styles.userBadgeDotText}>
              {(user?.name?.trim()?.[0] ?? 'H').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userBadgeName} numberOfLines={1}>
            {user?.name?.trim() || 'HS User'}
          </Text>
          <View style={[styles.roleBadge, role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeSales]}>
            <Text style={styles.roleBadgeText}>{role === 'admin' ? 'Admin' : 'Sales'}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  drawer: { backgroundColor: palette.paper },
  scroll: { paddingBottom: 0, flexGrow: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  topUtilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  profileDot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8C643B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileDotText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  signOutHeader: {
    flexShrink: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 122, 0.52)',
    backgroundColor: 'rgba(120, 20, 20, 0.28)',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  signOutHeaderPressed: { backgroundColor: 'rgba(148, 24, 24, 0.36)' },
  signOutInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  signOutIconChip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 182, 182, 0.34)',
  },
  signOutIcon: {
    color: '#FFD0D0',
    fontSize: 10,
    fontWeight: '900',
  },
  signOutHeaderText: {
    color: '#FF8D8D',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  menuSection: {
    marginTop: 4,
    paddingHorizontal: 14,
  },
  sectionHeader: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuList: {
    gap: 6,
    padding: 0,
  },
  menuRow: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 0,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuRowPrimary: {
    backgroundColor: 'rgba(6, 74, 30, 0.95)',
    transform: [{ translateY: 1 }],
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  menuRowPressed: { opacity: 0.8 },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuIconChip: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  menuIcon: {
    fontSize: 16,
    color: 'rgba(241,255,236,0.94)',
    fontWeight: '700',
  },
  menuLabel: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
  },
  menuArrow: {
    color: palette.textMuted,
    fontSize: 20,
    fontWeight: '700',
  },
  userFooter: {
    marginTop: 'auto',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(191, 255, 159, 0.2)',
  },
  userBadgeDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(191,255,159,0.25)',
  },
  userBadgeDotText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '900',
  },
  userBadgeName: {
    flex: 1,
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  roleBadgeAdmin: {
    backgroundColor: 'rgba(255, 214, 10, 0.16)',
    borderColor: 'rgba(255, 214, 10, 0.38)',
  },
  roleBadgeSales: {
    backgroundColor: 'rgba(157, 255, 117, 0.16)',
    borderColor: 'rgba(191, 255, 159, 0.32)',
  },
  roleBadgeText: {
    color: palette.text,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
