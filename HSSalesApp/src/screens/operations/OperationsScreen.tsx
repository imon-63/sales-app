import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as usersApi from '../../api/users';
import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useT } from '../../i18n/useT';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';
import { showToast } from '../../store/slices/uiSlice';

export function OperationsScreen() {
  const t = useT();
  const dispatch = useAppDispatch();
  const tabBottomPad = useTabScreenBottomPadding();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newUserExpanded, setNewUserExpanded] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  function toggleNewUserFold() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNewUserExpanded((v) => !v);
  }

  const nameError = useMemo(() => {
    if (!newName.trim()) return t('operations.errNameRequired');
    return null;
  }, [newName, t]);

  const emailError = useMemo(() => {
    if (!newEmail.trim()) return t('operations.errEmailRequired');
    if (!newEmail.includes('@')) return t('operations.errEmailInvalid');
    return null;
  }, [newEmail, t]);

  const passwordError = useMemo(() => {
    if (!newPassword) return t('operations.errPasswordRequired');
    if (newPassword.length < 6) return t('operations.errPasswordShort');
    return null;
  }, [newPassword, t]);

  const confirmError = useMemo(() => {
    if (newPassword !== confirmPassword) return t('operations.errConfirmMismatch');
    return null;
  }, [confirmPassword, newPassword, t]);

  const canSubmit =
    role === 'admin' &&
    !!token &&
    !nameError &&
    !emailError &&
    !passwordError &&
    !confirmError &&
    !busy;

  async function onAddSalesUser() {
    if (!canSubmit || !token) return;
    try {
      setBusy(true);
      const res = await usersApi.createSalesUser(
        {
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          email: newEmail.trim(),
          password: newPassword,
        },
        token,
      );
      dispatch(
        showToast({
          title: t('operations.toastUserAddedTitle'),
          message: t('operations.toastUserAddedMsg', { email: res.user.email }),
          type: 'success',
        }),
      );
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : '';
      dispatch(
        showToast({
          title: t('operations.toastUserFailTitle'),
          message: msg || t('operations.toastUserFailMsg'),
          type: 'error',
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <MeshBackground>
      <SafeAreaView
        style={styles.safe}
        edges={['top']}>
        <ScreenHeader title={t('operations.title')} />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: tabBottomPad }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {role !== 'admin' ? (
              <GlassCard>
                <Text style={styles.cardTitle}>{t('operations.adminOnly')}</Text>
              </GlassCard>
            ) : (
              <GlassCard>
                <Pressable
                  onPress={toggleNewUserFold}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: newUserExpanded }}
                  accessibilityHint={t('operations.newUserFoldHint')}
                  style={({ pressed }) => [styles.foldHeader, pressed ? styles.foldHeaderPressed : null]}>
                  <Text style={styles.cardTitle}>{t('operations.newUserTitle')}</Text>
                  <Text style={styles.foldChevron} importantForAccessibility="no">
                    {newUserExpanded ? '▾' : '▸'}
                  </Text>
                </Pressable>

                {newUserExpanded ? (
                  <View>
                    <Text style={styles.label}>{t('operations.name')}</Text>
                    <TextInput
                      value={newName}
                      onChangeText={setNewName}
                      placeholder={t('operations.namePh')}
                      placeholderTextColor={palette.textMuted}
                      style={[styles.input, nameError ? styles.inputError : null]}
                      editable={!busy}
                    />
                    {!!nameError && <Text style={styles.fieldError}>{nameError}</Text>}

                    <Text style={[styles.label, styles.labelSpaced]}>{t('operations.phone')}</Text>
                    <TextInput
                      value={newPhone}
                      onChangeText={setNewPhone}
                      placeholder={t('operations.phonePh')}
                      placeholderTextColor={palette.textMuted}
                      keyboardType="phone-pad"
                      style={styles.input}
                      editable={!busy}
                    />

                    <Text style={[styles.label, styles.labelSpaced]}>{t('operations.email')}</Text>
                    <TextInput
                      value={newEmail}
                      onChangeText={setNewEmail}
                      placeholder={t('operations.emailPh')}
                      placeholderTextColor={palette.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      style={[styles.input, emailError ? styles.inputError : null]}
                      editable={!busy}
                    />
                    {!!emailError && <Text style={styles.fieldError}>{emailError}</Text>}

                    <Text style={[styles.label, styles.labelSpaced]}>{t('operations.password')}</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder={t('operations.passwordPh')}
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
                        <Text style={styles.toggleText}>
                          {showPassword ? t('login.hide') : t('login.show')}
                        </Text>
                      </Pressable>
                    </View>
                    {!!passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}

                    <Text style={[styles.label, styles.labelSpaced]}>{t('operations.confirm')}</Text>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder={t('operations.confirmPh')}
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
                        <Text style={styles.primaryText}>{t('operations.addUser')}</Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </GlassCard>
            )}

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
  foldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginHorizontal: -4,
    marginTop: -2,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: radii.sm,
  },
  foldHeaderPressed: { opacity: 0.85 },
  foldChevron: {
    color: palette.textMuted,
    fontSize: 18,
    fontWeight: '900',
    minWidth: 26,
    textAlign: 'center',
  },
  cardTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
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
});
