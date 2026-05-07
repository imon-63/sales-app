import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../components/ui/GlassCard';
import { KpiTile } from '../../components/ui/KpiTile';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { useT } from '../../i18n/useT';
import { useAppSelector } from '../../store/hooks';
import { palette, radii } from '../../theme/designSystem';
import { filterSalesByRole, sumRevenueForSales } from '../../utils/sales';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';

export function SalesDashboardScreen() {
  const t = useT();
  const locale = useAppSelector((s) => s.ui.locale);
  const user = useAppSelector((s) => s.auth.user);
  const { sales, salesItems, products, warehouses, status, error } =
    useAppSelector((s) => s.salesData);

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
        style: 'currency',
        currency: 'BDT',
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const mySales = useMemo(() => {
    if (!user) return [];
    return filterSalesByRole(sales, user.role, user.id);
  }, [sales, user]);

  const saleIds = useMemo(() => new Set(mySales.map((s) => s.id)), [mySales]);
  const revenue = useMemo(
    () => sumRevenueForSales(saleIds, salesItems),
    [saleIds, salesItems],
  );

  const topSku = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of mySales) {
      for (const it of salesItems) {
        if (it.saleId !== s.id) continue;
        counts.set(it.productId, (counts.get(it.productId) ?? 0) + it.quantity);
      }
    }
    let best: { id: string; qty: number } | null = null;
    for (const [id, qty] of counts) {
      if (!best || qty > best.qty) best = { id, qty };
    }
    const name = best
      ? products.find((p) => p.id === best.id)?.name ?? t('dashboard.sales.topSkuFallback')
      : '—';
    return name;
  }, [mySales, products, salesItems, t]);

  const tabBottomPad = useTabScreenBottomPadding();

  return (
    <MeshBackground>
      <SafeAreaView
        style={styles.safe}
        edges={['top']}>
        {status === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.emerald} />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : status === 'failed' ? (
          <View style={styles.loading}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.loadingText}>{t('common.apiHint')}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: tabBottomPad }]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.profileCard}>
              <View style={styles.salesBadge}>
                <Text style={styles.salesBadgeText}>Sales</Text>
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(user?.name || 'S').charAt(0)}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user?.name || 'Sales User'}</Text>
                <Text style={styles.welcomeBack}>Welcome Back!</Text>
              </View>
            </View>

            <GlassCard style={styles.hero} accentColor={palette.emerald}>
              <View pointerEvents="none" style={styles.heroAccentRail} />
              <View pointerEvents="none" style={styles.heroOrb} />
              <Text style={styles.heroEyebrow}>{t('dashboard.sales.revenue')}</Text>
              <Text style={styles.heroBig}>{money.format(revenue)}</Text>
              <Text style={styles.heroSub}>
                {t('dashboard.sales.ordersCount', { n: mySales.length })}
              </Text>
              <View style={styles.heroRow}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>
                    {t('dashboard.sales.topSku', { name: topSku })}
                  </Text>
                </View>
                <View style={[styles.pill, styles.pillAlt]}>
                  <Text style={styles.pillText}>
                    {t('dashboard.sales.warehouses', { n: warehouses.length })}
                  </Text>
                </View>
              </View>
            </GlassCard>

            <View style={styles.kpiRow}>
              <View style={styles.kpiShell}>
                <KpiTile
                  label={t('dashboard.sales.ordersLabel')}
                  value={String(mySales.length)}
                  hint={t('dashboard.sales.ordersHint')}
                  accent={palette.emerald}
                />
              </View>
              <View style={[styles.kpiShell, styles.kpiShellAlt]}>
                <KpiTile
                  label={t('dashboard.sales.productsLabel')}
                  value={String(products.length)}
                  hint={t('dashboard.sales.productsHint')}
                  accent={palette.violet}
                />
              </View>
            </View>

            <GlassCard style={styles.next}>
              <View pointerEvents="none" style={styles.nextAccentRail} />
              <Text style={styles.nextTitle}>{t('dashboard.sales.calendarTitle')}</Text>
              <Text style={styles.nextBody}>{t('dashboard.sales.calendarBody')}</Text>
            </GlassCard>
          </ScrollView>
        )}
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 14 },
  profileCard: {
    marginLeft: 4,
    marginRight: 52,
    padding: 16,
    position: 'relative',
    borderRadius: radii.xl,
    backgroundColor: 'rgba(0, 230, 118, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.onAccent,
    fontSize: 20,
    fontWeight: '900',
  },
  userInfo: { flex: 1, gap: 2 },
  userName: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  welcomeBack: {
    marginTop: 2,
    color: '#FFD60A',
    fontSize: 14,
    fontWeight: '900',
    textShadowColor: 'rgba(255, 214, 10, 0.98)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  salesBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderTopRightRadius: radii.xl,
    borderBottomLeftRadius: radii.sm,
    backgroundColor: palette.emeraldDeep,
  },
  salesBadgeText: {
    color: palette.onAccent,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loading: {
    paddingHorizontal: 20,
    paddingTop: 30,
    gap: 10,
  },
  loadingText: { color: palette.textMuted, fontWeight: '600' },
  errorText: { color: palette.danger, fontWeight: '800' },
  hero: {
    marginTop: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(191,255,159,0.18)',
    backgroundColor: 'rgba(9, 73, 32, 0.84)',
  },
  heroAccentRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: palette.emerald,
  },
  heroOrb: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 999,
    right: -46,
    top: -32,
    backgroundColor: 'rgba(191,255,159,0.10)',
  },
  heroEyebrow: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroBig: {
    marginTop: 10,
    color: '#ECFFE5',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.3,
  },
  heroSub: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  heroRow: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: palette.chipSelectedFill,
    borderWidth: 1,
    borderColor: palette.chipSelectedBorder,
  },
  pillAlt: {
    backgroundColor: palette.highlight,
    borderColor: 'rgba(200, 180, 90, 0.4)',
  },
  pillText: { color: palette.text, fontWeight: '900', fontSize: 12 },
  kpiRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  kpiShell: {
    flex: 1,
    minWidth: '46%',
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(191,255,159,0.2)',
    backgroundColor: 'rgba(10, 70, 31, 0.78)',
  },
  kpiShellAlt: {
    backgroundColor: 'rgba(8, 62, 29, 0.82)',
    borderColor: 'rgba(191,255,159,0.15)',
  },
  next: {
    marginTop: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(191,255,159,0.14)',
    backgroundColor: 'rgba(8, 62, 29, 0.82)',
  },
  nextAccentRail: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: 'rgba(191,255,159,0.55)',
  },
  nextTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  nextBody: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
