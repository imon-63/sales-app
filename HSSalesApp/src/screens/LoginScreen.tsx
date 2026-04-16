import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as authApi from '../api/auth';
import { HSLogo } from '../components/HSLogo';
import { colors } from '../theme/colors';

export function LoginScreen() {
  const [email, setEmail] = useState('eve.holt@reqres.in');
  const [password, setPassword] = useState('cityslicka');
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

  async function onLogin() {
    if (!canSubmit) return;

    try {
      setIsLoading(true);
      const res = await authApi.login({ email: email.trim(), password });
      Alert.alert('Login (demo)', `Token: ${res.token}`);
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <HSLogo size={104} style={styles.logo} />
          <Text style={styles.title}>HS Sales</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              style={[styles.input, emailError ? styles.inputError : null]}
              editable={!isLoading}
              returnKeyType="next"
            />
            {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}

            <Text style={[styles.label, styles.labelTop]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              textContentType="password"
              style={[styles.input, passwordError ? styles.inputError : null]}
              editable={!isLoading}
              returnKeyType="done"
              onSubmitEditing={onLogin}
            />
            {!!passwordError && (
              <Text style={styles.errorText}>{passwordError}</Text>
            )}

            <Pressable
              onPress={onLogin}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.button,
                !canSubmit ? styles.buttonDisabled : null,
                pressed && canSubmit ? styles.buttonPressed : null,
              ]}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </Pressable>

            <Text style={styles.hint}>
              Demo API: reqres.in (replace later in `src/api/auth.ts`)
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  logo: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  title: {
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 6,
    color: colors.mutedText,
  },
  form: {
    marginTop: 28,
  },
  label: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: 8,
  },
  labelTop: {
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 14, android: 12, default: 12 }),
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    marginTop: 6,
    color: colors.error,
  },
  button: {
    marginTop: 20,
    backgroundColor: colors.green,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    backgroundColor: colors.greenDark,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  hint: {
    marginTop: 12,
    textAlign: 'center',
    color: colors.mutedText,
    fontSize: 12,
  },
});

