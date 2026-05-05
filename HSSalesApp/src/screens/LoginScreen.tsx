import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import * as authApi from '../api/auth';
import { HSLogo } from '../components/HSLogo';
import { MeshBackground } from '../components/ui/MeshBackground';
import { persistAppLocale } from '../i18n/localeStorage';
import { useT } from '../i18n/useT';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSession } from '../store/slices/authSlice';
import { setLocale, showToast } from '../store/slices/uiSlice';
import { loginLight, palette, radii } from '../theme/designSystem';

const primaryRipple =
  Platform.OS === 'android' ? { color: 'rgba(10,15,13,0.35)', borderless: false } : undefined;

export function LoginScreen() {
  const dispatch = useAppDispatch();
  const locale = useAppSelector((s) => s.ui.locale);
  const t = useT();

  const [email, setEmail] = useState('admin@hs.com');
  const [password, setPassword] = useState('admin123');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const emailError = useMemo(() => {
    if (!email.trim()) return t('login.errRequired');
    if (!email.includes('@')) return t('login.errEmail');
    return null;
  }, [email, t]);

  const passwordError = useMemo(() => {
    if (!password) return t('login.errRequired');
    if (password.length < 6) return t('login.errPassword');
    return null;
  }, [password, t]);

  const canSubmit = !emailError && !passwordError && !isLoading;

  async function onSignIn() {
    if (!canSubmit) return;

    try {
      setIsLoading(true);
      const res = await authApi.login({ email: email.trim(), password });
      dispatch(setSession({ token: res.token, user: res.user }));
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : '';
      dispatch(
        showToast({
          title: t('login.toastFailTitle'),
          message: msg || t('login.toastFailMsg'),
          type: 'error',
        }),
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <MeshBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <HSLogo
                variant="brand"
                size={168}
                motto={t('login.motto')}
                style={styles.logo}
              />
              <View style={styles.langTextRow}>
                <Pressable
                  onPress={async () => {
                    dispatch(setLocale('en'));
                    await persistAppLocale('en');
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 4 }}
                  accessibilityRole="link"
                  accessibilityState={{ selected: locale === 'en' }}>
                  <Text
                    style={[styles.langPlain, locale === 'en' ? styles.langPlainActive : null]}
                    numberOfLines={1}>
                    {t('account.languageEn')}
                  </Text>
                </Pressable>
                <Text style={styles.langPlainSep}>·</Text>
                <Pressable
                  onPress={async () => {
                    dispatch(setLocale('bn'));
                    await persistAppLocale('bn');
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 4, right: 8 }}
                  accessibilityRole="link"
                  accessibilityState={{ selected: locale === 'bn' }}>
                  <Text
                    style={[styles.langPlain, locale === 'bn' ? styles.langPlainActive : null]}
                    numberOfLines={1}>
                    {t('account.languageBn')}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.sheet}>
              <View
                style={[
                  styles.inputShell,
                  emailError ? styles.inputShellError : null,
                ]}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('login.emailPh')}
                  placeholderTextColor={loginLight.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  importantForAutofill="yes"
                  autoComplete="email"
                  style={styles.input}
                  editable={!isLoading}
                  returnKeyType="next"
                />
              </View>
              {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}

              <View
                style={[
                  styles.inputShell,
                  styles.inputShellSpaced,
                  passwordError ? styles.inputShellError : null,
                ]}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('login.passwordPh')}
                  placeholderTextColor={loginLight.textMuted}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  importantForAutofill="yes"
                  autoComplete="password"
                  style={styles.input}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={onSignIn}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={12}
                  android_ripple={{ color: 'rgba(0,230,118,0.12)', borderless: true }}
                  style={styles.eyeHit}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? t('login.a11yHidePassword') : t('login.a11yShowPassword')
                  }>
                  <Text style={styles.eyeText}>
                    {showPassword ? t('login.hide') : t('login.show')}
                  </Text>
                </Pressable>
              </View>
              {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}

              <View style={styles.rowBetween}>
                <Pressable
                  onPress={() => setRememberMe((v) => !v)}
                  android_ripple={{ color: 'rgba(0,230,118,0.12)', borderless: false }}
                  style={styles.rememberRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}>
                  <View
                    style={[
                      styles.checkbox,
                      rememberMe ? styles.checkboxOn : null,
                    ]}>
                    {rememberMe ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.rememberText}>{t('login.remember')}</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={onSignIn}
                disabled={!canSubmit}
                android_ripple={primaryRipple}
                style={({ pressed }) => [
                  styles.primary,
                  !canSubmit ? styles.primaryDisabled : null,
                  pressed && canSubmit ? styles.primaryPressed : null,
                ]}>
                {isLoading ? (
                  <ActivityIndicator color={palette.onAccent} />
                ) : (
                  <Text
                    style={styles.primaryText}
                    numberOfLines={1}
                    includeFontPadding={Platform.OS === 'android' ? false : undefined}>
                    {t('login.logIn')}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    width: '100%',
    paddingTop: 28,
    paddingBottom: 24,
  },
  hero: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
    minHeight: 272,
  },
  logo: {
    marginBottom: 4,
  },
  langTextRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
  },
  langPlain: {
    fontSize: 15,
    fontWeight: '600',
    color: loginLight.textMuted,
  },
  langPlainActive: {
    color: loginLight.primary,
    fontWeight: '800',
  },
  langPlainSep: {
    marginHorizontal: 10,
    fontSize: 15,
    color: loginLight.textMuted,
    opacity: 0.45,
    fontWeight: '600',
  },
  sheet: {
    marginTop: 8,
    marginHorizontal: 22,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 8,
    alignSelf: 'stretch',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: loginLight.hairline,
    backgroundColor: loginLight.inputFill,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  inputShellSpaced: {
    marginTop: 12,
  },
  inputShellError: {
    borderColor: loginLight.danger,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.select({ ios: 16, android: 15, default: 15 }),
    fontSize: 17,
    color: loginLight.text,
    fontWeight: '600',
  },
  eyeHit: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  eyeText: {
    color: loginLight.link,
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 6,
    color: loginLight.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  rowBetween: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 8,
    borderRadius: radii.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: loginLight.hairline,
    backgroundColor: 'rgba(10,25,16,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: loginLight.primary,
    backgroundColor: loginLight.primaryTint,
  },
  checkMark: {
    color: loginLight.primary,
    fontSize: 14,
    fontWeight: '900',
    marginTop: -1,
  },
  rememberText: {
    marginLeft: 10,
    color: loginLight.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  primary: {
    marginTop: 22,
    alignSelf: 'stretch',
    width: '100%',
    height: 56,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: loginLight.primary,
    ...Platform.select({
      ios: {
        shadowColor: loginLight.primaryDeep,
        shadowOpacity: 0.4,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 14 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  primaryPressed: {
    backgroundColor: loginLight.primaryDeep,
  },
  primaryText: {
    color: palette.onAccent,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: 0.3,
    textAlign: 'center',
    ...Platform.select({
      android: { textAlignVertical: 'center' as const },
      default: {},
    }),
  },
});
