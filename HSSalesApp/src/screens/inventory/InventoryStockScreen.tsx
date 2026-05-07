import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMenuButton } from '../../components/navigation/AppMenuButton';
import { StackBackButton } from '../../components/navigation/StackBackButton';
import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { useT } from '../../i18n/useT';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { useAppSideMenu } from '../../navigation/useAppSideMenu';
import type { StockRow } from '../../types/models';
import { palette, radii, shadows } from '../../theme/designSystem';

type Section = { title: string; warehouseId: string; data: StockRow[] };

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Horizontal drift speed (px / frame) for the warehouse chip marquee. */
const MARQUEE_SPEED = 0.35;

export function InventoryStockScreen() {
  const t = useT();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const token = useAppSelector((s) => s.auth.token);
  const { stockRows, status, error } = useAppSelector((s) => s.inventory);
  const { warehouses } = useAppSelector((s) => s.salesData);
  const { menuModal, openMenu } = useAppSideMenu();

  const [search, setSearch] = useState('');
  const [activeWhId, setActiveWhId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const stockCardKey = useCallback(
    (item: StockRow) =>
      item.id || `${item.productId}-${item.warehouseId}-${item.lotId || item.lotNumber || 'row'}`,
    [],
  );

  const toBanglaDate = useCallback((raw?: string) => {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return new Intl.DateTimeFormat('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(d);
  }, []);

  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const isAutoScrolling = useRef(true);
  const contentWidth = useRef(0);
  const resumeMarqueeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pauseMarquee = useCallback(() => {
    if (resumeMarqueeTimerRef.current) {
      clearTimeout(resumeMarqueeTimerRef.current);
      resumeMarqueeTimerRef.current = null;
    }
    isAutoScrolling.current = false;
  }, []);

  const scheduleResumeMarquee = useCallback((delayMs: number) => {
    if (resumeMarqueeTimerRef.current) {
      clearTimeout(resumeMarqueeTimerRef.current);
    }
    resumeMarqueeTimerRef.current = setTimeout(() => {
      resumeMarqueeTimerRef.current = null;
      isAutoScrolling.current = true;
    }, delayMs);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeMarqueeTimerRef.current) {
        clearTimeout(resumeMarqueeTimerRef.current);
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        dispatch(fetchInventoryStock());
      }
    }, [dispatch, token]),
  );

  const filteredRows = useMemo(() => {
    let list = stockRows;
    if (activeWhId) {
      list = list.filter((r) => r.warehouseId === activeWhId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.warehouseName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [stockRows, activeWhId, search]);

  const sections: Section[] = useMemo(() => {
    const byWh = new Map<string, { id: string; rows: StockRow[] }>();
    for (const r of filteredRows) {
      const entry = byWh.get(r.warehouseName) ?? { id: r.warehouseId, rows: [] };
      entry.rows.push(r);
      byWh.set(r.warehouseName, entry);
    }
    return Array.from(byWh.entries()).map(([title, entry]) => ({
      title,
      warehouseId: entry.id,
      data: entry.rows.sort((a, b) => a.productName.localeCompare(b.productName)),
    }));
  }, [filteredRows]);

  const warehouseChips = useMemo(() => {
    return Array.from(new Set(stockRows.map((r) => r.warehouseId))).map((id) => {
      const wh = warehouses.find((w) => w.id === id);
      return { id, name: wh?.name || 'Warehouse' };
    });
  }, [stockRows, warehouses]);

  const marqueeData = useMemo(() => {
    if (warehouseChips.length === 0) return [];
    return [...warehouseChips, ...warehouseChips, ...warehouseChips];
  }, [warehouseChips]);

  useEffect(() => {
    let frameId: number;
    const drift = () => {
      if (isAutoScrolling.current && scrollRef.current && contentWidth.current > 0) {
        scrollX.current += MARQUEE_SPEED;
        const oneThird = contentWidth.current / 3;
        if (scrollX.current >= oneThird * 2) {
          scrollX.current -= oneThird;
        } else if (scrollX.current <= 0) {
          scrollX.current += oneThird;
        }
        scrollRef.current.scrollTo({ x: scrollX.current, animated: false });
      }
      frameId = requestAnimationFrame(drift);
    };
    frameId = requestAnimationFrame(drift);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    scrollX.current = x;
    if (contentWidth.current > 0) {
      const oneThird = contentWidth.current / 3;
      if (x >= oneThird * 2) {
        scrollRef.current?.scrollTo({ x: x - oneThird, animated: false });
      } else if (x <= 0) {
        scrollRef.current?.scrollTo({ x: x + oneThird, animated: false });
      }
    }
  };

  return (
    <MeshBackground>
      <StackBackButton />
      <AppMenuButton onPress={openMenu} />
      {menuModal}
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.head, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.title}>Stock room</Text>
        </View>

        <View style={styles.filterHub}>
          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveWhId(null);
            }}
            style={[
              styles.allBtn,
              activeWhId === null && styles.allBtnActive
            ]}>
            <Text style={[styles.allBtnText, activeWhId === null && styles.allBtnTextActive]}>
              All
            </Text>
          </Pressable>

          <View style={styles.carouselWrap}>
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={handleScroll}
              onScrollBeginDrag={pauseMarquee}
              onScrollEndDrag={() => scheduleResumeMarquee(450)}
              onMomentumScrollEnd={() => scheduleResumeMarquee(450)}
              onContentSizeChange={(w) => {
                contentWidth.current = w;
              }}
              contentContainerStyle={styles.carouselScroll}>
              {marqueeData.map((wh, idx) => {
                const isSelected = activeWhId === wh.id;

                return (
                  <Pressable
                    key={`${wh.id}-${idx}`}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    pressRetentionOffset={{ top: 32, bottom: 32, left: 20, right: 20 }}
                    onPressIn={pauseMarquee}
                    onPressOut={() => scheduleResumeMarquee(500)}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setActiveWhId(wh.id);
                      scheduleResumeMarquee(1200);
                    }}
                    style={[
                      styles.chip,
                      isSelected && styles.chipActive
                    ]}>
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {wh.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={styles.searchHub}>
          <TextInput
            style={styles.searchBar}
            value={search}
            onChangeText={setSearch}
            placeholder="Search…"
            placeholderTextColor={palette.textMuted}
          />
        </View>

        {status === 'loading' && stockRows.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.emerald} />
            <Text style={styles.hint}>{t('inventory.loading')}</Text>
          </View>
        ) : status === 'failed' ? (
          <View style={styles.center}>
            <Text style={styles.err}>{error}</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={stockCardKey}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHead}>
                <View style={styles.sectionIcon}>
                  <Text style={styles.sectionIconText}>🏠</Text>
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            )}
            renderItem={() => null}
            renderSectionFooter={({ section }) => (
              <FlatList
                horizontal
                data={section.data}
                keyExtractor={stockCardKey}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardRail}
                renderItem={({ item }) => {
                  const qty = item.quantityOnHand;
                  const isLow = qty <= 20;
                  const isMedium = qty > 20 && qty <= 100;
                  const cardId = stockCardKey(item);
                  const expanded = !!expandedCards[cardId];

                  return (
                    <View style={styles.cardRailItem}>
                      <Pressable
                        onPress={() =>
                          setExpandedCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }))
                        }>
                        <GlassCard
                          style={[
                            styles.card,
                            { backgroundColor: palette.night },
                            !expanded ? styles.cardCollapsedGlow : null,
                          ]}>
                        <View style={styles.cardLayout}>
                          <View style={styles.gaugeContainer}>
                            <View style={[styles.gaugeSegment, styles.gaugeGreen, qty > 100 && styles.activeSegment]} />
                            <View style={[styles.gaugeSegment, styles.gaugeYellow, isMedium && styles.activeSegment]} />
                            <View style={[styles.gaugeSegment, styles.gaugeRed, isLow && styles.activeSegment]} />
                          </View>

                          <View style={[styles.cardContent, !expanded && styles.cardContentCompact]}>
                            <View style={styles.cardGrid}>
                              <Text style={styles.pname}>{item.productName}</Text>
                              <Text style={styles.oneLineMetaQty}>
                                {qty.toLocaleString()} {item.unit || 'KG'}
                              </Text>
                            </View>
                            {expanded ? (
                              <View style={styles.cardMain}>
                                <Text style={styles.lotLine}>
                                  Purchase Lot: {item.lotNumber || 'N/A'}
                                </Text>
                                <Text style={styles.detailLine}>
                                  Unit Cost: ৳ {(item.unitCost || 0).toLocaleString()}
                                </Text>
                                <Text style={styles.detailLine}>
                                  নোট: {item.purchaseNotes?.trim() ? item.purchaseNotes : 'নোট নেই'}
                                </Text>
                                <Text style={styles.detailLine}>
                                  সময়: {toBanglaDate(item.purchaseDate || item.acquiredAt)}
                                </Text>
                                <View style={styles.healthBarContainer}>
                                  <View
                                    style={[
                                      styles.healthBar,
                                      { width: Math.min((qty / 500) * 100, 100) + '%' },
                                      isLow ? styles.healthLow : isMedium ? styles.healthMed : styles.healthOk
                                    ]}
                                  />
                                </View>
                              </View>
                            ) : null}
                          </View>
                        </View>
                          {expanded ? (
                            <Text style={styles.toggleHint}>সংক্ষিপ্ত দেখতে ট্যাপ করুন</Text>
                          ) : (
                            <Text style={styles.toggleHint}>বিস্তারিত দেখতে ট্যাপ করুন</Text>
                          )}
                        </GlassCard>
                      </Pressable>
                    </View>
                  );
                }}
              />
            )}
            ListEmptyComponent={
              <GlassCard style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No stock found</Text>
                <Text style={styles.emptyBody}>
                  {search
                    ? `No result for "${search}". Try a different filter.`
                    : "Your inventory list is empty. Receive some stock to begin."}
                </Text>
              </GlassCard>
            }
          />
        )}
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  head: { paddingHorizontal: 24, paddingBottom: 10 },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  sub: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  filterHub: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    marginBottom: 10,
  },
  allBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0,230,118,0.15)',
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 10,
  },
  allBtnActive: {
    backgroundColor: palette.emerald,
    borderColor: palette.emeraldDeep,
  },
  allBtnText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '900',
  },
  allBtnTextActive: {
    color: palette.onAccent,
  },
  carouselWrap: { flex: 1 },
  carouselScroll: { paddingRight: 24, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0,200,83,0.12)',
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  chipActive: {
    backgroundColor: palette.emerald,
    borderColor: palette.emeraldDeep,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.text,
  },
  chipTextActive: {
    color: palette.onAccent,
  },
  searchHub: {
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  searchBar: {
    backgroundColor: palette.inputInset,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: palette.text,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: palette.stroke,
    ...shadows.card,
  },
  list: { paddingHorizontal: 20, paddingBottom: 60 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(157,255,117,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(191,255,159,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9DFF75',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  sectionIconText: { fontSize: 13 },
  sectionTitle: {
    color: '#E9FFE3',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textShadowColor: 'rgba(157,255,117,0.30)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  card: {
    marginBottom: 10,
    paddingVertical: 0,
    paddingHorizontal: 0,
    overflow: 'hidden',
    borderRadius: radii.lg,
  },
  cardCollapsedGlow: {
    borderWidth: 1,
    borderColor: 'rgba(157,255,117,0.45)',
    shadowColor: '#9DFF75',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  cardRail: {
    paddingRight: 12,
    paddingBottom: 4,
  },
  cardRailItem: {
    width: 284,
    marginRight: 12,
  },
  cardLayout: { flexDirection: 'row' },
  gaugeContainer: { width: 6, backgroundColor: 'rgba(0,0,0,0.05)' },
  gaugeSegment: { flex: 1, opacity: 0.15 },
  activeSegment: { opacity: 1 },
  gaugeGreen: { backgroundColor: palette.emeraldDeep },
  gaugeYellow: { backgroundColor: palette.amber },
  gaugeRed: { backgroundColor: palette.rose },
  cardContent: { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  cardContentCompact: { paddingVertical: 9 },
  cardGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardMain: { flex: 1, gap: 8 },
  cardSide: { alignItems: 'flex-end', minWidth: 80 },
  pname: { color: palette.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  oneLineMetaQty: {
    color: '#9DFF75',
    fontSize: 14,
    fontWeight: '900',
    textShadowColor: 'rgba(157,255,117,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  lotLine: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  detailLine: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: -2,
  },
  healthBarContainer: {
    height: 4,
    width: '85%',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  healthBar: { height: '100%', borderRadius: 2 },
  healthOk: { backgroundColor: palette.emeraldDeep },
  healthMed: { backgroundColor: palette.amber },
  healthLow: { backgroundColor: palette.rose },
  qty: { color: palette.text, fontSize: 18, fontWeight: '900' },
  unit: { color: palette.textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  costBox: { marginTop: 6, alignItems: 'flex-end', backgroundColor: 'rgba(0,230,118,0.06)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 },
  costLabel: { fontSize: 8, fontWeight: '800', color: palette.textMuted, textTransform: 'uppercase', marginBottom: 1 },
  costVal: { fontSize: 11, fontWeight: '800', color: palette.emeraldDeep },
  toggleHint: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingBottom: 2,
    marginTop: 0,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { marginTop: 10, color: palette.textMuted, fontWeight: '600' },
  err: { color: palette.danger, fontWeight: '700', textAlign: 'center' },
  emptyCard: { marginTop: 20, alignItems: 'center', padding: 24, backgroundColor: palette.night },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  emptyBody: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
});
