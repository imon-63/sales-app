import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HSLogo } from '../components/HSLogo';
import type { TxKey } from '../i18n/en';
import { useT } from '../i18n/useT';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearSession } from '../store/slices/authSlice';
import { palette, radii } from '../theme/designSystem';

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
  { key: 'work', labelKey: 'menu.home', icon: '🏠', screen: 'Work' },
  { key: 'stock', labelKey: 'menu.stock', icon: '📦', screen: 'StockRoom' },
  {
    key: 'receive',
    labelKey: 'menu.purchase',
    icon: '📥',
    screen: 'ReceiveStock',
    adminOnly: true,
  },
  {
    key: 'transfer',
    labelKey: 'menu.move',
    icon: '🔄',
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
        <HSLogo variant="brand" size={86} style={styles.menuLogo} />
        <View style={styles.brandColumn}>
          <View style={styles.brandTopRow}>
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandTitle} numberOfLines={2}>
                {'HS\nSales'}
              </Text>
            </View>
            <Pressable
              onPress={onSignOut}
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
              style={({ pressed }) => [
                styles.signOutHeader,
                pressed && styles.signOutHeaderPressed,
              ]}>
              <View style={styles.signOutInner}>
                <View style={styles.signOutIconChip}>
                  <Text style={styles.signOutIcon}>⎋</Text>
                </View>
                <Text style={styles.signOutHeaderText}>{t('menu.signOut')}</Text>
              </View>
            </Pressable>
          </View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  drawer: { backgroundColor: palette.paper },
  scroll: { paddingBottom: 28 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLogo: { flexShrink: 0 },
  brandColumn: { flex: 1, minWidth: 0, justifyContent: 'center' },
  brandTextWrap: { flex: 1, minWidth: 0 },
  brandTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandTitle: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  signOutHeader: {
    flexShrink: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.5)',
    backgroundColor: 'rgba(255, 82, 82, 0.14)',
  },
  signOutHeaderPressed: { backgroundColor: 'rgba(255, 82, 82, 0.22)' },
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
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.4)',
  },
  signOutIcon: {
    color: palette.rose,
    fontSize: 10,
    fontWeight: '900',
  },
  signOutHeaderText: {
    color: palette.rose,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  menuSection: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 16,
    marginLeft: 4,
  },
  menuList: {
    gap: 10,
    padding: 10,
    borderTopRightRadius: radii.xl,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: radii.sm,
    borderTopLeftRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  menuRow: {
    borderTopRightRadius: radii.lg,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: radii.sm,
    borderTopLeftRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.16)',
    backgroundColor: palette.glass,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuRowPrimary: {
    borderColor: 'rgba(0, 230, 118, 0.28)',
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
  },
  menuRowPressed: { opacity: 0.8 },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuIconChip: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.2)',
  },
  menuIcon: { fontSize: 15 },
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
});
