import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HSLogo } from '../components/HSLogo';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearSession } from '../store/slices/authSlice';
import { palette, radii } from '../theme/designSystem';

import type { MainStackParamList } from './mainStackTypes';

type NavKey = keyof MainStackParamList;

type NavItem = {
  key: string;
  label: string;
  hint: string;
  screen: NavKey;
  adminOnly?: boolean;
};

const items: NavItem[] = [
  {
    key: 'work',
    label: 'Workspace',
    hint: 'Tabs · home, sales, calendar',
    screen: 'Work',
  },
  {
    key: 'stock',
    label: 'Stock room',
    hint: 'On-hand by warehouse',
    screen: 'StockRoom',
  },
  {
    key: 'receive',
    label: 'Receive stock',
    hint: 'Inbound purchase → lots',
    screen: 'ReceiveStock',
    adminOnly: true,
  },
  {
    key: 'transfer',
    label: 'Move stock',
    hint: 'Transfer between warehouses',
    screen: 'TransferStock',
    adminOnly: true,
  },
];

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList>;
  onClose: () => void;
};

export function MainMenuPanel({ navigation, onClose }: Props) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const role = user?.role;

  function go(screen: NavKey) {
    navigation.navigate(screen);
    onClose();
  }

  function onSignOut() {
    onClose();
    dispatch(clearSession());
  }

  return (
    <ScrollView
      style={styles.drawer}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled">
      <View style={styles.brand}>
        <HSLogo size={52} />
        <Text style={styles.brandTitle}>HS Sales</Text>
        <Text style={styles.brandSub}>Retail POS · inventory aware</Text>
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaLabel}>Signed in</Text>
        <Text style={styles.metaEmail}>{user?.email}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{role}</Text>
        </View>
      </View>

      <Text style={styles.section}>Menu</Text>
      {items
        .filter((it) => !it.adminOnly || role === 'admin')
        .map((it) => (
          <Pressable
            key={it.key}
            onPress={() => go(it.screen)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Text style={styles.rowTitle}>{it.label}</Text>
            <Text style={styles.rowHint}>{it.hint}</Text>
          </Pressable>
        ))}

      <View style={styles.spacer} />

      <Pressable
        onPress={onSignOut}
        style={({ pressed }) => [styles.signOut, pressed && styles.rowPressed]}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  drawer: { backgroundColor: palette.paper, maxHeight: '88%' },
  scroll: { paddingBottom: 28, paddingTop: 8 },
  brand: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: palette.stroke,
  },
  brandTitle: {
    marginTop: 12,
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  brandSub: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  meta: {
    marginTop: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  metaLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metaEmail: {
    marginTop: 6,
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  rolePill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.chipSelectedBorder,
    backgroundColor: palette.chipSelectedFill,
  },
  roleText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  section: {
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 20,
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: {
    marginHorizontal: 12,
    marginBottom: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.glass,
  },
  rowPressed: { opacity: 0.9 },
  rowTitle: { color: palette.text, fontSize: 16, fontWeight: '900' },
  rowHint: { marginTop: 4, color: palette.textMuted, fontSize: 12, fontWeight: '600' },
  spacer: { minHeight: 24 },
  signOut: {
    marginHorizontal: 12,
    paddingVertical: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.45)',
    backgroundColor: 'rgba(248,113,113,0.10)',
    alignItems: 'center',
  },
  signOutText: { color: palette.text, fontWeight: '900', fontSize: 15 },
});
