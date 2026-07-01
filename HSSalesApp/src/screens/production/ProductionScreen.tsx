import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { makeMoney } from '../../utils/formatMoney';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { SelectMenu } from '../../components/ui/SelectMenu';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchProductions, upsertProduction, removeProduction } from '../../store/slices/productionSlice';
import { fetchSalesDataset } from '../../store/slices/salesDataSlice';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { showToast } from '../../store/slices/uiSlice';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';
import * as productionApi from '../../api/production';
import type { Production, ExtraCost, ProductionInputLot } from '../../types/models';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS = {
  draft:       { label: { en: 'Draft',       bn: 'খসড়া'           }, color: '#7B93A8',          icon: '📋' },
  in_progress: { label: { en: 'Processing',  bn: 'প্রক্রিয়া চলছে' }, color: '#FFD740',          icon: '⚙️' },
  completed:   { label: { en: 'Completed',   bn: 'সম্পন্ন'         }, color: palette.success,    icon: '✅' },
  cancelled:   { label: { en: 'Cancelled',   bn: 'বাতিল'           }, color: palette.rose,        icon: '❌' },
} as const;

type ProdStatus = keyof typeof STATUS;

const PROD_FLOW: ProdStatus[] = ['draft', 'in_progress', 'completed'];

function ProdStepTracker({ status, locale }: { status: ProdStatus; locale: string }) {
  if (status === 'cancelled') return null;
  const currentIdx = PROD_FLOW.indexOf(status);
  return (
    <View style={pst.root}>
      {PROD_FLOW.map((step, idx) => {
        const info = STATUS[step];
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <React.Fragment key={step}>
            <View style={pst.stepCol}>
              <View style={[
                pst.dot,
                { borderColor: active ? info.color : done ? `${info.color}70` : 'rgba(255,255,255,0.15)', backgroundColor: done ? `${info.color}28` : active ? `${info.color}20` : 'transparent' },
                active && { shadowColor: info.color, shadowOpacity: 0.65, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
              ]}>
                <Text style={[pst.dotIcon, !done && !active && { opacity: 0.25 }]}>{done ? '✓' : info.icon}</Text>
              </View>
              <Text style={[pst.label, { color: active ? info.color : done ? `${info.color}90` : 'rgba(255,255,255,0.22)' }, active && { fontWeight: '900' }]}>
                {locale === 'bn' ? info.label.bn : info.label.en}
              </Text>
            </View>
            {idx < PROD_FLOW.length - 1 && (
              <View style={[pst.line, { backgroundColor: idx < currentIdx ? `${info.color}50` : 'rgba(255,255,255,0.08)' }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const pst = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 12, paddingHorizontal: 4 },
  stepCol: { alignItems: 'center', gap: 5, minWidth: 70 },
  dot: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dotIcon: { fontSize: 16 },
  label: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: 0.4, textAlign: 'center' as const, maxWidth: 70 },
  line: { flex: 1, height: 1.5, marginTop: 18, borderRadius: 2 },
});

// ── Bottle price sizes config ────────────────────────────────────────────────

const BOTTLE_PRICE_SIZES = [
  { key: '5',   labelEn: '5L Bottle Cost (optional)',   labelBn: '৫ লি বোতল খরচ (ঐচ্ছিক)' },
  { key: '2',   labelEn: '2L Bottle Cost (optional)',   labelBn: '২ লি বোতল খরচ (ঐচ্ছিক)' },
  { key: '1',   labelEn: '1L Bottle Cost (optional)',   labelBn: '১ লি বোতল খরচ (ঐচ্ছিক)' },
  { key: '0.5', labelEn: '0.5L Bottle Cost (optional)', labelBn: '০.৫ লি বোতল খরচ (ঐচ্ছিক)' },
];

// ── Production card ──────────────────────────────────────────────────────────

function ProductionCard({
  prod, locale, money, costMoney, lots, lotBatches, products,
  onAdvance, onComplete, onCancel, onDelete,
}: {
  prod: Production; locale: string; money: { format: (n: number) => string }; costMoney: { format: (n: number) => string };
  lots: { id: string; productId: string; lotNumber: string }[];
  lotBatches: { id: string; lotId: string; unitCost: number; remainingQuantity: number }[];
  products: { id: string; name: string }[];
  onAdvance: () => void; onComplete: () => void; onCancel: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const bn = locale === 'bn';
  const st = STATUS[prod.status as ProdStatus] ?? STATUS.draft;

  const outputProd = products.find(p => p.id === prod.outputProductId);

  const extraCosts: ExtraCost[] = useMemo(() => {
    try { return prod.extraCosts ? JSON.parse(prod.extraCosts) : []; } catch { return []; }
  }, [prod.extraCosts]);

  // Parse multi-lot input — fall back to single-lot for old records
  const inputLotsParsed: ProductionInputLot[] = useMemo(() => {
    if (prod.inputLots) { try { return JSON.parse(prod.inputLots); } catch {} }
    if (prod.inputLotBatchId) return [{ lotBatchId: prod.inputLotBatchId, quantity: prod.inputQuantity ?? 0 }];
    return [];
  }, [prod.inputLots, prod.inputLotBatchId, prod.inputQuantity]);

  // Per-lot cost breakdown for the expanded card
  const inputLotDetails = useMemo(() => inputLotsParsed.map(entry => {
    const batch = lotBatches.find(b => b.id === entry.lotBatchId);
    const lot = batch ? lots.find(l => l.id === batch.lotId) : undefined;
    const prodName = lot ? products.find(p => p.id === lot.productId)?.name : undefined;
    const unitCost = Number(batch?.unitCost ?? 0);
    return { ...entry, unitCost, cost: entry.quantity * unitCost, lotNumber: lot?.lotNumber, productName: prodName };
  }), [inputLotsParsed, lotBatches, lots, products]);

  const inputCost = inputLotDetails.reduce((s, e) => s + e.cost, 0);
  const totalInputQty = prod.inputQuantity ?? inputLotsParsed.reduce((s, e) => s + e.quantity, 0);
  const processingCost = totalInputQty * (prod.processingCostPerUnit ?? 0);
  const extraTotal = extraCosts.reduce((a, e) => a + e.amount, 0);
  const totalCost = inputCost + processingCost + extraTotal;

  // First lot details for the card headline
  const firstLotDetail = inputLotDetails[0];
  const inputProd = firstLotDetail?.productName ? { name: firstLotDetail.productName } : undefined;
  const inputLabel = inputLotDetails.length > 1
    ? `${firstLotDetail?.productName ?? '?'} (${inputLotDetails.length} lots)`
    : firstLotDetail?.productName ?? '?';
  const inputBatch = lotBatches.find(b => b.id === (prod.inputLotBatchId ?? inputLotsParsed[0]?.lotBatchId));
  const refQty = prod.actualOutputQty ?? prod.expectedOutputQty ?? 1;
  const effectiveCost = refQty > 0 ? totalCost / refQty : 0;

  const bottlePrices: Record<string, number> | null = useMemo(() => {
    try { const r = (prod as any).bottlePrices; return r ? JSON.parse(r) : null; } catch { return null; }
  }, [(prod as any).bottlePrices]);

  const nextAction = prod.status === 'draft' ? { icon: '⚙️', label: bn ? 'উৎপাদন শুরু করুন' : 'Start Production', color: '#FFD740', onPress: onAdvance }
    : prod.status === 'in_progress' ? { icon: '✅', label: bn ? 'উৎপাদন সম্পন্ন করুন' : 'Complete Production', color: palette.success, onPress: onComplete }
    : null;

  return (
    <Pressable
      onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity')); setExpanded(v => !v); }}
      style={({ pressed }) => [pc.card, { borderColor: `${st.color}28`, shadowColor: st.color }, prod.status === 'cancelled' && pc.cancelled, pressed && { opacity: 0.9 }]}>

      {/* Top accent bar */}
      <View style={[pc.topBar, { backgroundColor: `${st.color}18`, borderBottomColor: `${st.color}28` }]}>
        <View style={pc.topBarLeft}>
          <View style={[pc.statusDot, { backgroundColor: st.color, shadowColor: st.color }]} />
          <Text style={[pc.prodNum, { color: st.color }]}>{prod.productionNumber}</Text>
        </View>
        <View style={[pc.statusChip, { backgroundColor: `${st.color}16`, borderColor: `${st.color}38` }]}>
          <Text style={pc.stChipIcon}>{st.icon}</Text>
          <Text style={[pc.stChipText, { color: st.color }]}>{bn ? st.label.bn : st.label.en}</Text>
        </View>
      </View>

      <View style={pc.body}>
        {/* Flow headline */}
        <View style={pc.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={pc.flow}>{inputLabel} → {outputProd?.name ?? '?'}</Text>
            <Text style={pc.sub}>
              {totalInputQty.toLocaleString()} {bn ? 'ইনপুট' : 'input'}
              {prod.expectedOutputQty ? `  ·  ~${prod.expectedOutputQty}L ${bn ? 'আউটপুট' : 'output'}` : ''}
            </Text>
            <Text style={pc.dateText}>📅 {prod.orderDate}{prod.startDate ? ` · ⚙️ ${prod.startDate}` : ''}{prod.completedDate ? ` · ✅ ${prod.completedDate}` : ''}</Text>
          </View>
          <View style={pc.costBox}>
            <Text style={pc.costVal}>{costMoney.format(effectiveCost)}</Text>
            <Text style={pc.costSub}>{bn ? 'প্রতি একক' : '/unit'}</Text>
          </View>
        </View>

        {/* Step tracker */}
        <ProdStepTracker status={prod.status as ProdStatus} locale={locale} />

        {prod.status === 'cancelled' && prod.cancelReason && (
          <Text style={pc.cancelNote}>❌ {prod.cancelReason}</Text>
        )}

        <View style={pc.expandRow}>
          <Text style={pc.expandHint}>{expanded ? (bn ? 'কম দেখুন ▴' : 'Less ▴') : (bn ? 'বিস্তারিত ▾' : 'Details ▾')}</Text>
        </View>

        {expanded && (
          <View style={pc.expanded}>
            <View style={pc.divider} />

            {/* Cost breakdown */}
            <View style={pc.costSection}>
              <View style={pc.costSectionHeader}>
                <Text style={pc.sectionTitle}>{bn ? '💰 খরচ বিশ্লেষণ' : '💰 Cost Breakdown'}</Text>
              </View>
              {inputLotDetails.map((e, i) => (
                <CostRow
                  key={i}
                  label={bn
                    ? `কাঁচামাল ${inputLotDetails.length > 1 ? `(লট ${i + 1}: ${e.quantity} × ৳${e.unitCost.toFixed(2)})` : `(${e.quantity} × ${costMoney.format(e.unitCost)})`}`
                    : `Input ${inputLotDetails.length > 1 ? `(Lot ${i + 1}: ${e.quantity} × ৳${e.unitCost.toFixed(2)})` : `(${e.quantity} × ${costMoney.format(e.unitCost)})`}`}
                  value={money.format(e.cost)}
                />
              ))}
              {processingCost > 0 && <CostRow label={bn ? `প্রক্রিয়া (×${prod.processingCostPerUnit}/unit)` : `Processing (×${prod.processingCostPerUnit}/unit)`} value={money.format(processingCost)} />}
              {extraCosts.map((e, i) => <CostRow key={i} label={e.label} value={`+ ${money.format(e.amount)}`} />)}
              <CostRow label={bn ? 'মোট খরচ' : 'Total Cost'} value={money.format(totalCost)} bold />
              {prod.actualOutputQty != null && <CostRow label={bn ? `কার্যকর (${prod.actualOutputQty}L)` : `Effective (${prod.actualOutputQty}L)`} value={costMoney.format(refQty > 0 ? totalCost / refQty : 0)} bold accent />}
              {prod.expectedOutputQty != null && prod.actualOutputQty == null && <CostRow label={bn ? `আনুমানিক (~${prod.expectedOutputQty}L)` : `Estimated (~${prod.expectedOutputQty}L)`} value={costMoney.format(refQty > 0 ? totalCost / refQty : 0)} />}
            </View>

            {bottlePrices && Object.keys(bottlePrices).length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={pc.sectionTitle}>{bn ? '🍶 বোতল মূল্য' : '🍶 Bottle Prices'}</Text>
                <View style={pc.bottleRow}>
                  {Object.entries(bottlePrices).map(([size, price]) => (
                    <Text key={size} style={pc.bottleChip}>{size}L: ৳{Number(price).toFixed(2)}</Text>
                  ))}
                </View>
              </View>
            )}

            {prod.notes && (
              <View style={pc.notesBox}>
                <Text style={pc.notesLabel}>{bn ? 'নোট' : 'Note'}</Text>
                <Text style={pc.notesText}>{prod.notes}</Text>
              </View>
            )}

            {/* Secondary actions row */}
            {(prod.status === 'draft' || prod.status === 'in_progress' || prod.status === 'cancelled') && (
              <View style={pc.actionsRow}>
                {(prod.status === 'draft' || prod.status === 'in_progress') && (
                  <Pressable onPress={onCancel} style={({ pressed }) => [pc.cancelBtn, pressed && { opacity: 0.8 }]}>
                    <Text style={pc.cancelBtnText}>{bn ? 'বাতিল' : 'Cancel'}</Text>
                  </Pressable>
                )}
                {prod.status === 'cancelled' && (
                  <Pressable onPress={onDelete} style={({ pressed }) => [pc.deleteBtn, pressed && { opacity: 0.8 }]}>
                    <Text style={pc.deleteBtnText}>🗑 {bn ? 'স্থায়ীভাবে মুছুন' : 'Delete permanently'}</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Primary advance button */}
            {nextAction && (
              <Pressable onPress={nextAction.onPress} style={({ pressed }) => [pc.advBtn, { backgroundColor: nextAction.color, shadowColor: nextAction.color }, pressed && { opacity: 0.85 }]}>
                <Text style={pc.advBtnIcon}>{nextAction.icon}</Text>
                <Text style={pc.advBtnText}>{nextAction.label}</Text>
                <Text style={pc.advBtnArrow}>›</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

function CostRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 7, borderTopWidth: 1, borderTopColor: `${palette.cardBorder}60` }}>
      <Text style={{ color: palette.textMuted, fontSize: 12, fontWeight: bold ? '900' : '700', flex: 1, paddingRight: 8 }}>{label}</Text>
      <Text style={{ color: accent ? palette.emerald : palette.text, fontSize: 13, fontWeight: bold ? '900' : '800' }}>{value}</Text>
    </View>
  );
}

const pc = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, backgroundColor: palette.cardBg, overflow: 'hidden', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  cancelled: { opacity: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1 },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4, shadowOpacity: 0.8, shadowRadius: 5, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  prodNum: { fontSize: 12, fontWeight: '900', letterSpacing: 0.2 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  stChipIcon: { fontSize: 12 },
  stChipText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  body: { padding: 14 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flow: { color: palette.text, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  sub: { color: palette.textMuted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  dateText: { color: palette.textMuted, fontSize: 11, fontWeight: '600', marginTop: 4 },
  costBox: { alignItems: 'flex-end', flexShrink: 0 },
  costVal: { color: palette.emerald, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  costSub: { color: palette.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  cancelNote: { color: palette.rose, fontSize: 11, fontWeight: '600', fontStyle: 'italic', marginBottom: 4 },
  expandRow: { alignItems: 'center', paddingTop: 2 },
  expandHint: { color: `${palette.emerald}80`, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  expanded: { marginTop: 4 },
  divider: { height: 1, backgroundColor: palette.cardBorder, marginBottom: 12 },
  costSection: { borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorder, overflow: 'hidden' },
  costSectionHeader: { backgroundColor: palette.cardBgElevated, paddingHorizontal: 12, paddingVertical: 7 },
  sectionTitle: { color: palette.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  bottleRow: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8, marginTop: 8 },
  bottleChip: { color: palette.violet, fontSize: 12, fontWeight: '900', backgroundColor: `${palette.violet}15`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: `${palette.violet}30` },
  notesBox: { marginTop: 10, padding: 10, backgroundColor: palette.cardBgElevated, borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorder },
  notesLabel: { color: palette.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' as const, marginBottom: 3 },
  notesText: { color: palette.textLabel, fontSize: 12, fontWeight: '600', fontStyle: 'italic' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.md, backgroundColor: 'rgba(255,59,92,0.10)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.30)' },
  cancelBtnText: { color: palette.rose, fontSize: 12, fontWeight: '800' },
  deleteBtn: { flex: 1, paddingVertical: 11, borderRadius: radii.md, backgroundColor: 'rgba(255,59,92,0.10)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.35)', alignItems: 'center' },
  deleteBtnText: { color: palette.rose, fontSize: 13, fontWeight: '900' },
  advBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 14, borderRadius: radii.lg, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 7 },
  advBtnIcon: { fontSize: 16 },
  advBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
  advBtnArrow: { color: 'rgba(255,255,255,0.7)', fontSize: 20, fontWeight: '900' },
});

// ── New Production Form ────────────────────────────────────────────────────────

function NewProductionForm({ lots, lotBatches, products, locale, onClose, onCreated }: {
  lots: { id: string; productId: string; lotNumber: string }[];
  lotBatches: { id: string; lotId: string; warehouseId: string; unitCost: number; remainingQuantity: number; acquiredAt: string }[];
  products: { id: string; name: string }[];
  locale: string;
  onClose: () => void;
  onCreated: (p: Production) => void;
}) {
  const token = useAppSelector(s => s.auth.token);
  const bn = locale === 'bn';

  type LotRow = { lotBatchId: string; quantity: string };
  const [lotRows, setLotRows] = useState<LotRow[]>([{ lotBatchId: '', quantity: '' }]);
  const [processingCost, setProcessingCost] = useState('');
  const [extraCosts, setExtraCosts] = useState<{ label: string; amount: string }[]>([]);
  const [outputProductId, setOutputProductId] = useState('');
  const [expectedQty, setExpectedQty] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const addLotRow = () => setLotRows(prev => [...prev, { lotBatchId: '', quantity: '' }]);
  const removeLotRow = (i: number) => setLotRows(prev => prev.filter((_, j) => j !== i));
  const updateLotRow = (i: number, field: keyof LotRow, value: string) =>
    setLotRows(prev => prev.map((r, j) => j === i ? { ...r, [field]: value } : r));

  const allBatchOptions = useMemo(() => {
    return lotBatches
      .filter(b => Number(b.remainingQuantity) > 0)
      .map(b => {
        const lot = lots.find(l => l.id === b.lotId);
        const prod = lot ? products.find(p => p.id === lot.productId) : undefined;
        return { value: b.id, label: `${prod?.name ?? '?'} · ${lot?.lotNumber ?? '?'} (${Number(b.remainingQuantity).toLocaleString()})` };
      });
  }, [lotBatches, lots, products]);

  const productOptions = products.map(p => ({ value: p.id, label: p.name }));

  const pCost = Number(processingCost) || 0;
  const eCostTotal = extraCosts.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const totalInputQty = lotRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const inputCostEstimate = lotRows.reduce((s, r) => {
    const batch = lotBatches.find(b => b.id === r.lotBatchId);
    return s + (Number(r.quantity) || 0) * Number(batch?.unitCost ?? 0);
  }, 0);
  const totalCost = inputCostEstimate + totalInputQty * pCost + eCostTotal;
  const expQty = Number(expectedQty) || 0;
  const estUnit = expQty > 0 ? totalCost / expQty : 0;

  async function submit() {
    const validLots = lotRows.filter(r => r.lotBatchId && Number(r.quantity) > 0);
    if (!token || validLots.length === 0 || !outputProductId) {
      Alert.alert(bn ? 'ত্রুটি' : 'Error', bn ? 'সব তথ্য দিন' : 'Fill all required fields');
      return;
    }
    for (const row of validLots) {
      const batch = lotBatches.find(b => b.id === row.lotBatchId);
      const avail = batch ? Number(batch.remainingQuantity) : 0;
      if (Number(row.quantity) > avail) {
        Alert.alert(bn ? 'ত্রুটি' : 'Error', bn ? `মজুদ কম। পাওয়া যাচ্ছে: ${avail}` : `Insufficient stock. Available: ${avail}`);
        return;
      }
    }
    setBusy(true);
    try {
      const result = await productionApi.createProduction({
        inputLots: validLots.map(r => ({ lotBatchId: r.lotBatchId, quantity: Number(r.quantity) })),
        processingCostPerUnit: pCost || undefined,
        extraCosts: extraCosts.filter(e => e.label && Number(e.amount) > 0).map(e => ({ label: e.label, amount: Number(e.amount) })),
        outputProductId,
        expectedOutputQty: expQty || undefined,
        notes: notes.trim() || undefined,
        orderDate: new Date().toISOString().slice(0, 10),
      }, token);
      onCreated(result);
    } catch (e: any) { Alert.alert(bn ? 'ত্রুটি' : 'Error', e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  }

  const lbl = (t: string) => <Text style={nf.label}>{t}</Text>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={nf.sheet} contentContainerStyle={nf.inner} keyboardShouldPersistTaps="handled">
        <View style={nf.header}>
          <Text style={nf.title}>{bn ? 'নতুন উৎপাদন' : 'New Production'}</Text>
          <Pressable onPress={onClose}><Text style={nf.close}>✕</Text></Pressable>
        </View>

        {lbl(bn ? 'কাঁচামালের লট *' : 'Input Lots *')}
        <View style={nf.lotSection}>
          {lotRows.map((row, i) => {
            const batch = lotBatches.find(b => b.id === row.lotBatchId);
            const avail = batch ? Number(batch.remainingQuantity) : 0;
            const rowQty = Number(row.quantity) || 0;
            const overQty = row.lotBatchId !== '' && rowQty > avail && avail > 0;
            const selectedElsewhere = new Set(lotRows.filter((_, j) => j !== i).map(r => r.lotBatchId));
            const rowOptions = allBatchOptions.filter(opt => !selectedElsewhere.has(opt.value));
            return (
              <View key={i} style={nf.lotRow}>
                <View style={nf.lotRowHeader}>
                  <Text style={nf.lotRowLabel}>{bn ? `লট ${i + 1}` : `Lot ${i + 1}`}</Text>
                  {lotRows.length > 1 && (
                    <Pressable onPress={() => removeLotRow(i)} hitSlop={8}>
                      <Text style={nf.lotRowRemove}>✕</Text>
                    </Pressable>
                  )}
                </View>
                <SelectMenu
                  label={bn ? 'লট বেছে নিন' : 'Select lot'}
                  value={row.lotBatchId}
                  options={rowOptions}
                  onChange={v => updateLotRow(i, 'lotBatchId', v)}
                />
                <TextInput
                  value={row.quantity}
                  onChangeText={v => updateLotRow(i, 'quantity', v)}
                  keyboardType="numeric"
                  placeholder={row.lotBatchId ? `0  (${bn ? 'পাওয়া' : 'avail'}: ${avail.toLocaleString()})` : '0'}
                  placeholderTextColor={palette.textMuted}
                  style={[nf.input, { marginTop: 6 }, overQty && nf.inputError]}
                />
                {overQty && (
                  <Text style={nf.errorText}>{bn ? `মজুদ কম। পাওয়া যাচ্ছে: ${avail}` : `Exceeds available: ${avail}`}</Text>
                )}
              </View>
            );
          })}
          <Pressable onPress={addLotRow} style={nf.addLotBtn}>
            <Text style={nf.addLotText}>+ {bn ? 'আরেকটি লট যোগ করুন' : 'Add Another Lot'}</Text>
          </Pressable>
        </View>

        {lbl(bn ? 'মাড়াই/প্রক্রিয়া খরচ/একক (৳)' : 'Processing cost/unit (৳)')}
        <TextInput value={processingCost} onChangeText={setProcessingCost} keyboardType="numeric" placeholder="0" placeholderTextColor={palette.textMuted} style={nf.input} />

        <View style={nf.extraSection}>
          <Text style={[nf.label, { marginTop: 0 }]}>{bn ? 'অতিরিক্ত খরচ' : 'Extra Costs'}</Text>
          {extraCosts.map((e, i) => (
            <View key={i} style={nf.extraRow}>
              <TextInput value={e.label} onChangeText={v => setExtraCosts(prev => prev.map((x, j) => j === i ? { ...x, label: v } : x))} placeholder={bn ? 'বিবরণ' : 'Label'} placeholderTextColor={palette.textMuted} style={[nf.input, { flex: 1.5, marginTop: 0 }]} />
              <TextInput value={e.amount} onChangeText={v => setExtraCosts(prev => prev.map((x, j) => j === i ? { ...x, amount: v } : x))} keyboardType="numeric" placeholder="0" placeholderTextColor={palette.textMuted} style={[nf.input, { flex: 1, marginTop: 0 }]} />
              <Pressable onPress={() => setExtraCosts(prev => prev.filter((_, j) => j !== i))}><Text style={{ color: palette.rose, fontSize: 16, padding: 8 }}>✕</Text></Pressable>
            </View>
          ))}
          <Pressable onPress={() => setExtraCosts(prev => [...prev, { label: '', amount: '' }])} style={nf.addExtra}><Text style={nf.addExtraText}>+ {bn ? 'যোগ করুন' : 'Add'}</Text></Pressable>
        </View>

        {lbl(bn ? 'আউটপুট পণ্য (তেল/নির্যাস) *' : 'Output Product (oil/extract) *')}
        <SelectMenu label={bn ? 'পণ্য বেছে নিন' : 'Select product'} value={outputProductId} options={productOptions} onChange={setOutputProductId} />

        {lbl(bn ? 'আনুমানিক আউটপুট পরিমাণ (LITER/KG)' : 'Expected output quantity (LITER/KG)')}
        <TextInput value={expectedQty} onChangeText={setExpectedQty} keyboardType="numeric" placeholder="0" placeholderTextColor={palette.textMuted} style={nf.input} />

        {/* Live estimate */}
        {totalInputQty > 0 && outputProductId && (
          <View style={nf.estimate}>
            <Text style={nf.estimateTitle}>{bn ? 'আনুমানিক হিসাব' : 'Cost Estimate'}</Text>
            <Text style={nf.estimateLine}>{bn ? `কাঁচামাল: ৳${inputCostEstimate.toLocaleString()} (${totalInputQty} ${lotRows.filter(r => r.lotBatchId && Number(r.quantity) > 0).length > 1 ? `${lotRows.filter(r => r.lotBatchId && Number(r.quantity) > 0).length} লট` : 'লট'})` : `Input: ৳${inputCostEstimate.toLocaleString()} (${totalInputQty} from ${lotRows.filter(r => r.lotBatchId && Number(r.quantity) > 0).length} lot${lotRows.filter(r => r.lotBatchId && Number(r.quantity) > 0).length > 1 ? 's' : ''})`}</Text>
            {pCost > 0 && <Text style={nf.estimateLine}>{bn ? `মাড়াই: ${totalInputQty} × ৳${pCost} = ৳${(totalInputQty * pCost).toLocaleString()}` : `Processing: ${totalInputQty} × ৳${pCost} = ৳${(totalInputQty * pCost).toLocaleString()}`}</Text>}
            {eCostTotal > 0 && <Text style={nf.estimateLine}>{bn ? `অতিরিক্ত: ৳${eCostTotal.toLocaleString()}` : `Extra: ৳${eCostTotal.toLocaleString()}`}</Text>}
            <Text style={nf.estimateTotal}>{bn ? `মোট খরচ: ৳${totalCost.toLocaleString()}` : `Total: ৳${totalCost.toLocaleString()}`}</Text>
            {estUnit > 0 && <Text style={nf.estimateUnit}>{bn ? `প্রতি আউটপুট একক: ৳${estUnit.toFixed(3)}` : `Per output unit: ৳${estUnit.toFixed(3)}`}</Text>}
          </View>
        )}

        {lbl(bn ? 'নোট' : 'Notes')}
        <TextInput value={notes} onChangeText={setNotes} placeholder="..." placeholderTextColor={palette.textMuted} style={nf.input} />

        <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [nf.submitBtn, pressed && { opacity: 0.85 }, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={nf.submitText}>{bn ? 'উৎপাদন তৈরি করুন' : 'Create Production'}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const nf = StyleSheet.create({
  sheet: { backgroundColor: palette.cardBgPrimary, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, maxHeight: '92%' },
  inner: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: palette.text, fontSize: 20, fontWeight: '900' },
  close: { color: palette.textMuted, fontSize: 18, fontWeight: '800', padding: 8 },
  label: { color: palette.textLabel, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: palette.stroke, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 11, color: palette.text, backgroundColor: palette.inputInset, fontWeight: '600', fontSize: 14, marginTop: 4 },
  extraSection: { backgroundColor: palette.cardBgElevated, borderRadius: radii.md, padding: 12, marginTop: 14, gap: 8 },
  extraRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addExtra: { borderWidth: 1, borderColor: palette.emerald, borderRadius: radii.md, borderStyle: 'dashed', paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  addExtraText: { color: palette.emerald, fontSize: 12, fontWeight: '900' },
  estimate: { backgroundColor: 'rgba(0,168,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,168,255,0.20)', borderRadius: radii.md, padding: 14, marginTop: 14, gap: 4 },
  estimateTitle: { color: palette.text, fontSize: 12, fontWeight: '900', marginBottom: 6 },
  estimateLine: { color: palette.textMuted, fontSize: 12, fontWeight: '600' },
  estimateTotal: { color: palette.text, fontSize: 14, fontWeight: '900', marginTop: 6 },
  estimateUnit: { color: palette.emerald, fontSize: 14, fontWeight: '900' },
  submitBtn: { backgroundColor: palette.emerald, borderRadius: radii.lg, paddingVertical: 16, alignItems: 'center', marginTop: 20, shadowColor: palette.emerald, shadowOpacity: 0.50, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 9 },
  submitText: { color: palette.onAccent, fontSize: 16, fontWeight: '900' },
  lotSection: { gap: 10, marginTop: 4 },
  lotRow: { backgroundColor: palette.cardBgElevated, borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorder, padding: 12, gap: 2 },
  lotRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  lotRowLabel: { color: palette.textLabel, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  lotRowRemove: { color: palette.rose, fontSize: 15, fontWeight: '900', padding: 4 },
  inputError: { borderColor: palette.rose },
  errorText: { color: palette.rose, fontSize: 11, fontWeight: '700', marginTop: 2 },
  addLotBtn: { borderWidth: 1, borderColor: palette.emerald, borderRadius: radii.md, borderStyle: 'dashed' as const, paddingVertical: 10, alignItems: 'center' as const },
  addLotText: { color: palette.emerald, fontSize: 13, fontWeight: '900' },
});

// ── Complete production dialog ────────────────────────────────────────────────

function CompleteDialog({ prod, locale, onDone, onClose }: {
  prod: Production;
  locale: string;
  onDone: (qty: number, bottlePricesJson: string) => void;
  onClose: () => void;
}) {
  const [actualQty, setActualQty] = useState(prod.expectedOutputQty ? String(prod.expectedOutputQty) : '');
  const [bottlePriceInputs, setBottlePriceInputs] = useState<Record<string, string>>({
    '5': '', '2': '', '1': '', '0.5': '',
  });
  const bn = locale === 'bn';

  const setBottlePrice = (key: string, value: string) =>
    setBottlePriceInputs(prev => ({ ...prev, [key]: value }));

  return (
    <View style={cd.wrap}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}>
        <ScrollView
          contentContainerStyle={cd.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
        <View style={cd.card}>
          <Text style={cd.title}>{bn ? '✅ উৎপাদন সম্পন্ন' : '✅ Complete Production'}</Text>

          {/* Actual output qty */}
          <Text style={cd.sub}>{bn ? 'প্রকৃত আউটপুট পরিমাণ' : 'Actual output quantity'}</Text>
          <TextInput value={actualQty} onChangeText={setActualQty} keyboardType="numeric" placeholder="0" placeholderTextColor={palette.textMuted} style={cd.input} autoFocus />

          {/* Bottle price inputs */}
          <View style={cd.bottleSection}>
            <Text style={cd.bottleSectionTitle}>{bn ? '🍶 বোতল মূল্য' : '🍶 Bottle Prices'}</Text>
            <Text style={cd.bottleSectionHint}>
              {bn ? 'প্রতিটি সাইজের বোতলের খরচ দিন (ঐচ্ছিক)' : 'Enter cost per bottle size (optional)'}
            </Text>
            {BOTTLE_PRICE_SIZES.map(s => (
              <View key={s.key} style={cd.bottlePriceField}>
                <Text style={cd.bottlePriceLabel}>{bn ? s.labelBn : s.labelEn}</Text>
                <TextInput
                  value={bottlePriceInputs[s.key] ?? ''}
                  onChangeText={v => setBottlePrice(s.key, v)}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={palette.textMuted}
                  style={cd.bottlePriceInput}
                />
              </View>
            ))}
          </View>

          <View style={cd.actions}>
            <Pressable onPress={onClose} style={cd.cancelBtn}><Text style={cd.cancelText}>{bn ? 'বাতিল' : 'Cancel'}</Text></Pressable>
            <Pressable
              onPress={() => {
                const q = Number(actualQty);
                if (q <= 0) return;
                const prices: Record<string, number> = {};
                for (const s of BOTTLE_PRICE_SIZES) {
                  const v = Number(bottlePriceInputs[s.key]);
                  if (v > 0) prices[s.key] = v;
                }
                onDone(q, JSON.stringify(prices));
              }}
              style={cd.confirmBtn}>
              <Text style={cd.confirmText}>{bn ? 'সম্পন্ন করুন' : 'Confirm'}</Text>
            </Pressable>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const cd = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.60)', paddingHorizontal: 16, zIndex: 99999 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 32 },
  card: { backgroundColor: palette.cardBgPrimary, borderRadius: radii.lg, padding: 18, gap: 12 },
  title: { color: palette.text, fontSize: 18, fontWeight: '900' },
  sub: { color: palette.textMuted, fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1.5, borderColor: palette.emerald, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, color: palette.text, backgroundColor: palette.inputInset, fontSize: 22, fontWeight: '900', textAlign: 'center' as const },
  bottleSection: { backgroundColor: palette.cardBgElevated, borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorderAccent, padding: 12, gap: 10 },
  bottleSectionTitle: { color: palette.text, fontSize: 14, fontWeight: '900' },
  bottleSectionHint: { color: palette.textMuted, fontSize: 11, fontWeight: '600', marginTop: -4 },
  bottlePriceField: { gap: 4 },
  bottlePriceLabel: { color: palette.textLabel, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  bottlePriceInput: { borderWidth: 1, borderColor: palette.stroke, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, color: palette.text, backgroundColor: palette.inputInset, fontSize: 15, fontWeight: '800' },
  actions: { flexDirection: 'row' as const, gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorder, alignItems: 'center' as const },
  cancelText: { color: palette.textMuted, fontWeight: '800' },
  confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: radii.md, backgroundColor: palette.emerald, alignItems: 'center' as const, shadowColor: palette.emerald, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  confirmText: { color: palette.onAccent, fontWeight: '900', fontSize: 15 },
});

// ── Main Screen ────────────────────────────────────────────────────────────────

export function ProductionScreen() {
  const dispatch = useAppDispatch();
  const locale = useAppSelector(s => s.ui.locale);
  const token = useAppSelector(s => s.auth.token);
  const role = useAppSelector(s => s.auth.user?.role);
  const { productions, status } = useAppSelector(s => s.production);
  const { products, lots, lotBatches } = useAppSelector(s => s.salesData);
  const tabPad = useTabScreenBottomPadding();
  const bn = locale === 'bn';

  const [showForm, setShowForm] = useState(false);
  const [completingProd, setCompletingProd] = useState<Production | null>(null);
  const [filterStatus, setFilterStatus] = useState<'active' | 'done' | 'cancelled'>('active');

  const money = useMemo(() => makeMoney(locale), [locale]);
  const costMoney = useMemo(() => makeMoney(locale, 2, 2), [locale]);

  useFocusEffect(useCallback(() => { dispatch(fetchProductions()); }, [dispatch]));

  const filtered = useMemo(() => productions.filter(p =>
    filterStatus === 'active' ? !['completed', 'cancelled'].includes(p.status) :
    filterStatus === 'done' ? p.status === 'completed' :
    p.status === 'cancelled'
  ), [productions, filterStatus]);

  // Group by the relevant date: orderDate for active, completedDate/cancelDate for done/cancelled
  type DateGroup = { dateKey: string; label: string; items: Production[] };
  const dateGroups = useMemo((): DateGroup[] => {
    const map = new Map<string, Production[]>();
    for (const p of filtered) {
      const raw = (filterStatus === 'done' ? p.completedDate : filterStatus === 'cancelled' ? p.cancelDate : null) ?? p.orderDate ?? '';
      const key = raw.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => {
        let label = key;
        try {
          label = new Date(key).toLocaleDateString(
            locale === 'bn' ? 'bn-BD' : 'en-GB',
            { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
          );
        } catch {}
        return { dateKey: key, label, items };
      });
  }, [filtered, filterStatus, locale]);

  async function advance(prod: Production, status: string) {
    if (!token) return;
    try {
      const updated = await productionApi.updateProductionStatus(prod.id, status, undefined, undefined, token);
      dispatch(upsertProduction(updated));
      dispatch(showToast({ title: bn ? 'স্ট্যাটাস পরিবর্তন' : 'Status Updated', message: status, type: 'success' }));
    } catch (e: any) { Alert.alert(bn ? 'ত্রুটি' : 'Error', e?.message); }
  }

  async function complete(prod: Production, actualOutputQty: number, bottlePricesJson: string) {
    if (!token) return;
    try {
      const updated = await productionApi.updateProductionStatus(prod.id, 'completed', actualOutputQty, bottlePricesJson, token);
      dispatch(upsertProduction(updated));
      setCompletingProd(null);

      // Refresh inventory + lots so the new output product appears on all dashboards
      dispatch(fetchSalesDataset());
      dispatch(fetchInventoryStock());

      dispatch(showToast({
        title: bn ? 'উৎপাদন সম্পন্ন ✅' : 'Production Complete ✅',
        message: `${actualOutputQty} ${bn ? 'একক তৈরি হয়েছে' : 'units produced'}`,
        type: 'success',
      }));
    } catch (e: any) { Alert.alert(bn ? 'ত্রুটি' : 'Error', e?.message); }
  }

  async function cancel(prod: Production) {
    Alert.alert(bn ? 'বাতিল করবেন?' : 'Cancel?', prod.productionNumber, [
      { text: bn ? 'না' : 'No', style: 'cancel' },
      { text: bn ? 'হ্যাঁ' : 'Yes', style: 'destructive', onPress: () => advance(prod, 'cancelled') },
    ]);
  }

  async function deleteProd(prod: Production) {
    Alert.alert(
      bn ? 'স্থায়ীভাবে মুছবেন?' : 'Delete permanently?',
      bn ? `${prod.productionNumber} — এটি পূর্বাবস্থায় ফেরানো যাবে না।` : `${prod.productionNumber} — this cannot be undone.`,
      [
        { text: bn ? 'না' : 'No', style: 'cancel' },
        {
          text: bn ? 'মুছুন' : 'Delete', style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await productionApi.deleteProduction(prod.id, token);
              dispatch(removeProduction(prod.id));
              dispatch(showToast({ title: bn ? 'মুছে ফেলা হয়েছে' : 'Deleted', message: prod.productionNumber, type: 'success' }));
            } catch (e: any) { Alert.alert(bn ? 'ত্রুটি' : 'Error', e?.message); }
          },
        },
      ],
    );
  }

  if (role !== 'admin') {
    return (
      <MeshBackground>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.center}><Text style={styles.muted}>{bn ? 'শুধু অ্যাডমিন ব্যবহার করতে পারবেন' : 'Admin only'}</Text></View>
        </SafeAreaView>
      </MeshBackground>
    );
  }

  return (
    <MeshBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{bn ? 'উৎপাদন' : 'Production'}</Text>
          <Pressable onPress={() => setShowForm(true)} style={styles.newBtn}>
            <Text style={styles.newBtnText}>+ {bn ? 'নতুন' : 'New'}</Text>
          </Pressable>
        </View>

        <View style={styles.filterBar}>
          {([
            { key: 'active', labelEn: 'Active', labelBn: 'চলমান', count: productions.filter(p => !['completed', 'cancelled'].includes(p.status)).length },
            { key: 'done', labelEn: 'Done', labelBn: 'সম্পন্ন', count: productions.filter(p => p.status === 'completed').length },
            { key: 'cancelled', labelEn: 'Cancelled', labelBn: 'বাতিল', count: productions.filter(p => p.status === 'cancelled').length },
          ] as const).map(f => (
            <Pressable key={f.key} onPress={() => setFilterStatus(f.key)} style={[styles.filterTab, filterStatus === f.key && styles.filterTabActive]}>
              <Text style={[styles.filterLabel, filterStatus === f.key && styles.filterLabelActive]}>
                {bn ? f.labelBn : f.labelEn}
              </Text>
              {f.count > 0 && (
                <View style={[styles.filterBadge, filterStatus === f.key && styles.filterBadgeActive]}>
                  <Text style={styles.filterBadgeText}>{f.count}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {status === 'loading' && productions.length === 0 ? (
          <View style={styles.center}><ActivityIndicator color={palette.emerald} size="large" /></View>
        ) : (
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabPad + 24 }]} showsVerticalScrollIndicator={false}>
            {dateGroups.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>⚙️</Text>
                <Text style={styles.emptyTitle}>{bn ? 'কোনো উৎপাদন নেই' : 'No productions'}</Text>
                <Text style={styles.emptyBody}>{bn ? 'নতুন উৎপাদন তৈরি করতে + চাপুন' : 'Tap + to start a new production'}</Text>
              </View>
            ) : (
              dateGroups.map(group => (
                <View key={group.dateKey} style={{ marginBottom: 6 }}>
                  {/* Date header */}
                  <View style={styles.dateHeader}>
                    <View style={styles.dateGlowDot} />
                    <Text style={styles.dateLabel}>{group.label}</Text>
                    <View style={styles.dateLine} />
                  </View>
                  {group.items.map((prod, idx) => (
                    <View key={prod.id} style={idx < group.items.length - 1 ? { marginBottom: 10 } : undefined}>
                      <ProductionCard
                        prod={prod}
                        locale={locale}
                        money={money}
                        costMoney={costMoney}
                        lots={lots}
                        lotBatches={lotBatches as any}
                        products={products}
                        onAdvance={() => advance(prod, 'in_progress')}
                        onComplete={() => setCompletingProd(prod)}
                        onCancel={() => cancel(prod)}
                        onDelete={() => deleteProd(prod)}
                      />
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {showForm && (
        <View style={styles.overlay}>
          <Pressable style={styles.overlayBg} onPress={() => setShowForm(false)} />
          <NewProductionForm
            lots={lots}
            lotBatches={lotBatches as any}
            products={products}
            locale={locale}
            onClose={() => setShowForm(false)}
            onCreated={p => { dispatch(upsertProduction(p)); setShowForm(false); dispatch(showToast({ title: bn ? 'উৎপাদন তৈরি হয়েছে' : 'Production Created', message: p.productionNumber, type: 'success' })); }}
          />
        </View>
      )}

      {completingProd && (
        <CompleteDialog
          prod={completingProd}
          locale={locale}
          onDone={(qty, bottlePricesJson) => complete(completingProd, qty, bottlePricesJson)}
          onClose={() => setCompletingProd(null)}
        />
      )}
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  title: { color: palette.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  newBtn: { backgroundColor: palette.emerald, borderRadius: radii.md, paddingHorizontal: 16, paddingVertical: 9, shadowColor: palette.emerald, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  newBtnText: { color: palette.onAccent, fontSize: 14, fontWeight: '900' },
  filterBar: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 10, backgroundColor: palette.cardBgElevated, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.cardBorder, padding: 4, gap: 4 },
  filterTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radii.md, gap: 6 },
  filterTabActive: { backgroundColor: palette.night, shadowColor: palette.emerald, shadowOpacity: 0.20, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  filterLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  filterLabelActive: { color: palette.emerald, fontWeight: '900' },
  filterBadge: { backgroundColor: palette.cardBgPrimary, borderRadius: 999, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  filterBadgeActive: { backgroundColor: palette.emeraldLight },
  filterBadgeText: { color: palette.text, fontSize: 10, fontWeight: '900' },
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 0 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 8, paddingHorizontal: 2 },
  dateGlowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.emerald, shadowColor: palette.emerald, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  dateLabel: { color: palette.emerald, fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' as const, textShadowColor: 'rgba(0,168,255,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },
  dateLine: { flex: 1, height: 1, backgroundColor: `${palette.emerald}25`, borderRadius: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: palette.textMuted, fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  emptyBody: { color: palette.textMuted, fontSize: 14, fontWeight: '600' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  overlayBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
});
