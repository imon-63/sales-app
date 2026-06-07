import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { MeshBackground } from '../../components/ui/MeshBackground';
import { useT } from '../../i18n/useT';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { fetchSalesDataset } from '../../store/slices/salesDataSlice';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';
import { PulseDot } from '../../components/ui/PulseDot';
import type { MainStackParamList } from '../../navigation/mainStackTypes';
import { useAppSideMenu } from '../../navigation/useAppSideMenu';
import type { LotBatch, Lot, Product, Warehouse } from '../../types/models';


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
  costMoney,
  t,
  canViewDetails,
  activeUsers = [],
}: {
  item: PurchaseItem;
  onNavigate: (id: string) => void;
  locale: string;
  money: Intl.NumberFormat;
  costMoney: Intl.NumberFormat;
  t: (key: any, p?: any) => string;
  canViewDetails: boolean;
  activeUsers?: Array<{ id: string; name: string }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const { batch, lot, product, warehouse, isSold, soldQty, soldRevenue, unitLabel, baseCost, extraCost } = item;
  const originalQty = Number(batch.originalQuantity);
  const remainingQty = Number(batch.remainingQuantity);
  const pctSold = originalQty > 0 ? Math.round((soldQty / originalQty) * 100) : 0;

  const isActiveViewing = activeUsers.length > 0;

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
    setExpanded((v) => {
      const opening = !v;
      Animated.parallel([
        // Height: decelerate on open (feels natural expanding down), accelerate on close
        Animated.timing(expandAnim, {
          toValue: opening ? 1 : 0,
          duration: opening ? 280 : 200,
          easing: opening
            ? Easing.bezier(0.0, 0.0, 0.2, 1)   // decelerate
            : Easing.bezier(0.4, 0.0, 1.0, 1.0), // accelerate
          useNativeDriver: false,
        }),
        // Opacity: fade in a touch faster than height so content appears to emerge
        Animated.timing(opacityAnim, {
          toValue: opening ? 1 : 0,
          duration: opening ? 200 : 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
      return opening;
    });
  }, [expandAnim, opacityAnim]);

  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => [
        cs.card,
        expanded && cs.cardExpanded,
        isSold && cs.cardSold,
        isActiveViewing && cs.cardLive,  // deep-orange glow when selling live
        pressed && cs.pressed,
      ]}>
        {/* Left strip — deep orange when someone is actively selling */}
        <View style={[cs.strip, { backgroundColor: isActiveViewing ? palette.rose : healthColor }]} />

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
                {isActiveViewing && (
                  <View style={cs.livePill}>
                    <PulseDot color={palette.rose} />
                    <View style={cs.liveAvatarRow}>
                      {activeUsers.slice(0, 3).map((u, i) => (
                        <View key={u.id} style={[cs.liveAvatar, { marginLeft: i === 0 ? 0 : -6, zIndex: 3 - i }]}>
                          <Text style={cs.liveAvatarText}>{(u.name || '?').charAt(0).toUpperCase()}</Text>
                        </View>
                      ))}
                      {activeUsers.length > 3 && (
                        <View style={[cs.liveAvatar, cs.liveAvatarMore, { marginLeft: -6 }]}>
                          <Text style={cs.liveAvatarMoreText}>+{activeUsers.length - 3}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={cs.livePillText} numberOfLines={1}>
                      {activeUsers.length === 1
                        ? (locale === 'bn' ? `লাইভ: ${activeUsers[0].name.split(' ')[0]}` : `Live: ${activeUsers[0].name.split(' ')[0]}`)
                        : (locale === 'bn' ? `লাইভ: ${activeUsers.length} জন` : `Live: ${activeUsers.length} selling`)}
                    </Text>
                  </View>
                )}
                {!isActiveViewing && (
                  warehouse?.name ? (
                    <Text style={cs.warehouseText}>
                      {lot.lotNumber ? '· ' : ''}{warehouse.name}
                    </Text>
                  ) : (
                    <Text style={cs.warehouseText}>{purchaseDate}</Text>
                  )
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
          <Animated.View style={[cs.expanded, {
            maxHeight: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 600] }),
            opacity: opacityAnim,
            overflow: 'hidden',
          }]}>
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
                {/* Cost price display:
                    - No extra cost: one row "Unit Cost" = base = effective (identical)
                    - Extra cost applied: three rows — Base | +Extra | Unit Cost (effective) */}
                {extraCost != null && extraCost > 0 ? (
                  <>
                    <DetailPair
                      label={locale === 'bn' ? 'মূল একক মূল্য' : 'Base Unit Cost'}
                      value={costMoney.format(baseCost ?? Number(batch.unitCost))}
                    />
                    <DetailPair
                      label={locale === 'bn' ? 'অতিরিক্ত খরচ' : 'Extra Cost'}
                      value={`+ ${costMoney.format(extraCost)}`}
                    />
                    <DetailPair
                      label={t('feed.unitCost')}
                      value={costMoney.format(Number(batch.unitCost))}
                      accent
                    />
                  </>
                ) : (
                  <DetailPair
                    label={t('feed.unitCost')}
                    value={costMoney.format(baseCost ?? Number(batch.unitCost))}
                  />
                )}
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
          </Animated.View>
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
    borderColor: `${palette.rose}50`,
    backgroundColor: 'rgba(18, 4, 8, 0.96)',
  },
  pressed: { opacity: 0.86 },
  strip: { width: 5, borderTopLeftRadius: radii.lg, borderBottomLeftRadius: radii.lg },
  body: { flex: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },

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
  cardLive: {
    borderColor: palette.rose,
    borderWidth: 1.5,
    shadowColor: palette.rose,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 5,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: palette.rose,
    backgroundColor: 'rgba(255,59,92,0.08)',
    shadowColor: palette.rose,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  liveAvatarRow: { flexDirection: 'row', alignItems: 'center' },
  liveAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.rose,
    borderWidth: 1.5,
    borderColor: palette.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveAvatarText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  liveAvatarMore: { backgroundColor: 'rgba(255,59,92,0.25)' },
  liveAvatarMoreText: { color: palette.rose, fontSize: 8, fontWeight: '900' },
  livePillText: { color: palette.rose, fontSize: 10, fontWeight: '900', letterSpacing: 0.2 },
  warehouseText: { color: palette.textMuted, fontSize: 11, fontWeight: '700' },

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
  useFocusEffect(
    useCallback(() => {
      if (token) {
        dispatch(fetchInventoryStock());
        dispatch(fetchSalesDataset());
      }
    }, [dispatch, token])
  );
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { menuModal, openMenu } = useAppSideMenu();
  const tabBottomPad = useTabScreenBottomPadding();
  const [feedTab, setFeedTab] = useState<'remaining' | 'sold'>('remaining');

  const { products, warehouses, units, lots, lotBatches, salesItems, salesItemAllocations, status, error } =
    useAppSelector((s) => s.salesData);
  const stockRows = useAppSelector((s) => s.inventory.stockRows);
  const activeViews = useAppSelector((s) => s.notifications.activeViews);
  const unreadCount = useAppSelector((s) => s.notifications.items.filter(n => n.unread).length);

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
        style: 'currency',
        currency: 'BDT',
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const costMoney = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
        style: 'currency',
        currency: 'BDT',
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
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

        // Parse base cost / extra cost from StockRow purchaseNotes or LotBatch fields
        const matchingRow = stockRows.find((r) => r.batchLotId === batch.id || r.lotId === batch.lotId);
        const parsed = parsePurchaseNotes(matchingRow?.purchaseNotes || batch.notes);
        const baseCost = batch.baseUnitCost ?? matchingRow?.baseUnitCost ?? parsed.baseCost ?? batch.unitCost;
        const derivedExtraCost = Math.max(0, (Number(batch.unitCost) - Number(baseCost)) * originalQty);
        const extraCost = parsed.extraCost ?? (derivedExtraCost > 0.01 ? derivedExtraCost : undefined);

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
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel="Notifications">
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Remaining / Sold tab switcher */}
        <View style={styles.feedTabBar}>
          {([
            { key: 'remaining' as const, icon: '📦', label: locale === 'bn' ? 'বাকি আছে' : 'Remaining', count: remainingCount, activeColor: '#00A8FF' },
            { key: 'sold'      as const, icon: '🔴', label: locale === 'bn' ? 'বিক্রিত'  : 'Sold',      count: soldCount,      activeColor: '#FF3B5C' },
          ]).map(tab => {
            const active = feedTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setFeedTab(tab.key)}
                style={({ pressed }) => [
                  styles.feedTab,
                  active && { borderColor: `${tab.activeColor}60`, shadowColor: tab.activeColor },
                  pressed && { opacity: 0.82 },
                ]}>
                <Text style={[styles.feedTabIcon, { opacity: active ? 1 : 0.4 }]}>{tab.icon}</Text>
                <Text style={[styles.feedTabLbl, { color: active ? '#fff' : 'rgba(255,255,255,0.35)' }]}>{tab.label}</Text>
                <View style={[styles.feedTabBadge, { backgroundColor: active ? tab.activeColor : 'rgba(255,255,255,0.08)' }]}>
                  <Text style={[styles.feedTabBadgeText, { color: active ? '#fff' : 'rgba(255,255,255,0.35)' }]}>{tab.count}</Text>
                </View>
              </Pressable>
            );
          })}
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
                {feedTab === 'remaining' && (
                  <Pressable
                    onPress={() => navigation.navigate('ReceiveStock')}
                    style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.82 }]}>
                    <Text style={styles.emptyBtnText}>+ Receive Stock</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              sections.map((section) => (
                <View key={section.dateKey} style={styles.section}>
                  <View style={styles.dateHeader}>
                    <View style={styles.dateLine} />
                    <Text style={styles.dateHeaderText}>{section.displayDate}</Text>
                    <View style={styles.dateLine} />
                  </View>
                  {section.items.map((item) => {
                    const prodActiveUsers =
                      activeViews.find((v) => v.lotBatchId === item.batch.id)?.users ?? [];
                    return (
                      <PurchaseCard
                        key={item.batch.id}
                        item={item}
                        onNavigate={navigate}
                        locale={locale}
                        money={money}
                        costMoney={costMoney}
                        t={t}
                        canViewDetails={!(role === 'sales' && item.isSold)}
                        activeUsers={prodActiveUsers}
                      />
                    );
                  })}
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2A1F6E',
    borderWidth: 1.5,
    borderColor: 'rgba(140,100,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CE8',
    shadowOpacity: 0.50,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    flexShrink: 0,
  },
  avatarText: { color: '#C5AAFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  headerInfo: { flex: 1 },
  userName: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: undefined }),
  },
  welcomeText: { color: '#FFD60A', fontSize: 12, fontWeight: '800', marginTop: 2 },
  bellBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bellIcon: { fontSize: 22 },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    shadowColor: palette.rose,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  scroll: { paddingHorizontal: 20, paddingTop: 4, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errText: { color: palette.danger, fontWeight: '800', textAlign: 'center' },
  emptyCard: { marginTop: 32, padding: 40, alignItems: 'center', gap: 10 },
  emptyBtn: {
    marginTop: 10,
    backgroundColor: palette.emerald,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.md,
    shadowColor: palette.emerald,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  emptyBtnText: { color: palette.onAccent, fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
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
    gap: 10,
  },
  feedTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    backgroundColor: palette.cardBgElevated,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  feedTabIcon: { fontSize: 18 },
  feedTabLbl: { flex: 1, fontSize: 13, fontWeight: '800' },
  feedTabBadge: {
    borderRadius: 999,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  feedTabBadgeText: { fontSize: 12, fontWeight: '900' },
  // Legacy stubs
  feedTabActive: {},
  feedTabText: { fontSize: 12, fontWeight: '700', color: palette.textMuted },
  feedTabTextActive: {},
  feedTabBadgeActive: {
    backgroundColor: palette.emeraldLight,
  },
});
