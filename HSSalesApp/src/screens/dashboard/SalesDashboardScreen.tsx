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
import { ScreenHeader } from '../../components/ui/ScreenHeader';
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
        <ScreenHeader title={t('dashboard.sales.title')} tag={t('dashboard.sales.tag')} />

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
            <GlassCard style={styles.hero} accentColor={palette.emerald}>
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
              <KpiTile
                label={t('dashboard.sales.ordersLabel')}
                value={String(mySales.length)}
                hint={t('dashboard.sales.ordersHint')}
                accent={palette.emerald}
              />
              <KpiTile
                label={t('dashboard.sales.productsLabel')}
                value={String(products.length)}
                hint={t('dashboard.sales.productsHint')}
                accent={palette.violet}
              />
            </View>

            <GlassCard style={styles.next}>
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
  scroll: { paddingHorizontal: 20, paddingBottom: 28, gap: 14 },
  loading: {
    paddingHorizontal: 20,
    paddingTop: 30,
    gap: 10,
  },
  loadingText: { color: palette.textMuted, fontWeight: '600' },
  errorText: { color: palette.danger, fontWeight: '800' },
  hero: { marginTop: 6 },
  heroEyebrow: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroBig: {
    marginTop: 10,
    color: palette.text,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.2,
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
  next: { marginTop: 4 },
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
