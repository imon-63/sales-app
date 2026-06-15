import { useFocusEffect } from '@react-navigation/native';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
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

import * as salesApi from '../../api/sales';
import { SelectMenu } from '../../components/ui/SelectMenu';
import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { useT } from '../../i18n/useT';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchSalesDataset } from '../../store/slices/salesDataSlice';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { showToast } from '../../store/slices/uiSlice';
import { unitLabelForProduct } from '../../utils/sales';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';

import { StockTab, ReceiveTab, MoveTab } from '../inventory/sharedInventoryTabs';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Tab config ────────────────────────────────────────────────────────────────

type SalesHubTabKey = 'sale' | 'stock' | 'receive' | 'move';

const SALES_HUB_TABS: { key: SalesHubTabKey; label: string; icon: string; adminOnly?: boolean }[] = [
  { key: 'sale',    label: 'Sell',     icon: '💰' },
  { key: 'stock',   label: 'Stock',    icon: '📦' },
  { key: 'receive', label: 'Purchase', icon: '📥' },
  { key: 'move',    label: 'Move',     icon: '🔀', adminOnly: true },
];

const TAB_ACCENT: Record<SalesHubTabKey, string> = {
  sale:    palette.emerald,
  stock:   palette.emerald,
  receive: palette.violet,
  move:    palette.violet,
};

const TAB_SUBTITLES: Record<SalesHubTabKey, string> = {
  sale:    'Log a new sale',
  stock:   'Live stock levels',
  receive: 'Record incoming stock',
  move:    'Move between warehouses',
};

// ── Payment helpers ───────────────────────────────────────────────────────────

type PayStatus = 'paid' | 'partial' | 'due';

function derivePayStatus(paid: number, total: number): PayStatus {
  if (total <= 0) return 'due';
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'due';
}

const PAY_BADGE: Record<PayStatus, { label: string; bg: string; border: string; text: string }> = {
  paid:    { label: 'PAID',    bg: 'rgba(0,168,255,0.14)', border: 'rgba(0,168,255,0.40)', text: palette.emerald },
  partial: { label: 'PARTIAL', bg: 'rgba(255,179,0,0.14)', border: 'rgba(255,179,0,0.40)', text: palette.violet },
  due:     { label: 'DUE',     bg: 'rgba(255,59,92,0.14)', border: 'rgba(255,59,92,0.40)', text: '#FF3B5C' },
};

function PayBadge({ status }: { status: PayStatus }) {
  const b = PAY_BADGE[status];
  return (
    <View style={[badge.root, { backgroundColor: b.bg, borderColor: b.border }]}>
      <Text style={[badge.text, { color: b.text }]}>{b.label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  root: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  text: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
});

// ── Sale Tab ──────────────────────────────────────────────────────────────────

type LineDraft = {
  id: string;
  productId: string;
  currencyId: string;
  quantity: string;
  unitPrice: string;
  unitId: string;
  lotIds: string[];
  extraCost: string;
};

function newLine(productId = '', currencyId = '', unitId = ''): LineDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId, currencyId, quantity: '1', unitPrice: '', unitId, lotIds: [], extraCost: '',
  };
}

function SaleTab({ bottomPad }: { bottomPad: number }) {
  const t = useT();
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const { products, warehouses, units, currencies, lots, lotBatches, status } = useAppSelector((s) => s.salesData);
  const role = useAppSelector((s) => s.auth.user?.role);
  const stockRows = useAppSelector((s) => s.inventory.stockRows);

  const defaultWh = useMemo(() => warehouses.find(w => w.name.toLowerCase() === 'direct')?.id ?? warehouses[0]?.id ?? '', [warehouses]);
  const defaultCurrency = currencies[0]?.id ?? '';

  const [warehouseId, setWarehouseId] = useState(() => defaultWh);
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(() => defaultCurrency ? [newLine('', defaultCurrency)] : []);
  const [paidAmount, setPaidAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [collapsedLineIds, setCollapsedLineIds] = useState<Record<string, boolean>>({});

  useEffect(() => { if (defaultWh && !warehouseId) setWarehouseId(defaultWh); }, [defaultWh]);
  useEffect(() => { if (lines.length === 0 && defaultCurrency) setLines([newLine('', defaultCurrency)]); }, [lines.length, defaultCurrency]);
  useEffect(() => { if (!token) return; dispatch(fetchInventoryStock()); }, [dispatch, token, warehouseId]);

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of stockRows) {
      const k = `${r.warehouseId}__${r.productId}`;
      m.set(k, (m.get(k) ?? 0) + r.quantityOnHand);
    }
    return m;
  }, [stockRows]);

  const toBaseQty = useCallback((line: LineDraft) => {
    const q = Number(line.quantity);
    if (!Number.isFinite(q) || q <= 0) return 0;
    const u = units.find((x) => x.id === line.unitId);
    const p = products.find((x) => x.id === line.productId);
    const factor = u?.globalFactor ?? p?.conversions?.[u?.id || ''] ?? 1;
    return q * factor;
  }, [products, units]);

  const lineAvailability = useMemo(() => {
    const map = new Map<string, { requestedBase: number; remainingProductBase: number; remainingSelectedLotsBase: number | null }>();
    for (const target of lines) {
      if (!target.productId || !warehouseId) { map.set(target.id, { requestedBase: 0, remainingProductBase: 0, remainingSelectedLotsBase: null }); continue; }
      const requestedBase = toBaseQty(target);
      const totalProductBase = stockMap.get(`${warehouseId}__${target.productId}`) ?? 0;
      const consumedByOtherLines = lines.reduce((acc, ln) => {
        if (ln.id === target.id || ln.productId !== target.productId) return acc;
        return acc + toBaseQty(ln);
      }, 0);
      const remainingProductBase = Math.max(0, totalProductBase - consumedByOtherLines);
      let remainingSelectedLotsBase: number | null = null;
      if (target.lotIds.length > 0) {
        const selectedLotsTotal = lotBatches
          .filter((b) => b.warehouseId === warehouseId && Number(b.remainingQuantity) > 0 && target.lotIds.includes(b.lotId))
          .reduce((sum, b) => sum + Number(b.remainingQuantity), 0);
        const consumedByOtherOverlapping = lines.reduce((acc, ln) => {
          if (ln.id === target.id || ln.productId !== target.productId || !ln.lotIds.length) return acc;
          if (!ln.lotIds.some((lid) => target.lotIds.includes(lid))) return acc;
          return acc + toBaseQty(ln);
        }, 0);
        remainingSelectedLotsBase = Math.max(0, selectedLotsTotal - consumedByOtherOverlapping);
      }
      map.set(target.id, { requestedBase, remainingProductBase, remainingSelectedLotsBase });
    }
    return map;
  }, [lines, warehouseId, stockMap, lotBatches, toBaseQty]);

  const lineLotRemaining = useMemo(() => {
    const out = new Map<string, Map<string, number>>();
    if (!warehouseId) return out;
    const consumeFromOrder = (stockByLot: Map<string, number>, orderedLotIds: string[], qtyBase: number) => {
      let remaining = Math.max(0, qtyBase);
      for (const lid of orderedLotIds) {
        if (remaining <= 0) break;
        const cur = stockByLot.get(lid) ?? 0;
        if (cur <= 0) continue;
        const take = Math.min(cur, remaining);
        stockByLot.set(lid, cur - take);
        remaining -= take;
      }
    };
    for (const target of lines) {
      if (!target.productId) { out.set(target.id, new Map()); continue; }
      const productBatches = lotBatches
        .filter((b) => b.warehouseId === warehouseId && Number(b.remainingQuantity) > 0)
        .filter((b) => { const lot = lots.find((l) => l.id === b.lotId); return lot && lot.productId === target.productId; });
      const stockByLot = new Map<string, number>();
      for (const b of productBatches) stockByLot.set(b.lotId, (stockByLot.get(b.lotId) ?? 0) + Number(b.remainingQuantity));
      const fifoLotOrder = Array.from(new Set(productBatches.sort((a, b) => String(a.acquiredAt).localeCompare(String(b.acquiredAt))).map((b) => b.lotId)));
      for (const other of lines) {
        if (other.id === target.id || other.productId !== target.productId) continue;
        const reqBase = toBaseQty(other);
        if (reqBase <= 0) continue;
        consumeFromOrder(stockByLot, other.lotIds.length > 0 ? other.lotIds : fifoLotOrder, reqBase);
      }
      out.set(target.id, stockByLot);
    }
    return out;
  }, [lines, warehouseId, lotBatches, lots, toBaseQty]);

  const warehouseOptions = useMemo(() => warehouses.map((w) => ({ value: w.id, label: w.name })), [warehouses]);
  const productOptions = useMemo(() => {
    if (!warehouseId) return [];
    return products.filter((p) => (stockMap.get(`${warehouseId}__${p.id}`) ?? 0) > 0).map((p) => ({ value: p.id, label: p.name }));
  }, [products, warehouseId, stockMap]);

  useEffect(() => { setLines((prev) => prev.map((ln) => ({ ...ln, productId: '', unitId: '' }))); }, [warehouseId]);

  const calculatedTotal = useMemo(() =>
    lines.reduce((sum, ln) => {
      const q = Number(ln.quantity), p = Number(ln.unitPrice);
      return sum + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0);
    }, 0),
    [lines]);

  const paidAmountNum = Number(paidAmount) || 0;
  const payStatus: PayStatus = derivePayStatus(paidAmountNum, calculatedTotal);

  const canSubmit = useMemo(() => {
    if (!token || busy || !warehouseId || lines.length === 0) return false;
    for (const ln of lines) {
      const q = Number(ln.quantity), p = Number(ln.unitPrice);
      const u = units.find(x => x.id === ln.unitId);
      if (!ln.productId || !ln.currencyId || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0) return false;
      const availability = lineAvailability.get(ln.id);
      if ((availability?.requestedBase ?? 0) > (availability?.remainingProductBase ?? 0)) return false;
      if (ln.lotIds.length > 0 && (availability?.requestedBase ?? 0) > ln.lotIds.reduce((sum, lid) => sum + (lineLotRemaining.get(ln.id)?.get(lid) ?? 0), 0)) return false;
      if (u?.isWholeNumber && !Number.isInteger(q)) return false;
    }
    return true;
  }, [token, busy, warehouseId, lines, lineAvailability, lineLotRemaining, units]);

  async function onSubmit() {
    if (!token || !canSubmit) return;
    try {
      setBusy(true);
      const totalExtraCost = lines.reduce((sum, ln) => sum + (Number(ln.extraCost) || 0), 0);
      await salesApi.createSale({
        warehouseId,
        saleDate: /^\d{4}-\d{2}-\d{2}$/.test(saleDate) ? saleDate : undefined,
        notes: notes.trim() || undefined,
        paidAmount: paidAmountNum || undefined,
        extraCost: totalExtraCost > 0 ? totalExtraCost : undefined,
        items: lines.map((ln) => ({ productId: ln.productId, quantity: Number(ln.quantity), unitPrice: Number(ln.unitPrice), currencyId: ln.currencyId, unitId: ln.unitId, lotIds: ln.lotIds })),
      }, token);
      await dispatch(fetchSalesDataset()).unwrap();
      await dispatch(fetchInventoryStock());
      dispatch(showToast({ title: 'Sale logged', message: payStatus === 'due' ? 'Marked as due — follow up for payment.' : payStatus === 'partial' ? `৳${paidAmountNum.toLocaleString()} received. Due: ৳${Math.max(0, calculatedTotal - paidAmountNum).toLocaleString()}` : 'Fully paid. Great!', type: 'success' }));
      setWarehouseId('');
      setNotes('');
      setPaidAmount('');
      const cid = currencies[0]?.id ?? '';
      setLines(cid ? [newLine('', cid)] : []);
      setCollapsedLineIds({});
      setSaleDate(new Date().toISOString().slice(0, 10));
    } catch (e: any) {
      dispatch(showToast({ title: 'Could not log sale', message: e?.message ?? 'Unknown error', type: 'error' }));
    } finally { setBusy(false); }
  }

  if (status === 'loading' && products.length === 0) {
    return <View style={sl.center}><ActivityIndicator color={palette.emerald} /><Text style={sl.hint}>{t('logSale.loadingCatalog')}</Text></View>;
  }

  return (
    <KeyboardAvoidingView style={sl.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[sl.scroll, { paddingBottom: bottomPad }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header card */}
        <GlassCard style={sl.headerCard}>
          <SelectMenu label="Warehouse" value={warehouseId} options={warehouseOptions} onChange={setWarehouseId} placeholder="Select warehouse" />
          <Text style={[sl.label, sl.labelSpaced]}>Sale date</Text>
          <TextInput value={saleDate} onChangeText={setSaleDate} placeholder="YYYY-MM-DD" placeholderTextColor={palette.textMuted} style={sl.input} />
          <Text style={[sl.label, sl.labelSpaced]}>Notes (optional)</Text>
          <TextInput value={notes} onChangeText={setNotes} placeholder="PO, buyer, delivery…" placeholderTextColor={palette.textMuted} style={[sl.input, sl.inputTall]} multiline />
        </GlassCard>

        {/* Line items */}
        {lines.map((ln, idx) => {
          const prod = products.find((p) => p.id === ln.productId);
          const unitLbl = prod ? unitLabelForProduct(prod, units) : '';
          const isCollapsed = Boolean(collapsedLineIds[ln.id]);
          const lineAvail = lineAvailability.get(ln.id);
          const requestedBase = lineAvail?.requestedBase ?? 0;
          const remainingProductBase = lineAvail?.remainingProductBase ?? 0;
          const selectedLotsRemainingNow = ln.lotIds.reduce((sum, lid) => sum + (lineLotRemaining.get(ln.id)?.get(lid) ?? 0), 0);
          const overProduct = requestedBase > remainingProductBase;
          const overSelectedLots = ln.lotIds.length > 0 && requestedBase > selectedLotsRemainingNow;

          return (
            <GlassCard key={ln.id} style={sl.lineCard} accentColor={role === 'admin' ? palette.emeraldDeep : palette.emerald}>
              <View style={sl.lineHead}>
                <Pressable onPress={() => setCollapsedLineIds((prev) => ({ ...prev, [ln.id]: !prev[ln.id] }))} style={({ pressed }) => [sl.lineHeadMain, pressed && { opacity: 0.85 }]}>
                  <View style={sl.lineNumBadge}>
                    <Text style={sl.lineNumText}>{idx + 1}</Text>
                  </View>
                  <View>
                    <Text style={sl.cardTitle}>{prod?.name ?? 'Select product'}</Text>
                    {isCollapsed && ln.quantity && ln.unitPrice ? <Text style={sl.lineCollapsedMeta}>{ln.quantity} × ৳{ln.unitPrice}</Text> : null}
                  </View>
                  <Text style={sl.foldChevron}>{isCollapsed ? '▸' : '▾'}</Text>
                </Pressable>
                {lines.length > 1 ? <Pressable hitSlop={8} onPress={() => setLines((prev) => prev.filter((x) => x.id !== ln.id))}><Text style={sl.remove}>✕</Text></Pressable> : null}
              </View>

              {!isCollapsed ? (
                <>
                  <SelectMenu label="Product" value={ln.productId} options={productOptions} onChange={(pid) => { const p = products.find(prod => prod.id === pid); setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, productId: pid, unitId: p?.unitId || '', lotIds: [] } : x)); }} placeholder="Select product" />

                  {prod ? (
                    <View style={sl.unitRow}>
                      <Text style={sl.unitPill}>Unit: {unitLbl}</Text>
                    </View>
                  ) : null}

                  {warehouseId && ln.productId ? (
                    <View style={sl.lotList}>
                      <Text style={sl.lotListTitle}>Available Lots:</Text>
                      {lotBatches.filter(b => b.warehouseId === warehouseId && b.remainingQuantity > 0).filter(b => { const lot = lots.find(l => l.id === b.lotId); if (!lot || lot.productId !== ln.productId) return false; return (lineLotRemaining.get(ln.id)?.get(lot.id) ?? 0) > 0; }).sort((a, b) => String(a.acquiredAt).localeCompare(String(b.acquiredAt))).map((b) => { const lot = lots.find(l => l.id === b.lotId); const rem = lineLotRemaining.get(ln.id)?.get(b.lotId) ?? 0; return <Text key={b.id} style={sl.lotItem}>• {lot?.lotNumber ?? 'Unknown'}: {rem.toLocaleString()} {unitLbl} left</Text>; })}
                      <SelectMenu label="Add lot priority" value="" options={Array.from(new Map(lotBatches.filter(b => b.warehouseId === warehouseId && b.remainingQuantity > 0).filter(b => { const lot = lots.find(l => l.id === b.lotId); if (!lot || lot.productId !== ln.productId) return false; if (ln.lotIds.includes(lot.id)) return false; return (lineLotRemaining.get(ln.id)?.get(lot.id) ?? 0) > 0; }).map((b) => { const lot = lots.find(l => l.id === b.lotId); const rem = lineLotRemaining.get(ln.id)?.get(b.lotId) ?? 0; return [b.lotId, { value: b.lotId, label: `${lot?.lotNumber ?? 'Unknown'} • ${rem.toLocaleString()} ${unitLbl}` }] as const; })).values())} onChange={(lotId) => setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, lotIds: [...x.lotIds, lotId] } : x))} placeholder="Select lot to add" />
                      {ln.lotIds.length > 0 ? (
                        <View style={sl.selectedLotsBox}>
                          <Text style={sl.selectedLotsTitle}>Selected lot order:</Text>
                          {ln.lotIds.map((lid, li) => {
                            const lot = lots.find((l) => l.id === lid);
                            return (
                              <View key={`${ln.id}-${lid}-${li}`} style={sl.selectedLotRow}>
                                <Text style={sl.selectedLotText}>{li + 1}. {lot?.lotNumber ?? 'Unknown'}</Text>
                                <View style={sl.selectedLotActions}>
                                  <Pressable onPress={() => setLines((prev) => prev.map((x) => { if (x.id !== ln.id || li === 0) return x; const next = [...x.lotIds]; [next[li - 1], next[li]] = [next[li], next[li - 1]]; return { ...x, lotIds: next }; }))}><Text style={sl.lotActionBtn}>↑</Text></Pressable>
                                  <Pressable onPress={() => setLines((prev) => prev.map((x) => { if (x.id !== ln.id || li === x.lotIds.length - 1) return x; const next = [...x.lotIds]; [next[li + 1], next[li]] = [next[li], next[li + 1]]; return { ...x, lotIds: next }; }))}><Text style={sl.lotActionBtn}>↓</Text></Pressable>
                                  <Pressable onPress={() => setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, lotIds: x.lotIds.filter((_, i) => i !== li) } : x))}><Text style={sl.lotActionBtnRemove}>✕</Text></Pressable>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {warehouseId && ln.productId ? <Text style={[sl.avail, overProduct && sl.availWarn]}>Available after other lines: {remainingProductBase.toLocaleString()} {unitLbl || 'base units'}</Text> : null}
                  {overSelectedLots ? <Text style={[sl.avail, sl.availWarn]}>Selected lots are insufficient — add/reorder lots.</Text> : null}

                  <View style={sl.qtyPriceRow}>
                    <View style={sl.qtyPriceCol}>
                      <Text style={[sl.label, sl.labelSpaced]}>Qty{unitLbl ? ` (${unitLbl})` : ''}</Text>
                      <TextInput value={ln.quantity} onChangeText={(t) => setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, quantity: t } : x))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={palette.textMuted} style={sl.input} />
                    </View>
                    <View style={sl.qtyPriceCol}>
                      <Text style={[sl.label, sl.labelSpaced]}>Unit Price (৳)</Text>
                      <TextInput value={ln.unitPrice} onChangeText={(t) => setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, unitPrice: t } : x))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={palette.textMuted} style={sl.input} />
                    </View>
                  </View>
                  <Text style={[sl.label, sl.labelSpaced]}>Extra Cost <Text style={sl.optLabel}>(opt.)</Text></Text>
                  <TextInput value={ln.extraCost} onChangeText={(t) => setLines((prev) => prev.map((x) => x.id === ln.id ? { ...x, extraCost: t } : x))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={palette.textMuted} style={sl.input} selectTextOnFocus />
                  {(() => {
                    const rev = (Number(ln.quantity) || 0) * (Number(ln.unitPrice) || 0);
                    const extra = Number(ln.extraCost) || 0;
                    if (rev <= 0 || extra <= 0) return null;
                    return (
                      <View style={[sl.extraHint, { flexDirection: 'row', gap: 8 }]}>
                        <View style={sl.extraBadge}><Text style={sl.extraBadgeText}>− ৳{extra.toLocaleString()}</Text></View>
                        <View style={sl.revBadge}><Text style={sl.revBadgeText}>Revenue ৳{rev.toLocaleString()}</Text></View>
                      </View>
                    );
                  })()}
                </>
              ) : null}
            </GlassCard>
          );
        })}

        <Pressable onPress={() => { const cid = currencies[0]?.id ?? ''; if (cid) setLines((prev) => [...prev, newLine('', cid)]); }} style={sl.addLineBtn} disabled={!products[0] || !currencies[0]}>
          <Text style={sl.addLineIcon}>＋</Text>
          <Text style={sl.addLineText}>Add line</Text>
        </Pressable>

        {/* Payment section */}
        {calculatedTotal > 0 && (
          <GlassCard style={sl.payCard}>
            <View style={sl.payTotalRow}>
              <Text style={sl.payTotalLabel}>Sale Total</Text>
              <Text style={sl.payTotalVal}>৳ {calculatedTotal.toLocaleString()}</Text>
            </View>

            <Text style={[sl.label, { marginTop: 14 }]}>Amount paid now (৳)</Text>
            <TextInput
              value={paidAmount}
              onChangeText={setPaidAmount}
              keyboardType="decimal-pad"
              placeholder={`0 – ${calculatedTotal.toLocaleString()}`}
              placeholderTextColor={palette.textMuted}
              style={sl.input}
            />

            <View style={sl.payStatusRow}>
              <Text style={sl.payStatusLabel}>Payment status:</Text>
              <PayBadge status={payStatus} />
              {payStatus !== 'paid' && calculatedTotal > 0 && (
                <Text style={sl.payDueHint}>Due: ৳{Math.max(0, calculatedTotal - paidAmountNum).toLocaleString()}</Text>
              )}
            </View>

            {/* Quick fill buttons */}
            <View style={sl.quickRow}>
              <Pressable onPress={() => setPaidAmount(String(calculatedTotal))} style={sl.quickBtn}>
                <Text style={sl.quickBtnText}>Full</Text>
              </Pressable>
              <Pressable onPress={() => setPaidAmount(String(Math.floor(calculatedTotal / 2)))} style={sl.quickBtn}>
                <Text style={sl.quickBtnText}>Half</Text>
              </Pressable>
              <Pressable onPress={() => setPaidAmount('0')} style={sl.quickBtn}>
                <Text style={sl.quickBtnText}>Due</Text>
              </Pressable>
            </View>
          </GlassCard>
        )}

        <Pressable onPress={onSubmit} disabled={!canSubmit} style={({ pressed }) => [sl.primary, !canSubmit ? sl.primaryDisabled : null, pressed && canSubmit ? sl.primaryPressed : null]}>
          {busy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={sl.primaryText}>Submit sale</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const sl = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hint: { color: palette.textMuted, fontWeight: '600' },
  scroll: { paddingHorizontal: 16, gap: 12, paddingTop: 4 },
  headerCard: { gap: 0 },
  label: { marginTop: 14, color: palette.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  labelSpaced: { marginTop: 16 },
  input: { marginTop: 8, borderRadius: radii.md, borderWidth: 1, borderColor: palette.stroke, paddingHorizontal: 14, paddingVertical: Platform.select({ ios: 13, android: 11, default: 11 }), color: palette.text, backgroundColor: palette.inputInset, fontWeight: '600' },
  inputTall: { minHeight: 72, textAlignVertical: 'top' },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: '900', flex: 1 },
  lineCollapsedMeta: { color: palette.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  unitRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  unitPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.sm, backgroundColor: palette.night, color: palette.textMuted, fontWeight: '800', fontSize: 12 },
  avail: { marginTop: 8, color: palette.textMuted, fontWeight: '700', fontSize: 12 },
  availWarn: { color: palette.danger },
  lotList: { marginTop: 12, padding: 10, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: radii.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 4 },
  lotListTitle: { fontSize: 11, fontWeight: '900', color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  lotItem: { fontSize: 12, fontWeight: '700', color: palette.text, lineHeight: 18 },
  selectedLotsBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 8, gap: 6 },
  selectedLotsTitle: { fontSize: 11, fontWeight: '900', color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectedLotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectedLotText: { color: palette.text, fontSize: 12, fontWeight: '700' },
  selectedLotActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  lotActionBtn: { color: palette.emerald, fontSize: 14, fontWeight: '900' },
  lotActionBtnRemove: { color: palette.rose, fontSize: 13, fontWeight: '900' },
  lineCard: {},
  lineHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineHeadMain: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  lineNumBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,168,255,0.12)', borderWidth: 1, borderColor: 'rgba(0,168,255,0.30)' },
  lineNumText: { color: palette.emerald, fontSize: 12, fontWeight: '900' },
  foldChevron: { color: palette.textMuted, fontSize: 14, fontWeight: '900' },
  remove: { color: palette.rose, fontWeight: '900', fontSize: 16, paddingHorizontal: 4 },
  addLineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,168,255,0.30)', borderRadius: radii.md, paddingVertical: 11, paddingHorizontal: 16 },
  addLineIcon: { color: palette.emerald, fontSize: 18, fontWeight: '900', lineHeight: 20 },
  addLineText: { color: palette.emerald, fontWeight: '900', fontSize: 13 },
  payCard: { gap: 0 },
  payTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payTotalLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  payTotalVal: { color: palette.text, fontSize: 22, fontWeight: '900' },
  payStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  payStatusLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '800' },
  payDueHint: { color: '#FF3B5C', fontSize: 12, fontWeight: '800' },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickBtn: { flex: 1, paddingVertical: 8, borderRadius: radii.md, alignItems: 'center', backgroundColor: 'rgba(0,168,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,168,255,0.20)' },
  quickBtnText: { color: palette.emerald, fontSize: 12, fontWeight: '900' },
  primary: { marginTop: 4, borderRadius: radii.lg, paddingVertical: 15, alignItems: 'center', backgroundColor: palette.emerald, shadowColor: palette.emerald, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  primaryDisabled: { opacity: 0.5 },
  primaryPressed: { backgroundColor: palette.emeraldDeep },
  primaryText: { color: palette.onAccent, fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },
  productsSection: { gap: 6 },
  productsSectionTitle: { fontSize: 11, fontWeight: '800', color: palette.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 2 },
  noStockHint: { color: palette.textMuted, fontSize: 13, fontWeight: '600', paddingVertical: 8 },
  productCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: palette.cardBg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    gap: 10,
  },
  productCardBody: { flex: 1, gap: 3 },
  productCardName: { color: palette.text, fontSize: 14, fontWeight: '800' },
  productCardLot: { color: palette.textMuted, fontSize: 11, fontWeight: '700' },
  productCardRight: { alignItems: 'flex-end' as const, gap: 2 },
  productCardQty: { color: palette.emerald, fontSize: 16, fontWeight: '900' },
  productCardUnit: { color: palette.textMuted, fontSize: 11, fontWeight: '700' },
  productCardArrow: { color: palette.textMuted, fontSize: 22, fontWeight: '300', marginLeft: 2 },
  qtyPriceRow: { flexDirection: 'row' as const, gap: 10 },
  qtyPriceCol: { flex: 1 },
  optLabel: { fontWeight: '600', fontSize: 10, textTransform: 'none' as const, letterSpacing: 0, color: palette.textMuted },
  extraHint: { marginTop: 6 },
  extraBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(251,191,36,0.12)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.30)' },
  extraBadgeText: { fontSize: 11, fontWeight: '700' as const, color: '#FBBF24' },
  revBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(52,211,153,0.10)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)' },
  revBadgeText: { fontSize: 11, fontWeight: '700' as const, color: palette.emerald },
});

// ── Hub screen ────────────────────────────────────────────────────────────────

export function SalesHubScreen() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);
  const tabBottomPad = useTabScreenBottomPadding();

  const [activeTab, setActiveTab] = useState<SalesHubTabKey>('sale');

  const visibleTabs = SALES_HUB_TABS.filter(t => !t.adminOnly || role === 'admin');

  useFocusEffect(useCallback(() => {
    if (token) {
      dispatch(fetchInventoryStock());
      dispatch(fetchSalesDataset());
    }
  }, [dispatch, token]));

  function switchTab(key: SalesHubTabKey) {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setActiveTab(key);
  }

  const accentColor = TAB_ACCENT[activeTab];

  return (
    <MeshBackground>
      <SafeAreaView style={hub.safe} edges={['top']}>

        {/* Header */}
        <View style={hub.header}>
          <View style={hub.headerLeft}>
            <Text style={hub.title}>Sales</Text>
            <Text style={hub.subtitle}>{TAB_SUBTITLES[activeTab]}</Text>
          </View>
          <View style={[hub.headerBadge, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}45` }]}>
            <Text style={hub.headerBadgeIcon}>{visibleTabs.find(t => t.key === activeTab)?.icon ?? '💰'}</Text>
          </View>
        </View>

        {/* Tab selector — pill style matching PurchaseDetailScreen */}
        <View style={hub.tabBar}>
          {visibleTabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => switchTab(tab.key)}
                style={[hub.tabBtn, active && hub.tabBtnActive]}
              >
                <Text style={[hub.tabLabel, active && hub.tabLabelActive]}>{tab.label}</Text>
                {active && <View style={hub.tabUnder} />}
              </Pressable>
            );
          })}
        </View>

        {/* All panels mounted — display:none preserves form state */}
        <View style={[hub.panel, activeTab !== 'sale'    && hub.hidden]}><SaleTab bottomPad={tabBottomPad} /></View>
        <View style={[hub.panel, activeTab !== 'stock'   && hub.hidden]}><StockTab bottomPad={tabBottomPad} /></View>
        <View style={[hub.panel, activeTab !== 'receive' && hub.hidden]}><ReceiveTab bottomPad={tabBottomPad} /></View>
        <View style={[hub.panel, activeTab !== 'move'    && hub.hidden]}><MoveTab bottomPad={tabBottomPad} /></View>

      </SafeAreaView>
    </MeshBackground>
  );
}

const hub = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerLeft: { flex: 1, gap: 2 },
  title: { color: palette.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { color: palette.textMuted, fontSize: 12, fontWeight: '600' },
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerBadgeIcon: { fontSize: 22 },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 2, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: radii.md, position: 'relative', alignItems: 'center' },
  tabBtnActive: { backgroundColor: palette.paper, shadowColor: palette.emerald, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 3 }, elevation: 9 },
  tabLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  tabLabelActive: { color: palette.emerald, fontWeight: '900', textShadowColor: 'rgba(0,168,255,0.55)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  tabUnder: { position: 'absolute', bottom: 4, width: 26, height: 2.5, backgroundColor: palette.emerald, borderRadius: 999, shadowColor: palette.emerald, shadowOpacity: 0.80, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  panel: { flex: 1 },
  hidden: { display: 'none' },
});
