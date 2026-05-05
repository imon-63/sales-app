import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useT } from '../../i18n/useT';
import { persistAppLocale } from '../../i18n/localeStorage';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearSession } from '../../store/slices/authSlice';
import { setLocale, type AppLocale } from '../../store/slices/uiSlice';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';

export function AccountScreen() {
  const t = useT();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const locale = useAppSelector((s) => s.ui.locale);
  const tabBottomPad = useTabScreenBottomPadding();

  async function pickLanguage(next: AppLocale) {
    dispatch(setLocale(next));
    await persistAppLocale(next);
  }

  const roleLabel =
    user?.role === 'admin'
      ? t('account.role_admin')
      : user?.role === 'sales'
        ? t('account.role_sales')
        : user?.role ?? '';

  return (
    <MeshBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('account.title')} tag={t('account.tagProfile')} />

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: tabBottomPad }]}
          showsVerticalScrollIndicator={false}>
          <GlassCard>
            <Text style={styles.label}>{t('account.email')}</Text>
            <Text style={styles.value}>{user?.email}</Text>

            <View style={{ height: 14 }} />

            <Text style={styles.label}>{t('account.role')}</Text>
            <Text style={styles.value}>{roleLabel}</Text>
          </GlassCard>

          <GlassCard style={styles.langCard}>
            <Text style={styles.label}>{t('account.language')}</Text>
            <View style={styles.langTextRow}>
              <Pressable
                onPress={() => pickLanguage('en')}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 4 }}
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
                onPress={() => pickLanguage('bn')}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 6 }}
                accessibilityRole="link"
                accessibilityState={{ selected: locale === 'bn' }}>
                <Text
                  style={[styles.langPlain, locale === 'bn' ? styles.langPlainActive : null]}
                  numberOfLines={1}>
                  {t('account.languageBn')}
                </Text>
              </Pressable>
            </View>
          </GlassCard>

          <Pressable
            onPress={() => dispatch(clearSession())}
            style={({ pressed }) => [
              styles.logout,
              pressed ? { opacity: 0.85 } : null,
            ]}>
            <Text style={styles.logoutText}>{t('account.signOut')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { paddingHorizontal: 20, gap: 14, paddingTop: 6 },
  label: {
    color: palette.textLabel,
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
  langCard: { marginTop: 0 },
  langTextRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  langPlain: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textMuted,
  },
  langPlainActive: {
    color: palette.emerald,
    fontWeight: '800',
  },
  langPlainSep: {
    marginHorizontal: 10,
    fontSize: 15,
    color: palette.textMuted,
    opacity: 0.45,
    fontWeight: '600',
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
