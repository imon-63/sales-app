import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as salesApi from '../../api/sales';
import * as catalogApi from '../../api/catalog';
import { SelectMenu } from '../../components/ui/SelectMenu';
import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useT } from '../../i18n/useT';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchSalesDataset } from '../../store/slices/salesDataSlice';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { palette, radii } from '../../theme/designSystem';
import { showToast } from '../../store/slices/uiSlice';
import { unitLabelForProduct } from '../../utils/sales';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';

type LineDraft = {
  id: string;
  productId: string;
  currencyId: string;
  quantity: string;
  unitPrice: string;
  unitId: string;
};

function newLine(productId: string = '', currencyId: string = '', unitId: string = ''): LineDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId,
    currencyId,
    quantity: '1',
    unitPrice: '',
    unitId,
  };
}

export function LogSaleScreen() {
  const t = useT();
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const { products, warehouses, units, currencies, lots, lotBatches, status } = useAppSelector(
    (s) => s.salesData,
  );
  const role = useAppSelector((s) => s.auth.user?.role);
  const stockRows = useAppSelector((s) => s.inventory.stockRows);

  const defaultWh = warehouses[0]?.id ?? '';
  const defaultProduct = products[0]?.id ?? '';
  const defaultCurrency = currencies[0]?.id ?? '';

  const [warehouseId, setWarehouseId] = useState('');
  const [saleDate, setSaleDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(() =>
    defaultCurrency ? [newLine('', defaultCurrency)] : [],
  );
  const [busy, setBusy] = useState(false);
  const [collapsedLineIds, setCollapsedLineIds] = useState<Record<string, boolean>>({});
  const [unitModal, setUnitModal] = useState(false);
  const [unitDraft, setUnitDraft] = useState('');
  const [catalogBusy, setCatalogBusy] = useState(false);

  const tabBottomPad = useTabScreenBottomPadding();

  // Removed auto-select first warehouse logic to keep it empty initially

  useEffect(() => {
    if (lines.length === 0 && defaultCurrency) {
      setLines([newLine('', defaultCurrency)]);
    }
  }, [lines.length, defaultCurrency]);

  useEffect(() => {
    if (!token) return;
    dispatch(fetchInventoryStock());
  }, [dispatch, token, warehouseId]);

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of stockRows) {
      m.set(`${r.warehouseId}__${r.productId}`, r.quantityOnHand);
    }
    return m;
  }, [stockRows]);

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.name })),
    [warehouses],
  );

  const productOptions = useMemo(() => {
    if (!warehouseId) return [];
    return products
      .filter((p) => (stockMap.get(`${warehouseId}__${p.id}`) ?? 0) > 0)
      .map((p) => ({ value: p.id, label: p.name }));
  }, [products, warehouseId, stockMap]);

  // Reset line selections whenever the warehouse changes
  useEffect(() => {
    setLines((prev) => prev.map((ln) => ({ ...ln, productId: '', unitId: '' })));
  }, [warehouseId]);

  const currencyOptions = useMemo(
    () => currencies.map((c) => ({ value: c.id, label: c.code })),
    [currencies],
  );

  const onAddUnit = useCallback(
    async (label: string) => {
      if (!token) return;
      await catalogApi.createUnit({ label }, token);
      await dispatch(fetchSalesDataset()).unwrap();
    },
    [dispatch, token],
  );



  async function saveNewUnit() {
    if (!token) return;
    const t = unitDraft.trim();
    if (!t) return;
    try {
      setCatalogBusy(true);
      await onAddUnit(t);
      setUnitModal(false);
      setUnitDraft('');
    } catch (e: any) {
      dispatch(showToast({
        title: 'Could not add unit',
        message: e?.message ?? 'Error',
        type: 'error'
      }));
    } finally {
      setCatalogBusy(false);
    }
  }



  const canSubmit = useMemo(() => {
    if (!token || busy || !warehouseId || lines.length === 0) return false;
    for (const ln of lines) {
      const q = Number(ln.quantity);
      const p = Number(ln.unitPrice);
      const u = units.find(x => x.id === ln.unitId);
      const prod = products.find(x => x.id === ln.productId);
      
      if (!ln.productId || !ln.unitId || !ln.currencyId) return false;
      if (!Number.isFinite(q) || q <= 0) return false;
      if (!Number.isFinite(p) || p < 0) return false;

      // --- Hard Stock Block ---
      const avail = warehouseId && ln.productId ? (stockMap.get(`${warehouseId}__${ln.productId}`) ?? 0) : 0;
      const factory = u?.globalFactor ?? prod?.conversions?.[u?.id || ''] ?? 1;
      const requestedBase = q * factory;
      if (requestedBase > avail) return false; // Hard block if over stock

      // Enforce whole numbers for specific units
      if (u?.isWholeNumber && !Number.isInteger(q)) return false;
    }
    return true;
  }, [token, busy, warehouseId, lines]);

  async function onSubmit() {
    if (!token || !canSubmit) return;
    await submitSaleRequest();
  }

  function toggleLineCollapsed(lineId: string) {
    setCollapsedLineIds((prev) => ({ ...prev, [lineId]: !prev[lineId] }));
  }

  async function submitSaleRequest() {
    if (!token || !canSubmit) return;
    try {
      setBusy(true);
      await salesApi.createSale(
        {
          warehouseId,
          saleDate: /^\d{4}-\d{2}-\d{2}$/.test(saleDate) ? saleDate : undefined,
          notes: notes.trim() || undefined,
          items: lines.map((ln) => ({
            productId: ln.productId,
            quantity: Number(ln.quantity),
            unitPrice: Number(ln.unitPrice),
            currencyId: ln.currencyId,
            unitId: ln.unitId,
          })),
        },
        token,
      );
      await dispatch(fetchSalesDataset()).unwrap();
      await dispatch(fetchInventoryStock());
      dispatch(showToast({
        title: 'Sale logged',
        message: 'Your admin will see this in Signals.',
        type: 'success'
      }));
      setNotes('');
      const cid = currencies[0]?.id ?? '';
      setLines(cid ? [newLine('', cid)] : []);
      setSaleDate(new Date().toISOString().slice(0, 10));
    } catch (e: any) {
      dispatch(showToast({
        title: 'Could not log sale',
        message: e?.message ?? 'Unknown error',
        type: 'error'
      }));
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading' && products.length === 0) {
    return (
      <MeshBackground>
        <SafeAreaView
          style={styles.safe}
          edges={['top']}>
          <View style={styles.center}>
            <ActivityIndicator color={palette.emerald} />
            <Text style={styles.hint}>{t('logSale.loadingCatalog')}</Text>
          </View>
        </SafeAreaView>
      </MeshBackground>
    );
  }

  return (
    <MeshBackground>
      <SafeAreaView
        style={styles.safe}
        edges={['top']}>
        <ScreenHeader title={t('logSale.title')} />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: tabBottomPad }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <GlassCard>
              <SelectMenu
                label="Warehouse"
                value={warehouseId}
                options={warehouseOptions}
                onChange={setWarehouseId}
                placeholder="Select warehouse"
              />

              <Text style={[styles.label, styles.labelSpaced]}>Sale date</Text>
              <TextInput
                value={saleDate}
                onChangeText={setSaleDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
              />

              <Text style={[styles.label, styles.labelSpaced]}>Notes (optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="PO, buyer, delivery…"
                placeholderTextColor={palette.textMuted}
                style={[styles.input, styles.inputTall]}
                multiline
              />
            </GlassCard>

            <GlassCard style={styles.catalogCard}>
              <Text style={styles.cardTitle}>Units</Text>
              <Text style={styles.catalogHint}>
                New values are saved to the catalog and show up in line dropdowns.
              </Text>
              <View style={styles.catalogRow}>
                <Pressable
                  onPress={() => setUnitModal(true)}
                  style={styles.catalogBtn}>
                  <Text style={styles.catalogBtnText}>+ Add unit</Text>
                </Pressable>
              </View>
            </GlassCard>

            {lines.map((ln, idx) => {
              const prod = products.find((p) => p.id === ln.productId);
              const unitLbl = prod ? unitLabelForProduct(prod, units) : '';
              const isCollapsed = Boolean(collapsedLineIds[ln.id]);
              
              // Resolve all valid units (base + conversions)
              const allUnitLabels = (() => {
                if (!prod) return '';
                const ids = [prod.unitId, ...Object.keys(prod.conversions || {})];
                return ids
                  .map((id) => units.find((u) => u.id === id)?.label)
                  .filter(Boolean)
                  .join(', ');
              })();

              // Aggregated availability: subtract usage from other lines for the same product
              const availInWarehouse =
                warehouseId && ln.productId
                  ? (stockMap.get(`${warehouseId}__${ln.productId}`) ?? 0)
                  : 0;
              
              const consumedByOtherLinesBase = (() => {
                if (!ln.productId) return 0;
                return lines.reduce((acc, other, oIdx) => {
                  if (oIdx === idx || other.productId !== ln.productId) return acc;
                  const q = Number(other.quantity) || 0;
                  const otherProd = products.find((p) => p.id === other.productId);
                  const otherUnit = units.find((u) => u.id === other.unitId);
                  const factor =
                    otherUnit?.globalFactor ??
                    otherProd?.conversions?.[otherUnit?.id || ''] ??
                    1;
                  return acc + q * factor;
                }, 0);
              })();

              const avail = Math.max(0, availInWarehouse - consumedByOtherLinesBase);
              const qtyN = Number(ln.quantity);
              const over = Number.isFinite(qtyN) && qtyN > avail;

              return (
                <GlassCard 
                  key={ln.id} 
                  style={styles.lineCard}
                  accentColor={role === 'admin' ? palette.emeraldDeep : palette.emerald}>
                  <View style={styles.lineHead}>
                    <Pressable
                      onPress={() => toggleLineCollapsed(ln.id)}
                      style={({ pressed }) => [styles.lineHeadMain, pressed && { opacity: 0.85 }]}>
                      <Text style={styles.cardTitle}>Line {idx + 1}</Text>
                      <Text style={styles.foldChevron}>{isCollapsed ? '▸' : '▾'}</Text>
                    </Pressable>
                    {lines.length > 1 ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          setLines((prev) => prev.filter((x) => x.id !== ln.id))
                        }>
                        <Text style={styles.remove}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {!isCollapsed ? (
                    <>
                      <SelectMenu
                        label="Product"
                        value={ln.productId}
                        options={productOptions}
                        onChange={(pid) => {
                          const p = products.find(prod => prod.id === pid);
                          setLines((prev) =>
                            prev.map((x) =>
                              x.id === ln.id ? { ...x, productId: pid, unitId: p?.unitId || '' } : x,
                            ),
                          )
                        }}
                        placeholder="Select product"
                      />

                      {prod ? (
                        <View>
                          <Text style={styles.unitPill}>Unit: {unitLbl}</Text>
                          {allUnitLabels ? (
                            <Text style={styles.allUnits}>Available in: {allUnitLabels}</Text>
                          ) : null}
                        </View>
                      ) : null}

                      {warehouseId && ln.productId ? (
                        <View style={styles.lotList}>
                          <Text style={styles.lotListTitle}>Available Lots:</Text>
                          {lotBatches
                            .filter(b => b.warehouseId === warehouseId && b.remainingQuantity > 0)
                            .filter(b => {
                              const lot = lots.find(l => l.id === b.lotId);
                              return lot && lot.productId === ln.productId;
                            })
                            .sort((a, b) => String(a.acquiredAt).localeCompare(String(b.acquiredAt)))
                            .map((b) => {
                              const lot = lots.find(l => l.id === b.lotId);
                              return (
                                <Text key={b.id} style={styles.lotItem}>
                                  • {lot?.lotNumber ?? 'Unknown'}: {b.remainingQuantity.toLocaleString()} {unitLbl} left
                                </Text>
                              );
                            })}
                        </View>
                      ) : null}

                      <View style={styles.qtyUnitRow}>
                        <View style={styles.qtyCol}>
                          <Text style={[styles.label, styles.labelSpaced]}>Quantity</Text>
                          <TextInput
                            value={ln.quantity}
                            onChangeText={(t) =>
                              setLines((prev) =>
                                prev.map((x) =>
                                  x.id === ln.id ? { ...x, quantity: t } : x,
                                ),
                              )
                            }
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={palette.textMuted}
                            style={styles.input}
                          />
                        </View>
                        <View style={styles.unitCol}>
                          <SelectMenu
                            label="Unit"
                            value={ln.unitId}
                            options={units
                              .filter(u => {
                                if (!prod) return u.globalFactor !== undefined || u.label === 'BOSTA';
                                return u.globalFactor !== undefined || (prod.conversions && prod.conversions[u.id] !== undefined) || u.id === prod.unitId;
                              })
                              .map(u => ({ value: u.id, label: u.label }))
                            }
                            onChange={(uid) =>
                              setLines((prev) =>
                                prev.map((x) => (x.id === ln.id ? { ...x, unitId: uid } : x)),
                              )
                            }
                            placeholder="Unit"
                          />
                        </View>
                      </View>

                      <Text style={[styles.label, styles.labelSpaced]}>
                        Unit price (BDT)
                      </Text>
                      <TextInput
                        value={ln.unitPrice}
                        onChangeText={(t) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.id === ln.id ? { ...x, unitPrice: t } : x,
                            ),
                          )
                        }
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={palette.textMuted}
                        style={styles.input}
                      />
                    </>
                  ) : null}
                </GlassCard>
              );
            })}

            <Pressable
              onPress={() => {
                const cid = currencies[0]?.id ?? '';
                if (cid) setLines((prev) => [...prev, newLine('', cid)]);
              }}
              style={styles.secondary}
              disabled={!products[0] || !currencies[0]}>
              <Text style={styles.secondaryText}>+ Add line</Text>
            </Pressable>

            <Pressable
              onPress={onSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.primary,
                !canSubmit ? styles.primaryDisabled : null,
                pressed && canSubmit ? styles.primaryPressed : null,
              ]}>
              {busy ? (
                <ActivityIndicator color={palette.onAccent} />
              ) : (
                <Text style={styles.primaryText}>Submit sale</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal visible={unitModal} transparent animationType="fade">
          <Pressable style={styles.modalBg} onPress={() => !catalogBusy && setUnitModal(false)}>
            <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>New unit</Text>
              <TextInput
                value={unitDraft}
                onChangeText={setUnitDraft}
                placeholder="e.g. crate, pallet"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                editable={!catalogBusy}
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => !catalogBusy && setUnitModal(false)}
                  style={styles.ghost}>
                  <Text style={styles.ghostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => void saveNewUnit()}
                  disabled={catalogBusy || !unitDraft.trim()}
                  style={[
                    styles.primaryMini,
                    (!unitDraft.trim() || catalogBusy) && styles.primaryMiniOff,
                  ]}>
                  <Text style={styles.primaryMiniText}>
                    {catalogBusy ? 'Saving…' : 'Save'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>


      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 28, gap: 14, paddingTop: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: 10, color: palette.textMuted, fontWeight: '600' },
  cardTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  label: {
    marginTop: 14,
    color: palette.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelSpaced: { marginTop: 16 },
  input: {
    marginTop: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.stroke,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 13, android: 11, default: 11 }),
    color: palette.text,
    backgroundColor: palette.inputInset,
    fontWeight: '600',
  },
  inputTall: { minHeight: 72, textAlignVertical: 'top' },
  catalogCard: { gap: 0 },
  catalogHint: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  unitPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: palette.night,
    color: palette.textMuted,
    fontWeight: '800',
    fontSize: 12,
  },
  allUnits: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  avail: {
    marginTop: 8,
    color: palette.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  availWarn: { color: palette.danger },
  lotList: {
    marginTop: 12,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  lotListTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  lotItem: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
    lineHeight: 18,
  },
  lineCard: { marginTop: 0 },
  qtyUnitRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  qtyCol: { flex: 0.6 },
  unitCol: { flex: 0.4 },
  lineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineHeadMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  foldChevron: {
    color: palette.textMuted,
    fontSize: 16,
    fontWeight: '900',
    marginTop: -1,
  },
  remove: { color: palette.rose, fontWeight: '800', fontSize: 13 },
  secondary: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  secondaryText: { color: palette.emerald, fontWeight: '900', fontSize: 14 },
  primary: {
    marginTop: 4,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: palette.emerald,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryPressed: { backgroundColor: palette.emeraldDeep },
  primaryText: { color: palette.onAccent, fontWeight: '900', fontSize: 15 },
  catalogRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  catalogBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.inputInset,
  },
  catalogBtnText: { color: palette.emerald, fontWeight: '900', fontSize: 14 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(13,27,17,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    borderRadius: radii.lg,
    backgroundColor: palette.paper,
    padding: 18,
  },
  modalTitle: { fontSize: 17, fontWeight: '900', color: palette.text },
  modalActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  ghost: { paddingVertical: 10, paddingHorizontal: 12 },
  ghostText: { color: palette.textMuted, fontWeight: '800' },
  primaryMini: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    backgroundColor: palette.emerald,
  },
  primaryMiniOff: { opacity: 0.45 },
  primaryMiniText: { color: palette.onAccent, fontWeight: '900' },
});
