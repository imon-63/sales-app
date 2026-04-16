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
import { sumRevenueForSales } from '../../utils/sales';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';

const money = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function AdminDashboardScreen() {
  const user = useAppSelector((s) => s.auth.user);
  const { sales, salesItems, products, warehouses, status, error } =
    useAppSelector((s) => s.salesData);

  const saleIds = useMemo(() => new Set(sales.map((s) => s.id)), [sales]);
  const revenue = useMemo(
    () => sumRevenueForSales(saleIds, salesItems),
    [saleIds, salesItems],
  );

  const tabBottomPad = useTabScreenBottomPadding();

  return (
    <MeshBackground>
      <SafeAreaView
        style={[styles.safe, { paddingBottom: tabBottomPad }]}
        edges={['top']}>
        <ScreenHeader
          title="Command center"
          subtitle="Live pulse across revenue, movement, and inventory readiness — tuned for decisive ops."
          tag="Admin"
        />

        {status === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.emerald} />
            <Text style={styles.loadingText}>Pulling live ledger…</Text>
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
              <Text style={styles.heroEyebrow}>Signed in as</Text>
              <Text style={styles.heroEmail}>{user?.email}</Text>
              <View style={styles.heroRow}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>Global visibility</Text>
                </View>
                <View style={[styles.pill, styles.pillAlt]}>
                  <Text style={styles.pillText}>Lot-aware</Text>
                </View>
              </View>
            </GlassCard>

            <View style={styles.kpiRow}>
              <KpiTile
                label="Revenue (demo)"
                value={money.format(revenue)}
                hint="Sum of recorded sale lines"
                accent={palette.emerald}
              />
              <KpiTile
                label="Orders"
                value={String(sales.length)}
                hint="All teams"
                accent={palette.amber}
              />
            </View>

            <View style={styles.kpiRow}>
              <KpiTile
                label="SKUs"
                value={String(products.length)}
                hint="Catalog breadth"
                accent={palette.cyan}
              />
              <KpiTile
                label="Warehouses"
                value={String(warehouses.length)}
                hint="Storage nodes"
                accent={palette.amber}
              />
            </View>

            <GlassCard style={styles.next}>
              <Text style={styles.nextTitle}>What’s next</Text>
              <Text style={styles.nextBody}>
                Use the menu (☰) for Stock room, Receive, and Transfers against JSON Server.
                When you move to PostgreSQL, keep the same routes and tighten auth.
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
  heroEmail: {
    marginTop: 8,
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
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
    backgroundColor: palette.chipAltFill,
    borderColor: palette.chipAltBorder,
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
