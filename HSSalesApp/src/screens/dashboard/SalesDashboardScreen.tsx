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
import { useAppSelector } from '../../store/hooks';
import { palette, radii } from '../../theme/designSystem';
import { filterSalesByRole, sumRevenueForSales } from '../../utils/sales';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';

const money = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function SalesDashboardScreen() {
  const user = useAppSelector((s) => s.auth.user);
  const { sales, salesItems, products, warehouses, status, error } =
    useAppSelector((s) => s.salesData);

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
      ? products.find((p) => p.id === best.id)?.name ?? 'Top SKU'
      : '—';
    return name;
  }, [mySales, products, salesItems]);

  const tabBottomPad = useTabScreenBottomPadding();

  return (
    <MeshBackground>
      <SafeAreaView
        style={[styles.safe, { paddingBottom: tabBottomPad }]}
        edges={['top']}>
        <ScreenHeader
          title="Your runway"
          subtitle="A tight, personal cockpit: only your deals, your rhythm, and the next best move."
          tag="Sales"
        />

        {status === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.emerald} />
            <Text style={styles.loadingText}>Syncing your pipeline…</Text>
          </View>
        ) : status === 'failed' ? (
          <View style={styles.loading}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.loadingText}>
              Start JSON Server: `cd backend-json-server && npm run dev`
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}>
            <GlassCard style={styles.hero}>
              <Text style={styles.heroEyebrow}>Momentum</Text>
              <Text style={styles.heroBig}>{money.format(revenue)}</Text>
              <Text style={styles.heroSub}>
                Revenue from {mySales.length} recorded orders you own.
              </Text>
              <View style={styles.heroRow}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>Top SKU: {topSku}</Text>
                </View>
                <View style={[styles.pill, styles.pillAlt]}>
                  <Text style={styles.pillText}>
                    Warehouses in network: {warehouses.length}
                  </Text>
                </View>
              </View>
            </GlassCard>

            <View style={styles.kpiRow}>
              <KpiTile
                label="Your orders"
                value={String(mySales.length)}
                hint="Created by you"
                accent={palette.emerald}
              />
              <KpiTile
                label="Catalog"
                value={String(products.length)}
                hint="Shared product rails"
                accent={palette.violet}
              />
            </View>

            <GlassCard style={styles.next}>
              <Text style={styles.nextTitle}>Pulse tab</Text>
              <Text style={styles.nextBody}>
                Open Pulse to explore the expandable calendar: multi-dot days,
                scroll-to-update dates, and tap-to-jump — all synced automatically.
              </Text>
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
