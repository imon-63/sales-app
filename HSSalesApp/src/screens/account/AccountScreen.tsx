import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearSession } from '../../store/slices/authSlice';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';

export function AccountScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const tabBottomPad = useTabScreenBottomPadding();

  return (
    <MeshBackground>
      <SafeAreaView
        style={[styles.safe, { paddingBottom: tabBottomPad }]}
        edges={['top']}>
        <ScreenHeader
          title="Your identity"
          subtitle="A crisp profile surface — sign out cleanly when you’re done for the day."
          tag="Account"
        />

        <View style={styles.body}>
          <GlassCard>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email}</Text>

            <View style={{ height: 14 }} />

            <Text style={styles.label}>Role</Text>
            <Text style={styles.value}>{user?.role}</Text>
          </GlassCard>

          <Pressable
            onPress={() => dispatch(clearSession())}
            style={({ pressed }) => [
              styles.logout,
              pressed ? { opacity: 0.85 } : null,
            ]}>
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { paddingHorizontal: 20, gap: 14, paddingTop: 6 },
  label: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    marginTop: 8,
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },
  logout: {
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.45)',
    backgroundColor: 'rgba(248,113,113,0.10)',
  },
  logoutText: { color: palette.text, fontWeight: '900', fontSize: 15 },
});
