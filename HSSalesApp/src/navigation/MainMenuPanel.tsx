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
    navigation.navigate(screen);
    onClose();
  }

  function onSignOut() {
    onClose();
    dispatch(clearSession());
  }

  const filteredItems = items.filter((it) => !it.adminOnly || role === 'admin');

  return (
    <ScrollView
      style={styles.drawer}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}>
      
      <View style={styles.header}>
        <HSLogo variant="brand" size={100} style={styles.menuLogo} />
        <View style={styles.brandColumn}>
          <View style={styles.brandTopRow}>
            <Text style={styles.brandTitle} numberOfLines={1}>
              HS Sales
            </Text>
            <Pressable
              onPress={onSignOut}
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
              style={({ pressed }) => [
                styles.signOutHeader,
                pressed && styles.signOutHeaderPressed,
              ]}>
              <Text style={styles.signOutHeaderText}>{t('menu.signOut')}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.gridContainer}>
        <Text style={styles.sectionHeader}>{t('menu.section')}</Text>
        <View style={styles.grid}>
          {filteredItems.map((it) => (
            <Pressable
              key={it.key}
              onPress={() => go(it.screen)}
              style={({ pressed }) => [
                styles.tile,
                pressed && styles.tilePressed,
                role === 'admin' ? styles.adminTile : styles.salesTile
              ]}>
              <View style={styles.tileIconBg}>
                <Text style={styles.tileIcon}>{it.icon}</Text>
              </View>
              <Text style={styles.tileLabel}>{t(it.labelKey)}</Text>
            </Pressable>
          ))}
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
    paddingTop: 24,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLogo: { flexShrink: 0 },
  brandColumn: { flex: 1, minWidth: 0, justifyContent: 'center' },
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.35)',
    backgroundColor: 'rgba(255, 82, 82, 0.08)',
  },
  signOutHeaderPressed: { backgroundColor: 'rgba(255, 82, 82, 0.15)' },
  signOutHeaderText: {
    color: palette.rose,
    fontWeight: '900',
    fontSize: 13,
  },
  gridContainer: {
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  tile: {
    width: '47.8%',
    aspectRatio: 1,
    borderRadius: radii.xl,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: palette.glass,
  },
  adminTile: { borderColor: 'rgba(0, 230, 118, 0.2)' },
  salesTile: { borderColor: 'rgba(105, 240, 174, 0.2)' },
  tilePressed: { opacity: 0.7, scale: 0.98 } as any,
  tileIconBg: {
    width: 54,
    height: 54,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  tileIcon: { fontSize: 28 },
  tileLabel: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
});
