import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '../theme/designSystem';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearSession } from '../store/slices/authSlice';
import type { MainStackParamList } from './mainStackTypes';

// ── Profile bottom sheet (replaces the old slide-from-right sidebar) ──────────

export function useAppSideMenu() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const dispatch   = useAppDispatch();
  const insets     = useSafeAreaInsets();
  const user = useAppSelector((s) => s.auth.user);
  const role = user?.role;

  const [open, setOpen]       = useState(false);
  const [visible, setVisible] = useState(false);
  const slideY = useRef(new Animated.Value(480)).current;
  const fade   = useRef(new Animated.Value(0)).current;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      setVisible(true);
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0,
          tension: 76,
          friction: 13,
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: 480,
        duration: 230,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [open, slideY, fade]);

  const menuModal = useMemo(
    () => (
      <Modal
        visible={visible}
        animationType="none"
        transparent
        onRequestClose={close}
        presentationStyle="overFullScreen">

        {/* Dimmed backdrop — tap anywhere to close */}
        <Animated.View style={[ps.backdrop, { opacity: fade }]}>
          <Pressable style={ps.dismissHit} onPress={close} accessibilityLabel="Close profile" />
        </Animated.View>

        {/* Bottom sheet */}
        <Animated.View
          style={[
            ps.sheet,
            {
              paddingBottom: insets.bottom + 20,
              transform: [{ translateY: slideY }],
            },
          ]}>

          {/* Drag handle */}
          <View style={ps.handle} />

          {/* User identity */}
          <View style={ps.userCard}>
            <View style={ps.avatarCircle}>
              <Text style={ps.avatarInitial}>
                {(user?.name?.trim()?.[0] ?? 'H').toUpperCase()}
              </Text>
              <View style={ps.onlineDot} />
            </View>
            <View style={ps.userMeta}>
              <Text style={ps.userName} numberOfLines={1}>
                {user?.name?.trim() || 'HS User'}
              </Text>
              <View style={[ps.rolePill, role === 'admin' ? ps.roleAdmin : ps.roleSales]}>
                <Text style={ps.roleText}>
                  {role === 'admin' ? '★ Admin' : '◈ Sales Rep'}
                </Text>
              </View>
            </View>
          </View>

          <View style={ps.divider} />

          {/* Home action */}
          <Pressable
            onPress={() => {
              close();
              requestAnimationFrame(() => {
                navigation.reset({ index: 0, routes: [{ name: 'Work' }] });
              });
            }}
            style={({ pressed }) => [ps.actionRow, pressed && ps.actionPressed]}>
            <View style={ps.actionIconBox}>
              <Text style={ps.actionIconText}>⌂</Text>
            </View>
            <Text style={ps.actionLabel}>Home</Text>
            <Text style={ps.actionChevron}>›</Text>
          </Pressable>

          {/* Sign out */}
          <Pressable
            onPress={() => { close(); dispatch(clearSession()); }}
            style={({ pressed }) => [ps.signOutRow, pressed && ps.actionPressed]}>
            <View style={ps.signOutIconBox}>
              <Text style={ps.signOutIconText}>⎋</Text>
            </View>
            <Text style={ps.signOutLabel}>Sign Out</Text>
          </Pressable>
        </Animated.View>
      </Modal>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, close, navigation, user, role, insets.bottom, slideY, fade, dispatch],
  );

  return {
    menuModal,
    openMenu:  () => setOpen(true),
    closeMenu: close,
  };
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const ps = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
  },
  dismissHit: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(34, 197, 94, 0.22)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.30,
        shadowRadius: 32,
        shadowOffset: { width: 0, height: -8 },
      },
      android: { elevation: 24 },
      default: {},
    }),
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(34, 197, 94, 0.38)',
    alignSelf: 'center',
    marginBottom: 22,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.50)',
    shadowColor: '#22C55E',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: palette.paper,
  },
  userMeta: { flex: 1, gap: 7 },
  userName: {
    color: palette.text,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  roleAdmin: {
    backgroundColor: 'rgba(255, 214, 10, 0.12)',
    borderColor: 'rgba(255, 214, 10, 0.38)',
  },
  roleSales: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  roleText: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 6,
    borderRadius: 16,
  },
  actionPressed: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconText: { color: palette.text, fontSize: 18 },
  actionLabel: { flex: 1, color: palette.text, fontSize: 16, fontWeight: '800' },
  actionChevron: { color: palette.textMuted, fontSize: 24, fontWeight: '700' },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 6,
    borderRadius: 16,
    marginTop: 2,
  },
  signOutIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(244, 63, 94, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutIconText: { color: palette.rose, fontSize: 18 },
  signOutLabel: { color: palette.rose, fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
});
