import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as usersApi from '../../api/users';
import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAppSelector } from '../../store/hooks';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';

export function OperationsScreen() {
  const tabBottomPad = useTabScreenBottomPadding();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const emailError = useMemo(() => {
    if (!newEmail.trim()) return 'Email is required';
    if (!newEmail.includes('@')) return 'Enter a valid email';
    return null;
  }, [newEmail]);

  const passwordError = useMemo(() => {
    if (!newPassword) return 'Password is required';
    if (newPassword.length < 6) return 'At least 6 characters';
    return null;
  }, [newPassword]);

  const confirmError = useMemo(() => {
    if (newPassword !== confirmPassword) return 'Passwords do not match';
    return null;
  }, [confirmPassword, newPassword]);

  const canSubmit =
    role === 'admin' &&
    !!token &&
    !emailError &&
    !passwordError &&
    !confirmError &&
    !busy;

  async function onAddSalesUser() {
    if (!canSubmit || !token) return;
    try {
      setBusy(true);
      const res = await usersApi.createSalesUser(
        { email: newEmail.trim(), password: newPassword },
        token,
      );
      Alert.alert(
        'Sales user added',
        `${res.user.email} can now sign in with the password you set.`,
      );
      setNewEmail('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      Alert.alert('Could not add user', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <MeshBackground>
      <SafeAreaView
        style={[styles.safe, { paddingBottom: tabBottomPad }]}
        edges={['top']}>
        <ScreenHeader
          title="Operations deck"
          subtitle="Inventory and transfers will live here. Team onboarding starts now — only admins can add sales sign-ins."
          tag="Admin"
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {role !== 'admin' ? (
              <GlassCard>
                <Text style={styles.cardTitle}>Unavailable</Text>
                <Text style={styles.cardBody}>
                  Adding sales users is restricted to administrators.
                </Text>
              </GlassCard>
            ) : (
              <GlassCard>
                <Text style={styles.cardTitle}>Add sales person</Text>
                <Text style={styles.cardBody}>
                  Creates a new account with role <Text style={styles.em}>sales</Text>. They
                  sign in on the same login screen — there is no public self‑registration.
                </Text>

                <Text style={styles.label}>Work email</Text>
                <TextInput
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="rep@company.com"
                  placeholderTextColor={palette.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  style={[styles.input, emailError ? styles.inputError : null]}
                  editable={!busy}
                />
                {!!emailError && <Text style={styles.fieldError}>{emailError}</Text>}

                <Text style={[styles.label, styles.labelSpaced]}>Temporary password</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor={palette.textMuted}
                    secureTextEntry={!showPassword}
                    style={[
                      styles.input,
                      styles.inputInRow,
                      passwordError ? styles.inputError : null,
                    ]}
                    editable={!busy}
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={10}
                    style={styles.toggle}>
                    <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>
                {!!passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}

                <Text style={[styles.label, styles.labelSpaced]}>Confirm password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  placeholderTextColor={palette.textMuted}
                  secureTextEntry={!showPassword}
                  style={[styles.input, confirmError ? styles.inputError : null]}
                  editable={!busy}
                />
                {!!confirmError && <Text style={styles.fieldError}>{confirmError}</Text>}

                <Pressable
                  onPress={onAddSalesUser}
                  disabled={!canSubmit}
                  style={({ pressed }) => [
                    styles.primary,
                    !canSubmit ? styles.primaryDisabled : null,
                    pressed && canSubmit ? styles.primaryPressed : null,
                  ]}>
                  {busy ? (
                    <ActivityIndicator color={palette.onAccent} />
                  ) : (
                    <Text style={styles.primaryText}>Create sales sign-in</Text>
                  )}
                </Pressable>
              </GlassCard>
            )}

            <GlassCard style={styles.lower}>
              <Text style={styles.cardTitle}>Designed for flow</Text>
              <Text style={styles.cardBody}>
                You’ll move lots between warehouses with audit-grade trails, reconcile stock
                instantly, and keep every SKU anchored to the right unit.
              </Text>
            </GlassCard>

            <View style={styles.grid}>
              <View style={styles.tile}>
                <Text style={styles.tileTitle}>Inventory</Text>
                <Text style={styles.tileBody}>Multi-warehouse lots, balances, alerts.</Text>
              </View>
              <View style={[styles.tile, styles.tileAlt]}>
                <Text style={styles.tileTitle}>Purchasing</Text>
                <Text style={styles.tileBody}>Inbound with landed cost tracking.</Text>
              </View>
              <View style={[styles.tile, styles.tileAlt2]}>
                <Text style={styles.tileTitle}>Transfers</Text>
                <Text style={styles.tileBody}>Move stock with split batches + traceability.</Text>
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileTitle}>Selling</Text>
                <Text style={styles.tileBody}>FIFO allocations + profit clarity.</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 28, gap: 14, paddingTop: 6 },
  cardTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  cardBody: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  em: { color: palette.emerald, fontWeight: '900' },
  label: {
    marginTop: 14,
    color: palette.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelSpaced: { marginTop: 16 },
  input: {
    marginTop: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.stroke,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 13, android: 11, default: 11 }),
    color: palette.text,
    backgroundColor: palette.inputInset,
    fontWeight: '600',
  },
  inputInRow: { flex: 1, marginTop: 0 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  inputError: { borderColor: palette.danger },
  fieldError: {
    marginTop: 6,
    color: palette.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  toggle: { marginLeft: 8, paddingVertical: 8, paddingHorizontal: 4 },
  toggleText: { color: palette.emerald, fontWeight: '800', fontSize: 13 },
  primary: {
    marginTop: 18,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: palette.emerald,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryPressed: { backgroundColor: palette.emeraldDeep },
  primaryText: { color: palette.onAccent, fontWeight: '900', fontSize: 15 },
  lower: { marginTop: 2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '48%',
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.chipSelectedBorder,
    backgroundColor: palette.chipSelectedFill,
  },
  tileAlt: {
    borderColor: 'rgba(154, 172, 143, 0.45)',
    backgroundColor: 'rgba(221, 232, 224, 0.55)',
  },
  tileAlt2: {
    borderColor: 'rgba(200, 180, 90, 0.4)',
    backgroundColor: 'rgba(255, 249, 196, 0.65)',
  },
  tileTitle: { color: palette.text, fontWeight: '900' },
  tileBody: { marginTop: 8, color: palette.textMuted, fontWeight: '600', lineHeight: 18 },
});
