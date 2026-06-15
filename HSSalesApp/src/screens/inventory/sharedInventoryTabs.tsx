import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
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

import * as inventoryApi from '../../api/inventory';
import { generateBengaliLotNumber } from '../../utils/lotNumber';
import { SelectMenu } from '../../components/ui/SelectMenu';
import { GlassCard } from '../../components/ui/GlassCard';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { fetchSalesDataset } from '../../store/slices/salesDataSlice';
import { showToast } from '../../store/slices/uiSlice';
import type { StockRow } from '../../types/models';
import { palette, radii, shadows } from '../../theme/designSystem';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MARQUEE_SPEED = 0.35;

// ── Stock Tab ─────────────────────────────────────────────────────────────────

type StockSection = { title: string; warehouseId: string; data: StockRow[] };

export function StockTab({ bottomPad = 60 }: { bottomPad?: number }) {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const { stockRows, status, error } = useAppSelector((s) => s.inventory);
  const { warehouses } = useAppSelector((s) => s.salesData);

  const [search, setSearch] = useState('');
  const [activeWhId, setActiveWhId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const isAutoScrolling = useRef(true);
  const contentWidth = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pauseMarquee = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    isAutoScrolling.current = false;
  }, []);

  const scheduleResume = useCallback((ms: number) => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      isAutoScrolling.current = true;
    }, ms);
  }, []);

  useEffect(() => () => { if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current); }, []);

  const stockCardKey = useCallback(
    (item: StockRow) => item.id || `${item.productId}-${item.warehouseId}-${item.lotId || item.lotNumber || 'row'}`,
    [],
  );

  const toBanglaDate = useCallback((raw?: string) => {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return new Intl.DateTimeFormat('bn-BD', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(d);
  }, []);

  const filteredRows = useMemo(() => {
    let list = stockRows;
    if (activeWhId) list = list.filter((r) => r.warehouseId === activeWhId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.productName.toLowerCase().includes(q) || r.warehouseName.toLowerCase().includes(q));
    }
    return list;
  }, [stockRows, activeWhId, search]);

  const sections: StockSection[] = useMemo(() => {
    const byWh = new Map<string, { id: string; rows: StockRow[] }>();
    for (const r of filteredRows) {
      const entry = byWh.get(r.warehouseName) ?? { id: r.warehouseId, rows: [] };
      entry.rows.push(r);
      byWh.set(r.warehouseName, entry);
    }
    return Array.from(byWh.entries()).map(([title, entry]) => ({
      title, warehouseId: entry.id,
      data: entry.rows.sort((a, b) => a.productName.localeCompare(b.productName)),
    }));
  }, [filteredRows]);

  const warehouseChips = useMemo(() =>
    Array.from(new Set(stockRows.map((r) => r.warehouseId))).map((id) => {
      const wh = warehouses.find((w) => w.id === id);
      return { id, name: wh?.name || 'Warehouse' };
    }), [stockRows, warehouses]);

  const useMarquee = warehouseChips.length >= 3;
  const marqueeData = useMemo(() =>
    useMarquee ? [...warehouseChips, ...warehouseChips, ...warehouseChips] : warehouseChips,
    [warehouseChips, useMarquee]);

  useEffect(() => {
    if (!useMarquee) return;
    let frameId: number;
    const drift = () => {
      if (isAutoScrolling.current && scrollRef.current && contentWidth.current > 0) {
        scrollX.current += MARQUEE_SPEED;
        const oneThird = contentWidth.current / 3;
        if (scrollX.current >= oneThird * 2) scrollX.current -= oneThird;
        else if (scrollX.current <= 0) scrollX.current += oneThird;
        scrollRef.current.scrollTo({ x: scrollX.current, animated: false });
      }
      frameId = requestAnimationFrame(drift);
    };
    frameId = requestAnimationFrame(drift);
    return () => cancelAnimationFrame(frameId);
  }, [useMarquee]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    scrollX.current = x;
    if (contentWidth.current > 0) {
      const oneThird = contentWidth.current / 3;
      if (x >= oneThird * 2) scrollRef.current?.scrollTo({ x: x - oneThird, animated: false });
      else if (x <= 0) scrollRef.current?.scrollTo({ x: x + oneThird, animated: false });
    }
  };

  return (
    <View style={st.root}>
      {/* Warehouse filter */}
      <View style={st.filterHub}>
        <Pressable
          onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveWhId(null); }}
          style={[st.allBtn, activeWhId === null && st.allBtnActive]}>
          <Text style={[st.allBtnText, activeWhId === null && st.allBtnTextActive]}>All</Text>
        </Pressable>
        <View style={st.carouselWrap}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={handleScroll}
            onScrollBeginDrag={pauseMarquee}
            onScrollEndDrag={() => scheduleResume(450)}
            onMomentumScrollEnd={() => scheduleResume(450)}
            onContentSizeChange={(w) => { contentWidth.current = w; }}
            contentContainerStyle={st.carouselScroll}>
            {marqueeData.map((wh, idx) => {
              const isSelected = activeWhId === wh.id;
              return (
                <Pressable
                  key={`${wh.id}-${idx}`}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  onPressIn={pauseMarquee}
                  onPressOut={() => scheduleResume(500)}
                  onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveWhId(wh.id); scheduleResume(1200); }}
                  style={[st.chip, isSelected && st.chipActive]}>
                  <Text style={[st.chipText, isSelected && st.chipTextActive]}>{wh.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Search */}
      <View style={st.searchHub}>
        <TextInput
          style={st.searchBar}
          value={search}
          onChangeText={setSearch}
          placeholder="Search product or warehouse…"
          placeholderTextColor={palette.textMuted}
        />
      </View>

      {status === 'loading' && stockRows.length === 0 ? (
        <View style={st.center}>
          <ActivityIndicator color={palette.emerald} />
          <Text style={st.hint}>Loading stock…</Text>
        </View>
      ) : status === 'failed' ? (
        <View style={st.center}><Text style={st.err}>{error}</Text></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={stockCardKey}
          contentContainerStyle={[st.list, { paddingBottom: bottomPad }]}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={st.sectionHead}>
              <View style={st.sectionIcon}><Text style={st.sectionIconText}>🏠</Text></View>
              <Text style={st.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={() => null}
          renderSectionFooter={({ section }) => (
            <FlatList
              horizontal
              data={section.data}
              keyExtractor={stockCardKey}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.cardRail}
              renderItem={({ item }) => {
                const qty = item.quantityOnHand;
                const isLow = qty <= 20;
                const isMedium = qty > 20 && qty <= 100;
                const cardId = stockCardKey(item);
                const expanded = !!expandedCards[cardId];
                return (
                  <View style={st.cardRailItem}>
                    <Pressable onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));
                      setExpandedCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
                    }}>
                      <GlassCard style={[st.card, { backgroundColor: palette.night }, !expanded ? st.cardCollapsedGlow : null]}>
                        <View style={st.cardLayout}>
                          <View style={st.gaugeContainer}>
                            <View style={[st.gaugeSegment, st.gaugeGreen, qty > 100 && st.activeSegment]} />
                            <View style={[st.gaugeSegment, st.gaugeYellow, isMedium && st.activeSegment]} />
                            <View style={[st.gaugeSegment, st.gaugeRed, isLow && st.activeSegment]} />
                          </View>
                          <View style={[st.cardContent, !expanded && st.cardContentCompact]}>
                            <View style={st.cardGrid}>
                              <Text style={st.pname} numberOfLines={1}>{item.productName}</Text>
                              <Text style={st.oneLineMetaQty}>{qty.toLocaleString()} {item.unit || 'KG'}</Text>
                            </View>
                            {expanded && (
                              <View style={st.cardMain}>
                                <Text style={st.lotLine}>Lot: {item.lotNumber || 'N/A'}</Text>
                                <Text style={st.detailLine}>Unit Cost: ৳ {(item.unitCost || 0).toLocaleString()}</Text>
                                <Text style={st.detailLine}>নোট: {item.purchaseNotes?.trim() ? item.purchaseNotes : '—'}</Text>
                                <Text style={st.detailLine}>তারিখ: {toBanglaDate(item.purchaseDate || item.acquiredAt)}</Text>
                                <View style={st.healthBarContainer}>
                                  <View style={[st.healthBar, { width: `${Math.min((qty / 500) * 100, 100)}%` as `${number}%` }, isLow ? st.healthLow : isMedium ? st.healthMed : st.healthOk]} />
                                </View>
                              </View>
                            )}
                          </View>
                        </View>
                        <Text style={st.toggleHint}>{expanded ? 'সংক্ষিপ্ত করতে ট্যাপ করুন' : 'বিস্তারিত দেখতে ট্যাপ করুন'}</Text>
                      </GlassCard>
                    </Pressable>
                  </View>
                );
              }}
              ListEmptyComponent={
                <GlassCard style={st.emptyCard}>
                  <Text style={st.emptyTitle}>No stock found</Text>
                  <Text style={st.emptyBody}>{search ? `No result for "${search}".` : 'Receive some stock to begin.'}</Text>
                </GlassCard>
              }
            />
          )}
          ListEmptyComponent={
            <GlassCard style={st.emptyCard}>
              <Text style={st.emptyTitle}>No stock found</Text>
              <Text style={st.emptyBody}>Receive some stock to begin.</Text>
            </GlassCard>
          }
        />
      )}
    </View>
  );
}

export const st = StyleSheet.create({
  root: { flex: 1 },
  filterHub: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, marginBottom: 10 },
  allBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.md, backgroundColor: 'rgba(0,168,255,0.10)', borderWidth: 1, borderColor: 'transparent', marginRight: 10 },
  allBtnActive: { backgroundColor: palette.emerald, borderColor: palette.emeraldDeep },
  allBtnText: { color: palette.text, fontSize: 13, fontWeight: '900' },
  allBtnTextActive: { color: palette.onAccent },
  carouselWrap: { flex: 1 },
  carouselScroll: { paddingRight: 20, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.md, backgroundColor: 'rgba(0,168,255,0.08)', borderWidth: 1, borderColor: 'transparent', overflow: 'hidden' },
  chipActive: { backgroundColor: palette.emerald, borderColor: palette.emeraldDeep },
  chipText: { fontSize: 13, fontWeight: '900', color: palette.text },
  chipTextActive: { color: palette.onAccent },
  searchHub: { marginBottom: 8, paddingHorizontal: 20 },
  searchBar: { backgroundColor: palette.inputInset, borderRadius: radii.md, paddingHorizontal: 16, paddingVertical: 12, color: palette.text, fontWeight: '700', borderWidth: 1, borderColor: palette.stroke, ...shadows.card },
  list: { paddingHorizontal: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(0,168,255,0.14)', borderWidth: 1, borderColor: 'rgba(0,168,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  sectionIconText: { fontSize: 13 },
  sectionTitle: { color: palette.emerald, fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  card: { marginBottom: 10, paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden', borderRadius: radii.lg },
  cardCollapsedGlow: { borderWidth: 1, borderColor: 'rgba(0,168,255,0.35)', shadowColor: palette.emerald, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
  cardRail: { paddingRight: 12, paddingBottom: 4 },
  cardRailItem: { width: 284, marginRight: 12 },
  cardLayout: { flexDirection: 'row' },
  gaugeContainer: { width: 6, backgroundColor: 'rgba(0,0,0,0.05)' },
  gaugeSegment: { flex: 1, opacity: 0.15 },
  activeSegment: { opacity: 1 },
  gaugeGreen: { backgroundColor: palette.emerald },
  gaugeYellow: { backgroundColor: palette.violet },
  gaugeRed: { backgroundColor: palette.rose },
  cardContent: { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  cardContentCompact: { paddingVertical: 9 },
  cardGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardMain: { flex: 1, gap: 8 },
  pname: { color: palette.text, fontSize: 16, fontWeight: '900', letterSpacing: -0.3, flex: 1 },
  oneLineMetaQty: { color: palette.emerald, fontSize: 14, fontWeight: '900' },
  lotLine: { color: palette.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  detailLine: { color: palette.textMuted, fontSize: 11, fontWeight: '700' },
  healthBarContainer: { height: 4, width: '85%', backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 2, overflow: 'hidden' },
  healthBar: { height: '100%', borderRadius: 2 },
  healthOk: { backgroundColor: palette.emerald },
  healthMed: { backgroundColor: palette.violet },
  healthLow: { backgroundColor: palette.rose },
  toggleHint: { color: palette.textMuted, fontSize: 10, fontWeight: '700', paddingHorizontal: 14, paddingBottom: 6, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { marginTop: 10, color: palette.textMuted, fontWeight: '600' },
  err: { color: palette.danger, fontWeight: '700', textAlign: 'center' },
  emptyCard: { marginTop: 20, alignItems: 'center', padding: 24, backgroundColor: palette.night },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  emptyBody: { marginTop: 8, color: palette.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '600' },
});

// ── Receive Tab ───────────────────────────────────────────────────────────────

type ReceiveLineDraft = { id: string; productId: string; quantity: string; unitCost: string; extraCost: string; unitId: string; lotNumber: string; notes: string };

function newReceiveLine(pid = '', unitId = ''): ReceiveLineDraft {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, productId: pid, quantity: '1', unitCost: '', extraCost: '', unitId, lotNumber: '', notes: '' };
}

export function ReceiveTab({ bottomPad = 40 }: { bottomPad?: number }) {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const { products, warehouses, units, status: dataStatus } = useAppSelector((s) => s.salesData);

  const directWarehouseId = useMemo(
    () => warehouses.find((w) => w.name.toLowerCase() === 'direct')?.id ?? warehouses[0]?.id ?? '',
    [warehouses],
  );

  const [warehouseId, setWarehouseId] = useState('');
  const resolvedWarehouseId = warehouseId || directWarehouseId;
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<ReceiveLineDraft[]>([newReceiveLine()]);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(() => new Set([lines[0].id]));
  const [busy, setBusy] = useState(false);

  const warehouseOptions = useMemo(() => [
    { value: '', label: 'Direct (default)' },
    ...warehouses.filter((w) => w.name.toLowerCase() !== 'direct').map((w) => ({ value: w.id, label: w.name })),
  ], [warehouses]);

  const productOptions = useMemo(() => products.map((p) => ({ value: p.id, label: p.name })), [products]);

  useEffect(() => {
    if (lines.length === 0) { const f = newReceiveLine(); setLines([f]); setExpandedLines(new Set([f.id])); }
  }, [lines.length]);

  function toggleExpand(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedLines((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const canSubmit = useMemo(() => {
    if (!token || busy || !resolvedWarehouseId || lines.length === 0) return false;
    for (const ln of lines) {
      const q = Number(ln.quantity), c = Number(ln.unitCost);
      const u = units.find(x => x.id === ln.unitId);
      if (!ln.productId || !ln.unitId || !Number.isFinite(q) || q <= 0) return false;
      if (!Number.isFinite(c) || c < 0) return false;
      if (u?.isWholeNumber && !Number.isInteger(q)) return false;
    }
    return true;
  }, [token, busy, resolvedWarehouseId, lines, units]);

  async function onSubmit() {
    if (!token || !canSubmit) return;
    try {
      setBusy(true);
      await inventoryApi.createPurchase({
        warehouseId: resolvedWarehouseId,
        purchaseDate: /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ? purchaseDate : undefined,
        items: lines.map((ln) => {
          const qty = Number(ln.quantity), baseCost = Number(ln.unitCost), extra = Number(ln.extraCost) || 0;
          const effectiveUnitCost = qty > 0 ? (qty * baseCost + extra) / qty : baseCost;
          const noteParts = [`bc:${baseCost}`, extra > 0 ? `ec:${extra}` : null, ln.notes.trim() || null].filter(Boolean).join('|');
          return { productId: ln.productId, quantity: qty, unitCost: effectiveUnitCost, baseUnitCost: baseCost, notes: noteParts || undefined, unitId: ln.unitId, lotNumber: ln.lotNumber.trim() || generateBengaliLotNumber() };
        }),
      }, token);
      await dispatch(fetchSalesDataset()).unwrap();
      await dispatch(fetchInventoryStock()).unwrap();
      dispatch(showToast({ title: 'Received', message: 'Purchase recorded. Stock room reflects new lots.', type: 'success' }));
      setWarehouseId('');
      const f = newReceiveLine();
      setLines([f]);
      setExpandedLines(new Set([f.id]));
      setPurchaseDate(new Date().toISOString().slice(0, 10));
    } catch (e: any) {
      dispatch(showToast({ title: 'Could not receive', message: e?.message ?? 'Unknown error', type: 'error' }));
    } finally { setBusy(false); }
  }

  if (dataStatus === 'loading' && products.length === 0) {
    return <View style={rf.center}><ActivityIndicator color={palette.emerald} /></View>;
  }

  return (
    <KeyboardAvoidingView style={rf.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[rf.scroll, { paddingBottom: bottomPad }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Summary header */}
        <View style={rf.summaryRow}>
          <View style={rf.summaryChip}>
            <Text style={rf.summaryChipLabel}>Lines</Text>
            <Text style={rf.summaryChipVal}>{lines.length}</Text>
          </View>
          <View style={[rf.summaryChip, { borderColor: 'rgba(255,179,0,0.30)', backgroundColor: 'rgba(255,179,0,0.08)' }]}>
            <Text style={[rf.summaryChipLabel, { color: palette.violet }]}>Date</Text>
            <Text style={[rf.summaryChipVal, { color: palette.violet }]}>{purchaseDate}</Text>
          </View>
        </View>

        <GlassCard>
          <SelectMenu label="Destination warehouse" value={warehouseId} options={warehouseOptions} onChange={setWarehouseId} placeholder="Select warehouse" />
          <Text style={rf.label}>Receive date</Text>
          <TextInput value={purchaseDate} onChangeText={setPurchaseDate} placeholder="YYYY-MM-DD" placeholderTextColor={palette.textMuted} style={rf.input} />
        </GlassCard>

        {lines.map((ln, idx) => {
          const isExpanded = expandedLines.has(ln.id);
          const baseUnitLabel = units.find(u => u.id === products.find(p => p.id === ln.productId)?.unitId)?.label || 'base unit';
          return (
            <GlassCard key={ln.id} style={rf.lineCard}>
              <Pressable onPress={() => toggleExpand(ln.id)} style={({ pressed }) => [rf.lineHead, pressed && { opacity: 0.7 }]}>
                <View style={rf.lineHeadLeft}>
                  <View style={[rf.lineNumBadge, isExpanded && rf.lineNumBadgeActive]}>
                    <Text style={[rf.lineNum, isExpanded && rf.lineNumActive]}>{idx + 1}</Text>
                  </View>
                  <View>
                    <Text style={rf.cardTitle}>{ln.productId ? products.find(p => p.id === ln.productId)?.name : 'Select product'}</Text>
                    {!isExpanded && ln.quantity && ln.unitCost ? (
                      <Text style={rf.lineCollapsedMeta}>
                        {ln.quantity} × ৳{ln.unitCost} {ln.extraCost ? `+ ৳${ln.extraCost} extra` : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={rf.lineHeadRight}>
                  {lines.length > 1 && (
                    <Pressable hitSlop={8} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setLines((prev) => prev.filter((x) => x.id !== ln.id)); }}>
                      <Text style={rf.remove}>✕</Text>
                    </Pressable>
                  )}
                  <Text style={rf.arrow}>{isExpanded ? '▼' : '▶'}</Text>
                </View>
              </Pressable>

              {isExpanded && (
                <View style={rf.lineContent}>
                  <SelectMenu label="Product" value={ln.productId} options={productOptions} onChange={(pid) => { const p = products.find(x => x.id === pid); setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, productId: pid, unitId: p?.unitId || '' } : x)); }} placeholder="Select product" />
                  <View style={rf.qtyUnitRow}>
                    <View style={{ flex: 0.55 }}>
                      <Text style={rf.label}>Quantity</Text>
                      <TextInput value={ln.quantity} onChangeText={(t) => setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, quantity: t } : x))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={palette.textMuted} style={rf.input} />
                    </View>
                    <View style={{ flex: 0.45 }}>
                      <SelectMenu label="Unit" value={ln.unitId} options={units.filter(u => { const p = products.find(prod => prod.id === ln.productId); if (!p) return u.globalFactor !== undefined; return u.globalFactor !== undefined || (p.conversions && p.conversions[u.id] !== undefined) || u.id === p.unitId; }).map(u => ({ value: u.id, label: u.label }))} onChange={(uid) => setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, unitId: uid } : x))} placeholder="Unit" />
                    </View>
                  </View>
                  <Text style={rf.label}>Cost per {baseUnitLabel} (৳)</Text>
                  <TextInput value={ln.unitCost} onChangeText={(t) => setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, unitCost: t } : x))} placeholder="0" placeholderTextColor={palette.textMuted} keyboardType="decimal-pad" style={rf.input} />
                  <Text style={rf.label}>Extra Cost — transport, loading…</Text>
                  <TextInput value={ln.extraCost} onChangeText={(t) => setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, extraCost: t } : x))} placeholder="0 (optional)" placeholderTextColor={palette.textMuted} keyboardType="decimal-pad" style={rf.input} />
                  <Text style={rf.label}>Notes</Text>
                  <TextInput value={ln.notes} onChangeText={(t) => setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, notes: t } : x))} placeholder="Vendor, invoice #…" placeholderTextColor={palette.textMuted} style={[rf.input, { minHeight: 48 }]} />
                  {Number(ln.quantity) > 0 && Number(ln.unitCost) > 0 && (() => {
                    const qty = Number(ln.quantity), baseCost = Number(ln.unitCost), extra = Number(ln.extraCost) || 0;
                    const baseTot = qty * baseCost, total = baseTot + extra, effective = qty > 0 ? total / qty : baseCost;
                    return (
                      <View style={rf.lineSummary}>
                        <Text style={rf.lineSummaryText}>
                          Base: ৳{baseTot.toLocaleString()}{extra > 0 ? `  ·  Extra: ৳${extra.toLocaleString()}` : ''}{'\n'}
                          Total: <Text style={rf.lineSummaryVal}>৳{total.toLocaleString()}</Text>
                        </Text>
                        <Text style={rf.lineSummaryNote}>Effective: ৳{effective.toFixed(2)} per {baseUnitLabel}</Text>
                      </View>
                    );
                  })()}
                </View>
              )}
            </GlassCard>
          );
        })}

        <Pressable onPress={() => { const n = newReceiveLine(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setLines((prev) => [...prev, n]); setExpandedLines((prev) => new Set([...prev, n.id])); }} style={rf.addLine}>
          <Text style={rf.addLineIcon}>＋</Text>
          <Text style={rf.addLineText}>Add product line</Text>
        </Pressable>

        <Pressable onPress={onSubmit} disabled={!canSubmit} style={({ pressed }) => [rf.primary, !canSubmit && rf.primaryDisabled, pressed && canSubmit && rf.primaryPressed]}>
          {busy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={rf.primaryText}>Record purchase</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const rf = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  summaryChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.md, backgroundColor: 'rgba(0,168,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,168,255,0.22)' },
  summaryChipLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  summaryChipVal: { color: palette.emerald, fontSize: 14, fontWeight: '900' },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: '900' },
  lineCollapsedMeta: { color: palette.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  label: { marginTop: 14, color: palette.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { marginTop: 8, borderRadius: radii.md, borderWidth: 1, borderColor: palette.stroke, paddingHorizontal: 14, paddingVertical: Platform.select({ ios: 13, android: 11, default: 11 }), color: palette.text, backgroundColor: palette.inputInset, fontWeight: '600' },
  lineCard: {},
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  lineHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  lineHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineNumBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cardBgElevated, borderWidth: 1, borderColor: palette.cardBorder },
  lineNumBadgeActive: { backgroundColor: 'rgba(0,168,255,0.18)', borderColor: 'rgba(0,168,255,0.45)' },
  lineNum: { color: palette.textMuted, fontSize: 12, fontWeight: '900' },
  lineNumActive: { color: palette.emerald },
  arrow: { color: palette.textMuted, fontSize: 12, fontWeight: '900' },
  remove: { color: palette.rose, fontWeight: '900', fontSize: 16, paddingHorizontal: 4 },
  lineContent: { marginTop: 8 },
  qtyUnitRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  lineSummary: { marginTop: 12, padding: 12, backgroundColor: 'rgba(0,168,255,0.06)', borderRadius: radii.sm, borderLeftWidth: 3, borderLeftColor: palette.emerald },
  lineSummaryText: { fontSize: 13, fontWeight: '700', color: palette.text },
  lineSummaryVal: { color: palette.emerald, fontWeight: '900' },
  lineSummaryNote: { fontSize: 10, fontWeight: '600', color: palette.textMuted, marginTop: 4, fontStyle: 'italic' },
  addLine: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,168,255,0.35)', borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: 16 },
  addLineIcon: { color: palette.emerald, fontSize: 18, fontWeight: '900', lineHeight: 20 },
  addLineText: { color: palette.emerald, fontWeight: '900', fontSize: 14 },
  primary: { marginTop: 4, borderRadius: radii.lg, paddingVertical: 16, alignItems: 'center', backgroundColor: palette.emerald, shadowColor: palette.emerald, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  primaryDisabled: { opacity: 0.45 },
  primaryPressed: { backgroundColor: palette.emeraldDeep },
  primaryText: { color: palette.onAccent, fontWeight: '900', fontSize: 15 },
});

// ── Move Tab ──────────────────────────────────────────────────────────────────

type MoveLineDraft = { id: string; productId: string; quantity: string; unitId: string };

function newMoveLine(pid = '', unitId = ''): MoveLineDraft {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, productId: pid, quantity: '1', unitId };
}

export function MoveTab({ bottomPad = 40 }: { bottomPad?: number }) {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);
  const { products, warehouses, units, lots, status: dataStatus } = useAppSelector((s) => s.salesData);
  const stockRows = useAppSelector((s) => s.inventory.stockRows);

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<MoveLineDraft[]>([newMoveLine()]);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const fromOptions = useMemo(() => warehouses.map((w) => ({ value: w.id, label: w.name })), [warehouses]);
  const toOptions = useMemo(() => fromId ? warehouses.filter(w => w.id !== fromId).map((w) => ({ value: w.id, label: w.name })) : [], [warehouses, fromId]);
  const productOptions = useMemo(() => {
    if (!fromId) return [];
    const avail = new Set(stockRows.filter((r) => r.warehouseId === fromId && r.quantityOnHand > 0).map((r) => r.productId));
    return products.filter((p) => avail.has(p.id)).map((p) => ({ value: p.id, label: p.name }));
  }, [products, stockRows, fromId]);

  useEffect(() => { if (fromId) setToId(''); }, [fromId]);
  useEffect(() => { if (lines.length === 0) { const f = newMoveLine(); setLines([f]); setExpandedLines(new Set([f.id])); } }, [lines.length]);

  function toggleExpand(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedLines((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const canSubmit = useMemo(() => {
    if (!token || role !== 'admin' || busy || !fromId || !toId || fromId === toId) return false;
    for (const ln of lines) {
      const q = Number(ln.quantity);
      if (!ln.productId || !Number.isFinite(q) || q <= 0) return false;
      const p = products.find((x) => x.id === ln.productId);
      const u = units.find((x) => x.id === ln.unitId);
      const factor = u?.globalFactor ?? p?.conversions?.[u?.id || ''] ?? 1;
      const requested = q * factor;
      const avail = stockRows.filter((r) => r.warehouseId === fromId && r.productId === ln.productId).reduce((s, r) => s + r.quantityOnHand, 0);
      if (requested > avail) return false;
    }
    return true;
  }, [token, role, busy, fromId, toId, lines, stockRows, products, units]);

  async function onSubmit() {
    if (!token || !canSubmit) return;
    try {
      setBusy(true);
      await inventoryApi.createTransfer({
        fromWarehouseId: fromId, toWarehouseId: toId,
        transferDate: /^\d{4}-\d{2}-\d{2}$/.test(transferDate) ? transferDate : undefined,
        lines: lines.map((ln) => {
          const p = products.find((x) => x.id === ln.productId), u = units.find((x) => x.id === ln.unitId);
          const factor = u?.globalFactor ?? p?.conversions?.[u?.id || ''] ?? 1;
          return { productId: ln.productId, quantity: Number(ln.quantity) * factor };
        }),
      }, token);
      await dispatch(fetchInventoryStock()).unwrap();
      dispatch(showToast({ title: 'Transferred', message: 'FIFO move applied. Check Stock tab.', type: 'success' }));
      setLines([newMoveLine()]);
      setTransferDate(new Date().toISOString().slice(0, 10));
    } catch (e: any) {
      dispatch(showToast({ title: 'Could not transfer', message: e?.message ?? 'Unknown error', type: 'error' }));
    } finally { setBusy(false); }
  }

  if (role !== 'admin') {
    return (
      <View style={mv.center}>
        <Text style={mv.lockIcon}>🔒</Text>
        <Text style={mv.lockTitle}>Admin only</Text>
        <Text style={mv.lockBody}>Only administrators can run warehouse transfers.</Text>
      </View>
    );
  }

  if (warehouses.length < 2) {
    return (
      <View style={mv.center}>
        <Text style={mv.lockIcon}>🏠</Text>
        <Text style={mv.lockTitle}>Two warehouses needed</Text>
        <Text style={mv.lockBody}>Seed at least two warehouses in db.json to use transfers.</Text>
      </View>
    );
  }

  if (dataStatus === 'loading' && products.length === 0) {
    return <View style={mv.center}><ActivityIndicator color={palette.emerald} /></View>;
  }

  const fromName = warehouses.find(w => w.id === fromId)?.name;
  const toName = warehouses.find(w => w.id === toId)?.name;

  return (
    <KeyboardAvoidingView style={mv.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[mv.scroll, { paddingBottom: bottomPad }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Route indicator */}
        {fromId && toId && (
          <View style={mv.routeCard}>
            <Text style={mv.routeFrom}>{fromName}</Text>
            <View style={mv.routeArrowWrap}>
              <View style={mv.routeArrowLine} />
              <Text style={mv.routeArrow}>→</Text>
              <View style={mv.routeArrowLine} />
            </View>
            <Text style={mv.routeTo}>{toName}</Text>
          </View>
        )}

        <GlassCard>
          <View style={mv.warehouseRow}>
            <View style={mv.warehouseSide}>
              <SelectMenu label="From" value={fromId} options={fromOptions} onChange={setFromId} placeholder="Source warehouse" />
            </View>
            <View style={mv.arrowPill}>
              <View style={mv.arrowLine} />
              <View style={mv.arrowHead} />
            </View>
            <View style={mv.warehouseSide}>
              <SelectMenu label="To" value={toId} options={toOptions} onChange={setToId} placeholder={fromId ? 'Select destination' : 'Select source first'} />
            </View>
          </View>
          <Text style={mv.label}>Transfer date</Text>
          <TextInput value={transferDate} onChangeText={setTransferDate} placeholder="YYYY-MM-DD" placeholderTextColor={palette.textMuted} style={mv.input} />
        </GlassCard>

        {lines.map((ln, idx) => {
          const isExpanded = expandedLines.has(ln.id);
          const prodName = products.find(p => p.id === ln.productId)?.name;
          return (
            <GlassCard key={ln.id} style={mv.lineCard}>
              <Pressable onPress={() => toggleExpand(ln.id)} style={({ pressed }) => [mv.lineHead, pressed && { opacity: 0.7 }]}>
                <View style={mv.lineHeadLeft}>
                  <View style={[mv.lineNumBadge, isExpanded && mv.lineNumBadgeActive]}>
                    <Text style={[mv.lineNum, isExpanded && mv.lineNumActive]}>{idx + 1}</Text>
                  </View>
                  <Text style={mv.cardTitle}>{prodName ?? 'Select product'}</Text>
                </View>
                <View style={mv.lineHeadRight}>
                  {lines.length > 1 && (
                    <Pressable hitSlop={8} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setLines((prev) => prev.filter((x) => x.id !== ln.id)); }}>
                      <Text style={mv.remove}>✕</Text>
                    </Pressable>
                  )}
                  <Text style={mv.arrow}>{isExpanded ? '▼' : '▶'}</Text>
                </View>
              </Pressable>

              {isExpanded && (
                <View style={mv.lineContent}>
                  <SelectMenu label="Product" value={ln.productId} options={productOptions} onChange={(pid) => { const p = products.find(x => x.id === pid); setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, productId: pid, unitId: p?.unitId || '' } : x)); }} placeholder={fromId ? 'Select product' : 'Choose source warehouse first'} />

                  {ln.productId ? (
                    <View style={mv.stockHintWrap}>
                      {stockRows.filter(r => r.warehouseId === fromId && r.productId === ln.productId && r.quantityOnHand > 0).map((r, i) => {
                        const lot = lots?.find(l => l.id === r.batchLotId);
                        return (
                          <View key={r.id || i} style={mv.stockHintRow}>
                            <Text style={mv.stockHintDot}>✓</Text>
                            <Text style={mv.stockHintText}>
                              {r.quantityOnHand.toLocaleString()} available{lot ? ` · ${lot.lotNumber}` : ''}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}

                  <View style={mv.qtyUnitRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={mv.label}>Quantity</Text>
                      <TextInput value={ln.quantity} onChangeText={(t) => setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, quantity: t } : x))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={palette.textMuted} style={mv.input} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <SelectMenu label="Unit" value={ln.unitId} options={units.filter(u => { const p = products.find(prod => prod.id === ln.productId); if (!p) return u.globalFactor !== undefined; return u.globalFactor !== undefined || (p.conversions && p.conversions[u.id] !== undefined) || u.id === p.unitId; }).map(u => ({ value: u.id, label: u.label }))} onChange={(uid) => setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, unitId: uid } : x))} placeholder="Unit" />
                    </View>
                  </View>
                </View>
              )}
            </GlassCard>
          );
        })}

        <Pressable onPress={() => { const n = newMoveLine(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setLines((prev) => [...prev, n]); setExpandedLines((prev) => new Set([...prev, n.id])); }} style={mv.addLine}>
          <Text style={mv.addLineIcon}>＋</Text>
          <Text style={mv.addLineText}>Add product line</Text>
        </Pressable>

        <Pressable onPress={onSubmit} disabled={!canSubmit} style={({ pressed }) => [mv.primary, !canSubmit && mv.primaryDisabled, pressed && canSubmit && mv.primaryPressed]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={mv.primaryText}>Run transfer</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const mv = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  lockIcon: { fontSize: 48 },
  lockTitle: { color: palette.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  lockBody: { color: palette.textMuted, fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  routeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,179,0,0.08)', borderRadius: radii.md, borderWidth: 1, borderColor: 'rgba(255,179,0,0.22)', paddingVertical: 10, paddingHorizontal: 16, gap: 0 },
  routeFrom: { color: palette.text, fontSize: 13, fontWeight: '900', flex: 1, textAlign: 'center' },
  routeArrowWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  routeArrowLine: { height: 1, width: 18, backgroundColor: 'rgba(255,179,0,0.45)' },
  routeArrow: { color: palette.violet, fontSize: 18, fontWeight: '900', marginHorizontal: 2 },
  routeTo: { color: palette.emerald, fontSize: 13, fontWeight: '900', flex: 1, textAlign: 'center' },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: '900' },
  label: { marginTop: 14, color: palette.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { marginTop: 8, borderRadius: radii.md, borderWidth: 1, borderColor: palette.stroke, paddingHorizontal: 14, paddingVertical: Platform.select({ ios: 13, android: 11, default: 11 }), color: palette.text, backgroundColor: palette.inputInset, fontWeight: '600' },
  lineCard: {},
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  lineHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  lineHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineNumBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cardBgElevated, borderWidth: 1, borderColor: palette.cardBorder },
  lineNumBadgeActive: { backgroundColor: 'rgba(255,179,0,0.15)', borderColor: 'rgba(255,179,0,0.40)' },
  lineNum: { color: palette.textMuted, fontSize: 12, fontWeight: '900' },
  lineNumActive: { color: palette.violet },
  arrow: { color: palette.textMuted, fontSize: 12, fontWeight: '900' },
  remove: { color: palette.rose, fontWeight: '900', fontSize: 16, paddingHorizontal: 4 },
  lineContent: { marginTop: 8 },
  stockHintWrap: { paddingHorizontal: 2, paddingTop: 8, gap: 4 },
  stockHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stockHintDot: { color: palette.success, fontSize: 12, fontWeight: '900' },
  stockHintText: { color: palette.success, fontSize: 12, fontWeight: '700' },
  warehouseRow: { flexDirection: 'row', alignItems: 'flex-end' },
  warehouseSide: { flex: 1 },
  arrowPill: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 18, marginHorizontal: 8, width: 36 },
  arrowLine: { flex: 1, height: 2, backgroundColor: palette.violet, borderRadius: 1 },
  arrowHead: { width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 9, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: palette.violet },
  qtyUnitRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  addLine: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,179,0,0.35)', borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: 16 },
  addLineIcon: { color: palette.violet, fontSize: 18, fontWeight: '900', lineHeight: 20 },
  addLineText: { color: palette.violet, fontWeight: '900', fontSize: 14 },
  primary: { marginTop: 4, borderRadius: radii.lg, paddingVertical: 16, alignItems: 'center', backgroundColor: palette.violet, shadowColor: palette.violet, shadowOpacity: 0.40, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  primaryDisabled: { opacity: 0.45 },
  primaryPressed: { backgroundColor: '#e09f00' },
  primaryText: { color: palette.onAccent, fontWeight: '900', fontSize: 15 },
});
