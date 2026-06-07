import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MeshBackground } from '../../components/ui/MeshBackground';
import { useT } from '../../i18n/useT';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchNotifications,
  markNotificationReadThunk,
} from '../../store/slices/notificationsSlice';
import type { AdminNotification } from '../../types/models';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/mainStackTypes';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string, locale: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatTime(iso: string, locale: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(locale === 'bn' ? 'bn-BD' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function formatMoney(amount: number, locale: string) {
  return new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Translation Helpers ────────────────────────────────────────────────────────

const PRODUCT_TRANSLATIONS_BN: Record<string, string> = {
  'Wheat': 'গম',
  'Rice': 'চাল',
  'Rice Bag': 'চালের বস্তা',
  'Corn': 'ভুট্টা',
  'Mastard': 'সরিষা',
  'Potato': 'আলু',
};

const WAREHOUSE_TRANSLATIONS_BN: Record<string, string> = {
  'Direct': 'ডাইরেক্ট',
  'Main Warehouse': 'প্রধান গুদাম',
  'Secondary Warehouse': 'দ্বিতীয় গুদাম',
  'Regional DC — North': 'আঞ্চলিক ডিসি — উত্তর',
  'Cold Storage East': 'কোল্ড স্টোরেজ পূর্ব',
};

function translateProduct(name: string | undefined, locale: string): string {
  if (!name) return '';
  if (locale !== 'bn') return name;
  return PRODUCT_TRANSLATIONS_BN[name] || name;
}

function translateWarehouse(name: string | undefined, locale: string): string {
  if (!name) return '';
  if (locale !== 'bn') return name;
  return WAREHOUSE_TRANSLATIONS_BN[name] || name;
}

function translateSaleBody(body: string, locale: string): string {
  if (locale !== 'bn') return body;
  if (!body) return body;

  const parts = body.split(' · ');
  const translatedParts = parts.map((part) => {
    if (WAREHOUSE_TRANSLATIONS_BN[part]) {
      return WAREHOUSE_TRANSLATIONS_BN[part];
    }
    let updatedPart = part;
    for (const [engProd, bnProd] of Object.entries(PRODUCT_TRANSLATIONS_BN)) {
      if (updatedPart.startsWith(engProd)) {
        updatedPart = updatedPart.replace(engProd, bnProd);
        break;
      }
    }
    updatedPart = updatedPart
      .replace('BOSTA', 'বস্তা')
      .replace('KG', 'কেজি')
      .replace('BDT', 'টাকা');
    return updatedPart;
  });

  return translatedParts.join(' · ');
}

function translateNotificationBody(body: string, locale: string): string {
  if (locale !== 'bn') return body;
  if (!body) return body;

  if (body.startsWith('Inventory Alert:')) {
    // Pattern 1: Inventory Alert: Lot X (Y) has been moved and sold until depletion. No stock remains.
    if (body.includes('has been moved and sold until depletion. No stock remains.')) {
      const match = body.match(/Inventory Alert: Lot (.*?) \((.*?)\) has been moved/);
      if (match) {
        const [, lotNum, prodName] = match;
        const bnProdName = translateProduct(prodName, locale);
        return `ইনভেন্টরি অ্যালার্ট: লট ${lotNum} (${bnProdName}) সরানো হয়েছে এবং নিঃশেষ হওয়া পর্যন্ত বিক্রি করা হয়েছে। কোনো স্টক অবশিষ্ট নেই।`;
      }
    }

    // Pattern 2: Inventory Alert: Lot X (Y) is now completely depleted across all warehouses. Tap to view the lifecycle profitability report.
    if (body.includes('is now completely depleted across all warehouses.')) {
      const match = body.match(/Inventory Alert: Lot (.*?) \((.*?)\) is now completely depleted/);
      if (match) {
        const [, lotNum, prodName] = match;
        const bnProdName = translateProduct(prodName, locale);
        return `ইনভেন্টরি অ্যালার্ট: লট ${lotNum} (${bnProdName}) এখন সব গুদামজুড়ে সম্পূর্ণরূপে নিঃশেষ হয়ে গেছে। লাইফসাইকেল লাভজনকতার রিপোর্ট দেখতে ট্যাপ করুন।`;
      }
    }

    return body.replace('Inventory Alert:', 'ইনভেন্টরি অ্যালার্ট:');
  }

  if (body.includes(' · ')) {
    return translateSaleBody(body, locale);
  }

  return body;
}

function BlinkDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[dotStyles.dot, { opacity }]} />;
}
const dotStyles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.emerald,
    shadowColor: palette.emerald,
    shadowOpacity: 0.80,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});

// ── Notification Card ─────────────────────────────────────────────────────────

type CardProps = {
  item: AdminNotification;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onOpenDetails: (item: AdminNotification) => void;
  locale: string;
  // enriched data
  sellerName?: string;
  sellerPhone?: string;
  warehouseName?: string;
  productSummary: string;   // "Potato ×500 KG"
  totalRevenue: number;
  t: (key: any, params?: any) => string;
};

function NotificationCard({
  item,
  isExpanded,
  onToggle,
  onOpenDetails,
  locale,
  sellerName,
  sellerPhone,
  warehouseName,
  productSummary,
  totalRevenue,
  t,
}: CardProps) {
  const isSale = item.type === 'sale_created';
  const isOrder = item.type === 'order_created';
  const isUnread = item.unread;

  const typeLabel = isSale
    ? t('notifications.saleCreated')
    : isOrder
    ? (locale === 'bn' ? 'নতুন অর্ডার' : 'New Order')
    : t('notifications.lotDepleted');

  const typeColor = isSale ? palette.emerald : isOrder ? '#60A5FA' : '#FFD740';
  const typeBg = isSale
    ? 'rgba(245,168,24,0.13)'
    : isOrder
    ? 'rgba(96,165,250,0.12)'
    : 'rgba(255,215,64,0.12)';

  return (
    <Pressable
      onPress={() => onToggle(item.id)}
      style={({ pressed }) => [cardS.wrap, pressed && cardS.pressed]}>

      {/* Unread left accent bar */}
      {isUnread && <View style={cardS.accentBar} />}

      {/* ── Collapsed header (always visible) ── */}
      <View style={cardS.headerRow}>
        {/* Type badge */}
        <View style={[cardS.typeBadge, { backgroundColor: typeBg, borderColor: `${typeColor}40` }]}>
          <Text style={cardS.typeIcon}>{isSale ? '🛒' : isOrder ? '📋' : '📦'}</Text>
        </View>

        {/* Center info */}
        <View style={cardS.headerCenter}>
          <View style={cardS.headline}>
            {isUnread && <BlinkDot />}
            <Text style={cardS.headlineText} numberOfLines={1}>
              {productSummary || typeLabel}
            </Text>
          </View>
          <View style={cardS.subRow}>
            <Text style={cardS.dateText}>{formatDate(item.createdAt, locale)}</Text>
            {!isSale && !isOrder && (
              <>
                <Text style={cardS.subDot}> · </Text>
                <Text style={[
                  cardS.revenueText,
                  {
                    color: '#00E676',
                    textShadowColor: 'rgba(0, 230, 118, 0.8)',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 6,
                  }
                ]}>
                  {locale === 'bn' ? '✓ সম্পূর্ণ বিক্রিত' : '✓ Fully Sold'}
                </Text>
              </>
            )}
            {isSale && totalRevenue > 0 && (
              <>
                <Text style={cardS.subDot}> · </Text>
                <Text style={cardS.revenueText}>{formatMoney(totalRevenue, locale)}</Text>
              </>
            )}
          </View>
        </View>

        {/* Right: unread badge + chevron */}
        <View style={cardS.headerRight}>
          {isUnread && (
            <View style={cardS.unreadBadge}>
              <Text style={cardS.unreadBadgeText}>{t('notifications.unread')}</Text>
            </View>
          )}
          <Text style={[cardS.chevron, isExpanded && cardS.chevronOpen]}>›</Text>
        </View>
      </View>

      {/* ── Expanded body ── */}
      {isExpanded && (
        <View style={cardS.expanded}>
          <View style={cardS.divider} />

          {/* Meta grid */}
          <View style={cardS.metaGrid}>
            {sellerName ? (
              <MetaRow icon="👤" label={t('notifications.seller')} value={sellerName} />
            ) : null}
            {sellerPhone ? (
              <MetaRow icon="📞" label={locale === 'bn' ? 'মোবাইল' : 'Mobile'} value={sellerPhone} />
            ) : null}
            {warehouseName ? (
              <MetaRow icon="🏭" label={t('notifications.warehouse')} value={warehouseName} />
            ) : null}
            <MetaRow
              icon="🕐"
              label={formatDate(item.createdAt, locale)}
              value={formatTime(item.createdAt, locale)}
            />
            {totalRevenue > 0 && (
              <MetaRow
                icon="💰"
                label={t('notifications.totalRevenue')}
                value={formatMoney(totalRevenue, locale)}
                accent
              />
            )}
          </View>

          {/* Full body text */}
          {!!item.body && (
            <Text style={cardS.bodyText}>{translateNotificationBody(item.body, locale)}</Text>
          )}

          {/* Ref row */}
          <View style={cardS.refRow}>
            <Text style={cardS.refLabel}>
              {isSale ? t('notifications.saleRef') : t('notifications.lotRef')}
            </Text>
            <Text style={cardS.refValue} numberOfLines={1}>
              {isSale ? (item.saleId?.slice(0, 12) ?? '—') : (item.lotId?.slice(0, 12) ?? '—')}…
            </Text>
          </View>

          {/* View details button */}
          <Pressable
            onPress={() => onOpenDetails(item)}
            style={({ pressed }) => [cardS.detailBtn, pressed && cardS.detailBtnPressed]}>
            <Text style={cardS.detailBtnText}>{t('notifications.viewDetails')}</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

function MetaRow({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <View style={metaS.row}>
      <Text style={metaS.icon}>{icon}</Text>
      <Text style={metaS.label}>{label}</Text>
      <Text style={[metaS.value, accent && metaS.valueAccent]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const metaS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  icon: { fontSize: 14, width: 20 },
  label: { color: palette.textMuted, fontSize: 12, fontWeight: '700', minWidth: 72 },
  value: { color: palette.text, fontSize: 13, fontWeight: '800', flex: 1, textAlign: 'right' },
  valueAccent: { color: palette.emerald },
});

const cardS = StyleSheet.create({
  wrap: {
    backgroundColor: palette.cardBg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    overflow: 'hidden',
    position: 'relative',
  },
  pressed: { opacity: 0.86 },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: palette.emerald,
    borderTopLeftRadius: radii.lg,
    borderBottomLeftRadius: radii.lg,
    shadowColor: palette.emerald,
    shadowOpacity: 0.70,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  typeBadge: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  typeIcon: { fontSize: 20 },
  headerCenter: { flex: 1, gap: 4, minWidth: 0 },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headlineText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
    flex: 1,
  },
  subRow: { flexDirection: 'row', alignItems: 'center' },
  dateText: { color: palette.textMuted, fontSize: 11, fontWeight: '700' },
  subDot: { color: palette.textMuted, fontSize: 11 },
  revenueText: { color: palette.emerald, fontSize: 12, fontWeight: '900' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  unreadBadge: {
    backgroundColor: 'rgba(245,168,24,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,168,24,0.30)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: palette.emerald,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chevron: {
    color: palette.textMuted,
    fontSize: 22,
    fontWeight: '900',
    transform: [{ rotate: '0deg' }],
    lineHeight: 22,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
    color: palette.emerald,
  },

  // Expanded
  expanded: { paddingHorizontal: 16, paddingBottom: 14 },
  divider: {
    height: 1,
    backgroundColor: palette.cardBorder,
    marginBottom: 12,
  },
  metaGrid: { gap: 2, marginBottom: 10 },
  bodyText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  refRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(56,140,220,0.07)',
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  refValue: { color: palette.textLabel, fontSize: 11, fontWeight: '800', fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: undefined }) },
  detailBtn: {
    backgroundColor: palette.emerald,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: palette.emerald,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  detailBtnPressed: { backgroundColor: palette.emeraldDeep, opacity: 0.90 },
  detailBtnText: {
    color: palette.onAccent,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});

type NotifSection = { title: string; data: AdminNotification[] };

// ── Main Screen ───────────────────────────────────────────────────────────────

export function AdminNotificationsScreen() {
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const dispatch = useAppDispatch();
  const locale = useAppSelector((s) => s.ui.locale);
  const { items, status, error, lastFetchedAt } = useAppSelector((s) => s.notifications);
  const { users, sales, salesItems, warehouses, products, lots } = useAppSelector((s) => s.salesData);
  const tabBottomPad = useTabScreenBottomPadding();
  const listRef = useRef<SectionList<AdminNotification, NotifSection>>(null);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Scroll to top when a new notification arrives (newest item id changes)
  const newestId = items[0]?.id;
  const prevNewestId = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (newestId && newestId !== prevNewestId.current && prevNewestId.current !== undefined) {
      requestAnimationFrame(() => {
        try { listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true, viewOffset: 0 }); } catch {}
      });
    }
    prevNewestId.current = newestId;
  }, [newestId]);

  useFocusEffect(
    useCallback(() => {
      // Only re-fetch if data is very stale (> 5 min) — live WS keeps it fresh otherwise
      const STALE_MS = 5 * 60_000;
      const stale = !lastFetchedAt || Date.now() - lastFetchedAt > STALE_MS;
      if (status !== 'loading' && (status === 'idle' || stale)) {
        dispatch(fetchNotifications());
      }
    }, [dispatch, lastFetchedAt, status]),
  );

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'),
    );
    setExpandedIds((prev) => {
      const next = new Set(prev);
      const opening = !next.has(id);
      if (opening) {
        next.add(id);
        // Mark as read the moment the card opens
        const notif = items.find(n => n.id === id);
        if (notif?.unread) dispatch(markNotificationReadThunk(id));
      } else {
        next.delete(id);
      }
      return next;
    });
  }, [items, dispatch]);

  const onOpenDetails = useCallback(
    (n: AdminNotification) => {
      if (n.unread) dispatch(markNotificationReadThunk(n.id));
      if (n.type === 'lot_depleted' && n.lotId) {
        navigation.navigate('LotReport', { lotId: n.lotId });
      } else if (n.type === 'order_created' && (n as any).orderId) {
        // Navigate to Orders tab — no dedicated order detail screen yet, use Orders tab
        navigation.navigate('Work');
      } else if (n.saleId) {
        navigation.navigate('SaleDetails', { saleId: n.saleId });
      }
    },
    [dispatch, navigation],
  );

  // Pre-compute enriched data for each notification
  const enrichedMap = useMemo(() => {
    const map = new Map<
      string,
      {
        sellerName?: string;
        sellerPhone?: string;
        warehouseName?: string;
        productSummary: string;
        totalRevenue: number;
      }
    >();

    for (const n of items) {
      const seller = users.find((u) => u.id === n.actorUserId);
      let warehouseName: string | undefined;
      let productSummary = '';
      let totalRevenue = 0;

      if (n.type === 'sale_created' && n.saleId) {
        const sale = sales.find((s) => s.id === n.saleId);
        if (sale) {
          const rawWhName = warehouses.find((w) => w.id === sale.warehouseId)?.name;
          warehouseName = translateWarehouse(rawWhName, locale);
          const sItems = salesItems.filter((si) => si.saleId === n.saleId);
          totalRevenue = sItems.reduce(
            (acc, si) => acc + Number(si.quantity) * Number(si.unitPrice),
            0,
          );
          const names = sItems
            .map((si) => {
              const prod = products.find((p) => p.id === si.productId);
              const bnProdName = translateProduct(prod?.name, locale);
              return prod ? `${bnProdName} ×${si.quantity}` : null;
            })
            .filter(Boolean)
            .slice(0, 3);
          productSummary = names.join(', ');
          if (sItems.length > 3) productSummary += ` +${sItems.length - 3}`;
        }
      } else if (n.type === 'lot_depleted' && n.lotId) {
        const lot = lots.find((l) => l.id === n.lotId);
        const prod = lot ? products.find((p) => p.id === lot.productId) : undefined;
        if (prod) {
          const bnProdName = translateProduct(prod.name, locale);
          // Informative headline: product name + lot number
          productSummary = lot?.lotNumber
            ? `${bnProdName} · ${lot.lotNumber}`
            : bnProdName;
        }
      }

      map.set(n.id, {
        sellerName: seller?.name || seller?.email,
        sellerPhone: seller?.phone,
        warehouseName,
        productSummary,
        totalRevenue,
      });
    }
    return map;
  }, [items, users, sales, salesItems, warehouses, products, locale]);

  const renderItem = useCallback(
    ({ item }: { item: AdminNotification }) => {
      const enriched = enrichedMap.get(item.id) ?? {
        productSummary: '',
        totalRevenue: 0,
      };
      return (
        <NotificationCard
          item={item}
          isExpanded={expandedIds.has(item.id)}
          onToggle={toggleExpand}
          onOpenDetails={onOpenDetails}
          locale={locale}
          sellerName={enriched.sellerName}
          sellerPhone={enriched.sellerPhone}
          warehouseName={enriched.warehouseName}
          productSummary={enriched.productSummary}
          totalRevenue={enriched.totalRevenue}
          t={t}
        />
      );
    },
    [enrichedMap, expandedIds, toggleExpand, onOpenDetails, locale, t],
  );

  // Group notifications into Today / Yesterday / Older
  const sections = useMemo((): NotifSection[] => {
    const todayLabel = locale === 'bn' ? 'আজ' : 'Today';
    const yesterdayLabel = locale === 'bn' ? 'গতকাল' : 'Yesterday';
    const olderLabel = locale === 'bn' ? 'পুরানো' : 'Older';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86_400_000;

    const buckets: Record<string, AdminNotification[]> = {
      [todayLabel]: [],
      [yesterdayLabel]: [],
      [olderLabel]: [],
    };

    for (const n of items) {
      const t2 = new Date(n.createdAt).getTime();
      if (t2 >= todayStart) buckets[todayLabel].push(n);
      else if (t2 >= yesterdayStart) buckets[yesterdayLabel].push(n);
      else buckets[olderLabel].push(n);
    }

    return [todayLabel, yesterdayLabel, olderLabel]
      .filter((label) => buckets[label].length > 0)
      .map((label) => ({ title: label, data: buckets[label] }));
  }, [items, locale]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: NotifSection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>{section.title}</Text>
        <View style={styles.sectionLine} />
      </View>
    ),
    [],
  );

  const unreadCount = items.filter((n) => n.unread).length;

  return (
    <MeshBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          {navigation.canGoBack() && (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={12}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}>
              <Text style={styles.backBtnText}>‹</Text>
            </Pressable>
          )}
          <View style={styles.headerLeft}>
            <Text style={styles.title}>{t('notifications.title')}</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          {status === 'loading' && items.length > 0 && (
            <ActivityIndicator color={palette.emerald} size="small" />
          )}
        </View>

        {/* ── Content ── */}
        {status === 'loading' && items.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.emerald} size="large" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : status === 'failed' ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <SectionList
            ref={listRef}
            sections={sections}
            keyExtractor={(n) => n.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={[styles.list, { paddingBottom: tabBottomPad + 24 }]}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>🔔</Text>
                <Text style={styles.emptyTitle}>{t('notifications.noAlerts')}</Text>
                <Text style={styles.emptyBody}>{t('notifications.noAlertsBody')}</Text>
              </View>
            }
            refreshing={status === 'loading' && items.length > 0}
            onRefresh={() => dispatch(fetchNotifications())}
            showsVerticalScrollIndicator={false}
          />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  backBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  backBtnText: { color: palette.emerald, fontSize: 32, fontWeight: '300', lineHeight: 32 },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  unreadCountBadge: {
    backgroundColor: palette.emerald,
    borderRadius: 999,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    shadowColor: palette.emerald,
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  unreadCountText: {
    color: palette.onAccent,
    fontSize: 12,
    fontWeight: '900',
  },

  list: { paddingHorizontal: 16, paddingTop: 6 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  loadingText: { color: palette.textMuted, fontSize: 14, fontWeight: '700' },
  errorText: { color: palette.danger, fontSize: 14, fontWeight: '800', textAlign: 'center' },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: palette.textMuted, fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.cardBorder,
  },
});
