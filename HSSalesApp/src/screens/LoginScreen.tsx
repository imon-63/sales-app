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

import * as authApi from '../api/auth';
import { HSLogo } from '../components/HSLogo';
import { useAppDispatch } from '../store/hooks';
import { setSession } from '../store/slices/authSlice';
import { loginLight } from '../theme/designSystem';

export function LoginScreen() {
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState('admin@hs.com');
  const [password, setPassword] = useState('admin123');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const emailError = useMemo(() => {
    if (!email.trim()) return 'Email is required';
    if (!email.includes('@')) return 'Enter a valid email';
    return null;
  }, [email]);

  const passwordError = useMemo(() => {
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return null;
  }, [password]);

  const canSubmit = !emailError && !passwordError && !isLoading;

  async function onSignIn() {
    if (!canSubmit) return;

    try {
      setIsLoading(true);
      const res = await authApi.login({ email: email.trim(), password });
      dispatch(setSession({ token: res.token, user: res.user }));
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={[styles.glow, styles.glowTop]} />
      <View pointerEvents="none" style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <HSLogo size={108} style={styles.logo} />
              <Text style={styles.title}>Access HS Sales</Text>
              <Text style={styles.subtitle}>
                Sign in with the account your administrator issued. New sales teammates are
                added from the admin Operations screen — not here.
              </Text>
            </View>

            <View style={styles.sheet}>
              <Text style={styles.sheetEyebrow}>Sign in</Text>

              <Text style={styles.fieldLabel}>Email</Text>
              <View
                style={[
                  styles.inputShell,
                  emailError ? styles.inputShellError : null,
                ]}>
                <Text style={styles.inputIcon} accessibilityLabel="Email">
                  ✉
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter email address"
                  placeholderTextColor={loginLight.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  style={styles.input}
                  editable={!isLoading}
                  returnKeyType="next"
                />
              </View>
              {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}

              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Password</Text>
              <View
                style={[
                  styles.inputShell,
                  passwordError ? styles.inputShellError : null,
                ]}>
                <Text style={styles.inputIcon} accessibilityLabel="Password">
                  🔒
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={loginLight.textMuted}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  style={styles.input}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={onSignIn}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={12}
                  style={styles.eyeHit}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                  <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
              {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}

              <View style={styles.rowBetween}>
                <Pressable
                  onPress={() => setRememberMe((v) => !v)}
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
                  <Text style={styles.rememberText}>Remember me</Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    Alert.alert(
                      'Forgot password',
                      'Password reset will be available once your API is connected.',
                    )
                  }
                  hitSlop={8}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={onSignIn}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.primary,
                  !canSubmit ? styles.primaryDisabled : null,
                  pressed && canSubmit ? styles.primaryPressed : null,
                ]}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryText}>Sign in</Text>
                )}
              </Pressable>

              <Text style={styles.footer}>
                Demo admins: admin@hs.com / admin123 · Need a sales login? Use Ops → Add sales
                person while signed in as admin.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: loginLight.canvas,
  },
  glow: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 999,
  },
  glowTop: {
    top: -120,
    right: -90,
    backgroundColor: loginLight.glow,
    opacity: 0.9,
  },
  glowBottom: {
    bottom: -140,
    left: -110,
    backgroundColor: loginLight.glowSoft,
    opacity: 1,
  },
  flex: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingBottom: 18,
  },
  hero: {
    paddingHorizontal: 26,
    paddingTop: 8,
    alignItems: 'center',
  },
  logo: {
    marginBottom: 18,
  },
  title: {
    textAlign: 'center',
    color: loginLight.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 10,
    color: loginLight.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    paddingHorizontal: 10,
    maxWidth: 360,
  },
  sheet: {
    flex: 1,
    marginTop: 22,
    marginHorizontal: 0,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 26,
    backgroundColor: loginLight.sheet,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.05)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 },
    elevation: 10,
  },
  sheetEyebrow: {
    alignSelf: 'flex-start',
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: loginLight.segmentTrack,
    color: loginLight.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: loginLight.text,
    marginBottom: 8,
  },
  fieldLabelSpaced: {
    marginTop: 16,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: loginLight.hairline,
    backgroundColor: loginLight.inputFill,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputShellError: {
    borderColor: loginLight.danger,
  },
  inputIcon: {
    width: 28,
    textAlign: 'center',
    fontSize: 16,
    color: loginLight.textMuted,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.select({ ios: 14, android: 12, default: 12 }),
    fontSize: 15,
    color: loginLight.text,
    fontWeight: '600',
  },
  eyeHit: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  eyeText: {
    color: loginLight.link,
    fontSize: 13,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 6,
    color: loginLight.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  rowBetween: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: loginLight.hairline,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: loginLight.primary,
    backgroundColor: loginLight.primaryTint,
  },
  checkMark: {
    color: loginLight.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
    marginTop: -1,
  },
  rememberText: {
    marginLeft: 10,
    color: loginLight.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  forgotText: {
    color: loginLight.link,
    fontSize: 13,
    fontWeight: '800',
  },
  primary: {
    marginTop: 22,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: loginLight.primary,
    shadowColor: loginLight.primaryDeep,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  primaryDisabled: {
    opacity: 0.55,
  },
  primaryPressed: {
    backgroundColor: loginLight.primaryDeep,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  footer: {
    marginTop: 16,
    textAlign: 'center',
    color: loginLight.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
});
