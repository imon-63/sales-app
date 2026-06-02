import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { MeshBackground } from '../../components/ui/MeshBackground';
import { useT } from '../../i18n/useT';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';
import type { MainStackParamList } from '../../navigation/mainStackTypes';
import { useAppSideMenu } from '../../navigation/useAppSideMenu';
import type { LotBatch, Lot, Product, Warehouse } from '../../types/models';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type PurchaseItem = {
  batch: LotBatch;
  lot: Lot;
  product: Product;
  warehouse: Warehouse | undefined;
  isSold: boolean;
  soldQty: number;
  soldRevenue: number;
  unitLabel: string;
  baseCost?: number;
  extraCost?: number;
};

/** Parse the encoded notes string: "bc:20|ec:500|lot:LOT-001" */
function parsePurchaseNotes(notes?: string): { baseCost?: number; extraCost?: number } {
  if (!notes) return {};
  const result: { baseCost?: number; extraCost?: number } = {};
  for (const part of notes.split('|')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const key = part.slice(0, idx);
    const val = Number(part.slice(idx + 1));
    if (key === 'bc' && !Number.isNaN(val)) result.baseCost = val;
    if (key === 'ec' && !Number.isNaN(val)) result.extraCost = val;
  }
  return result;
}

// ── Foldable purchase card ────────────────────────────────────────────────────

function PurchaseCard({
  item,
  onNavigate,
  locale,
  money,
  t,
  canViewDetails,
}: {
  item: PurchaseItem;
  onNavigate: (id: string) => void;
  locale: string;
  money: Intl.NumberFormat;
  t: (key: any, p?: any) => string;
  canViewDetails: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { batch, lot, product, warehouse, isSold, soldQty, soldRevenue, unitLabel, baseCost, extraCost } = item;
  const originalQty = Number(batch.originalQuantity);
  const remainingQty = Number(batch.remainingQuantity);
  const pctSold = originalQty > 0 ? Math.round((soldQty / originalQty) * 100) : 0;

  const purchaseDate = batch.acquiredAt
    ? new Date(batch.acquiredAt).toLocaleDateString(
        locale === 'bn' ? 'bn-BD' : 'en-GB',
        { year: 'numeric', month: 'short', day: 'numeric' },
      )
    : '—';

  const healthColor = isSold
    ? palette.rose
    : remainingQty <= originalQty * 0.2
    ? '#FFD740'
    : palette.emerald;

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(240, 'easeInEaseOut', 'opacity'),
    );
    setExpanded((v) => !v);
  }, []);

  return (
    <Pressable onPress={toggle} style={({ pressed }) => [cs.card, expanded && cs.cardExpanded, isSold && cs.cardSold, pressed && cs.pressed]}>
        {/* Coloured left strip */}
        <View style={[cs.strip, { backgroundColor: healthColor }]} />

        <View style={cs.body}>
          {/* ── Collapsed headline ── */}
          <View style={cs.headline}>
            <View style={cs.headlineLeft}>
              <Text style={cs.productName} numberOfLines={1}>{product.name}</Text>
              <View style={cs.subRow}>
                {lot.lotNumber ? (
                  <View style={cs.lotPill}>
                    <Text style={cs.lotPillText}>{lot.lotNumber}</Text>
                  </View>
                ) : null}
                {warehouse?.name ? (
                  <Text style={cs.warehouseText} numberOfLines={1}>
                    {lot.lotNumber ? '· ' : ''}{warehouse.name}
                  </Text>
                ) : (
                  <Text style={cs.warehouseText}>{purchaseDate}</Text>
                )}
              </View>
            </View>

            <View style={cs.headlineRight}>
              {isSold ? (
                <View style={cs.soldBadge}>
                  <Text style={cs.soldBadgeText}>{t('feed.sold')}</Text>
                </View>
              ) : (
                <View style={[cs.qtyBadge, { borderColor: `${healthColor}50` }]}>
                  <Text style={[cs.qtyBadgeText, { color: healthColor }]}>
                    {remainingQty.toLocaleString()}
                  </Text>
                  <Text style={cs.qtyUnit}> {unitLabel}</Text>
                </View>
              )}
              <Text style={[cs.chevron, expanded && cs.chevronOpen]}>›</Text>
            </View>
          </View>

          {/* ── Expanded details ── */}
          {expanded && (
            <View style={cs.expanded}>
              <View style={cs.divider} />

              {/* Progress bar */}
              <View style={cs.barTrack}>
                <View style={[cs.barFill, { width: `${pctSold}%` as `${number}%`, backgroundColor: healthColor }]} />
              </View>
              <Text style={cs.barLabel}>
                {t('feed.soldQty', { qty: soldQty.toLocaleString(), unit: unitLabel })}
                {soldRevenue > 0 ? '  ·  ' + money.format(soldRevenue) : ''}
              </Text>

              {/* Detail rows */}
              <View style={cs.detailGrid}>
                <DetailPair label={t('feed.lot')} value={lot.lotNumber || '—'} />
                <DetailPair label={t('feed.originalQty')} value={`${originalQty.toLocaleString()} ${unitLabel}`} />
                <DetailPair
                  label={t('feed.remaining')}
                  value={`${remainingQty.toLocaleString()} ${unitLabel}`}
                  accent={!isSold}
                  soldOut={isSold}
                />
                {/* Base unit cost — always visible; falls back to batch.unitCost for old data */}
                <DetailPair
                  label={locale === 'bn' ? 'মূল একক মূল্য' : 'Base Unit Cost'}
                  value={money.format(baseCost ?? Number(batch.unitCost))}
                />
                {/* Extra cost and effective unit cost — only when extra costs were applied */}
                {extraCost != null && extraCost > 0 && (
                  <DetailPair label={locale === 'bn' ? 'অতিরিক্ত খরচ' : 'Extra Cost'} value={`+ ${money.format(extraCost)}`} />
                )}
                {/* Effective/landed unit cost — only differs from base when extra cost exists */}
                <DetailPair
                  label={t('feed.unitCost')}
                  value={money.format(Number(batch.unitCost))}
                  accent={extraCost != null && extraCost > 0}
                />
                <DetailPair label={t('feed.totalValue')} value={money.format(originalQty * Number(batch.unitCost))} />
                <DetailPair label={t('feed.warehouse')} value={warehouse?.name ?? '—'} />
              </View>

              {/* View details button — hidden for sales role on sold items */}
              {canViewDetails && (
                <Pressable
                  onPress={() => onNavigate(batch.id)}
                  style={({ pressed }) => [cs.detailBtn, pressed && { opacity: 0.82 }]}>
                  <Text style={cs.detailBtnText}>{t('feed.viewDetails')}</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
    </Pressable>
  );
}

function DetailPair({ label, value, accent, soldOut }: { label: string; value: string; accent?: boolean; soldOut?: boolean }) {
  return (
    <View style={dpS.row}>
      <Text style={dpS.label}>{label}</Text>
      <Text style={[dpS.value, accent && dpS.accent, soldOut && dpS.soldOut]}>{value}</Text>
    </View>
  );
}
const dpS = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  label: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  value: { color: palette.text, fontSize: 13, fontWeight: '900' },
  accent: { color: palette.emerald },
  soldOut: { color: palette.rose, textDecorationLine: 'line-through' },
});

const cs = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.cardBg,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  cardExpanded: {
    borderColor: palette.cardBorderAccent,
    shadowColor: palette.emerald,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  cardSold: {
    borderColor: `${palette.rose}60`,
    backgroundColor: 'rgba(255,59,92,0.06)',
  },
  pressed: { opacity: 0.86 },
  strip: { width: 5, borderTopLeftRadius: radii.lg, borderBottomLeftRadius: radii.lg },
  body: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },

  headline: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headlineLeft: { flex: 1, paddingRight: 10, gap: 4 },
  productName: { color: palette.text, fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  lotPill: {
    backgroundColor: 'rgba(255,179,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,179,0,0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  lotPillText: { color: palette.violet, fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  warehouseText: { color: palette.textMuted, fontSize: 11, fontWeight: '700', flexShrink: 1 },

  headlineRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  soldBadge: {
    backgroundColor: 'rgba(255,59,92,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,92,0.55)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    shadowColor: '#FF3B5C',
    shadowOpacity: 0.75,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  soldBadgeText: { color: palette.rose, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  qtyBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: palette.cardBgElevated,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyBadgeText: { fontSize: 16, fontWeight: '900' },
  qtyUnit: { color: palette.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  chevron: { color: palette.textMuted, fontSize: 24, fontWeight: '900', lineHeight: 24 },
  chevronOpen: { color: palette.emerald, transform: [{ rotate: '90deg' }] },

  expanded: { marginTop: 10 },
  divider: { height: 1, backgroundColor: palette.cardBorder, marginBottom: 10 },
  barTrack: { height: 6, backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 },
  barFill: { height: '100%', borderRadius: 999 },
  barLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 10 },
  detailGrid: { gap: 0, marginBottom: 14, borderTopWidth: 1, borderTopColor: palette.cardBorder, paddingTop: 4 },
  detailBtn: {
    backgroundColor: palette.emerald,
    borderRadius: radii.md,
    paddingVertical: 11,
    alignItems: 'center',
    shadowColor: palette.emerald,
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  detailBtnText: { color: palette.onAccent, fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export function AdminDashboardScreen() {
  const t = useT();
  const dispatch = useAppDispatch();
  const locale = useAppSelector((s) => s.ui.locale);
  const role = useAppSelector((s) => s.auth.user?.role);
  const user = useAppSelector((s) => s.auth.user);
  const token = useAppSelector((s) => s.auth.token);

  // Load inventory so purchaseNotes (with encoded base/extra cost) are available
  useEffect(() => {
    if (token) dispatch(fetchInventoryStock());
  }, [dispatch, token]);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { menuModal, openMenu } = useAppSideMenu();
  const tabBottomPad = useTabScreenBottomPadding();
  const [feedTab, setFeedTab] = useState<'remaining' | 'sold'>('remaining');

  const { products, warehouses, units, lots, lotBatches, salesItems, salesItemAllocations, status, error } =
    useAppSelector((s) => s.salesData);
  const stockRows = useAppSelector((s) => s.inventory.stockRows);

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
        style: 'currency',
        currency: 'BDT',
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const purchaseList = useMemo((): PurchaseItem[] => {
    return lotBatches
      .map((batch) => {
        const lot = lots.find((l) => l.id === batch.lotId);
        if (!lot) return null;
        const product = products.find((p) => p.id === lot.productId);
        if (!product) return null;
        const warehouse = warehouses.find((w) => w.id === batch.warehouseId);
        const unit = units.find((u) => u.id === product.unitId);
        const unitLabel = unit?.label ?? product.unit ?? '';

        const originalQty = Number(batch.originalQuantity);
        const remainingQty = Number(batch.remainingQuantity);
        const soldQty = originalQty - remainingQty;
        const isSold = remainingQty === 0;

        const batchAllocs = salesItemAllocations.filter((a) => a.lotBatchId === batch.id);
        let soldRevenue = 0;
        for (const alloc of batchAllocs) {
          const si = salesItems.find((si) => si.id === alloc.salesItemId);
          if (si) soldRevenue += Number(alloc.quantityAllocated) * Number(si.unitPrice);
        }

        // Parse base cost / extra cost from StockRow purchaseNotes
        const matchingRow = stockRows.find((r) => r.batchLotId === batch.id || r.lotId === batch.lotId);
        const { baseCost, extraCost } = parsePurchaseNotes(matchingRow?.purchaseNotes);

        return { batch, lot, product, warehouse, isSold, soldQty, soldRevenue, unitLabel, baseCost, extraCost };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a!.isSold !== b!.isSold) return a!.isSold ? 1 : -1;
        return new Date(b!.batch.acquiredAt).getTime() - new Date(a!.batch.acquiredAt).getTime();
      }) as PurchaseItem[];
  }, [lotBatches, lots, products, warehouses, units, salesItemAllocations, salesItems, stockRows]);

  // Group by date for section headers
  type DateSection = { dateKey: string; displayDate: string; items: PurchaseItem[] };
  const sections = useMemo((): DateSection[] => {
    // Filter by tab first
    const filtered = purchaseList.filter((item) =>
      feedTab === 'remaining' ? !item.isSold : item.isSold,
    );
    const map = new Map<string, PurchaseItem[]>();
    for (const item of filtered) {
      const key = item.batch.acquiredAt
        ? item.batch.acquiredAt.slice(0, 10)
        : 'unknown';
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([dateKey, items]) => ({
      dateKey,
      displayDate: dateKey === 'unknown' ? '—' : new Date(dateKey).toLocaleDateString(
        locale === 'bn' ? 'bn-BD' : 'en-GB',
        { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' },
      ),
      items,
    }));
  }, [purchaseList, locale, feedTab]);

  const remainingCount = purchaseList.filter((x) => !x.isSold).length;
  const soldCount = purchaseList.filter((x) => x.isSold).length;

  const navigate = useCallback(
    (lotBatchId: string) => navigation.navigate('PurchaseDetail', { lotBatchId }),
    [navigation],
  );

  return (
    <MeshBackground>
      {menuModal}
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={openMenu}
            style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.75, transform: [{ scale: 0.94 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Open menu">
            <Text style={styles.avatarText}>{(user?.name || 'A').charAt(0).toUpperCase()}</Text>
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Admin'}</Text>
            <Text style={styles.welcomeText}>
              {locale === 'bn' ? 'স্বাগতম! 👋' : 'Welcome back! 👋'}
            </Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{purchaseList.length}</Text>
          </View>
        </View>

        {/* Remaining / Sold tab switcher */}
        <View style={styles.feedTabBar}>
          <Pressable
            onPress={() => setFeedTab('remaining')}
            style={[styles.feedTab, feedTab === 'remaining' && styles.feedTabActive]}>
            <Text style={[styles.feedTabText, feedTab === 'remaining' && styles.feedTabTextActive]}>
              {locale === 'bn' ? 'বাকি আছে' : 'Remaining'}
            </Text>
            {remainingCount > 0 && (
              <View style={[styles.feedTabBadge, feedTab === 'remaining' && styles.feedTabBadgeActive]}>
                <Text style={styles.feedTabBadgeText}>{remainingCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => setFeedTab('sold')}
            style={[styles.feedTab, feedTab === 'sold' && styles.feedTabActive]}>
            <Text style={[styles.feedTabText, feedTab === 'sold' && styles.feedTabTextActive]}>
              {locale === 'bn' ? 'বিক্রিত' : 'Sold'}
            </Text>
            {soldCount > 0 && (
              <View style={[styles.feedTabBadge, feedTab === 'sold' && styles.feedTabBadgeActive]}>
                <Text style={styles.feedTabBadgeText}>{soldCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Feed */}
        {status === 'loading' && purchaseList.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.emerald} size="large" />
          </View>
        ) : status === 'failed' ? (
          <View style={styles.center}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: tabBottomPad + 24 }]}
            showsVerticalScrollIndicator={false}>
            {sections.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📦</Text>
                <Text style={styles.emptyTitle}>{t('feed.empty')}</Text>
                <Text style={styles.emptyBody}>{t('feed.emptyBody')}</Text>
              </View>
            ) : (
              sections.map((section) => (
                <View key={section.dateKey} style={styles.section}>
                  <View style={styles.dateHeader}>
                    <View style={styles.dateLine} />
                    <Text style={styles.dateHeaderText}>{section.displayDate}</Text>
                    <View style={styles.dateLine} />
                  </View>
                  {section.items.map((item) => (
                    <PurchaseCard
                      key={item.batch.id}
                      item={item}
                      onNavigate={navigate}
                      locale={locale}
                      money={money}
                      t={t}
                      canViewDetails={!(role === 'sales' && item.isSold)}
                    />
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.emerald,
    shadowOpacity: 0.40,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    flexShrink: 0,
  },
  avatarText: { color: palette.onAccent, fontSize: 22, fontWeight: '900' },
  headerInfo: { flex: 1 },
  userName: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: undefined }),
  },
  welcomeText: { color: '#FFD60A', fontSize: 12, fontWeight: '800', marginTop: 2 },
  countBadge: {
    backgroundColor: palette.cardBgElevated,
    borderWidth: 1,
    borderColor: palette.cardBorderAccent,
    borderRadius: radii.md,
    minWidth: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  countText: { color: palette.emerald, fontSize: 22, fontWeight: '900' },
  scroll: { paddingHorizontal: 20, paddingTop: 4, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errText: { color: palette.danger, fontWeight: '800', textAlign: 'center' },
  emptyCard: { marginTop: 32, padding: 40, alignItems: 'center', gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  emptyBody: { color: palette.textMuted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  section: { gap: 10 },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 2,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: palette.cardBorder },
  dateHeaderText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  feedTabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: palette.cardBgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 4,
    gap: 4,
  },
  feedTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radii.md,
    gap: 8,
  },
  feedTabActive: {
    backgroundColor: palette.night,
    shadowColor: palette.emerald,
    shadowOpacity: 0.20,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  feedTabText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  feedTabTextActive: {
    color: palette.emerald,
    fontWeight: '900',
  },
  feedTabBadge: {
    backgroundColor: palette.cardBgPrimary,
    borderRadius: 999,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  feedTabBadgeActive: {
    backgroundColor: palette.emeraldLight,
  },
  feedTabBadgeText: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '900',
  },
});
