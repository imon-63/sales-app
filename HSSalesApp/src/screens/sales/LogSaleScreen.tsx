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

import * as catalogApi from '../../api/catalog';
import * as salesApi from '../../api/sales';
import { SelectMenu } from '../../components/ui/SelectMenu';
import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchSalesDataset } from '../../store/slices/salesDataSlice';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { palette, radii } from '../../theme/designSystem';
import { unitLabelForProduct } from '../../utils/sales';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';

type LineDraft = {
  id: string;
  productId: string;
  currencyId: string;
  quantity: string;
  unitPrice: string;
};

function newLine(productId: string, currencyId: string): LineDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId,
    currencyId,
    quantity: '1',
    unitPrice: '',
  };
}

export function LogSaleScreen() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const { products, warehouses, units, currencies, status } = useAppSelector(
    (s) => s.salesData,
  );
  const stockRows = useAppSelector((s) => s.inventory.stockRows);

  const defaultWh = warehouses[0]?.id ?? '';
  const defaultProduct = products[0]?.id ?? '';
  const defaultCurrency = currencies[0]?.id ?? '';

  const [warehouseId, setWarehouseId] = useState(defaultWh);
  const [saleDate, setSaleDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(() =>
    defaultProduct && defaultCurrency
      ? [newLine(defaultProduct, defaultCurrency)]
      : [],
  );
  const [busy, setBusy] = useState(false);
  const [unitModal, setUnitModal] = useState(false);
  const [currencyModal, setCurrencyModal] = useState(false);
  const [unitDraft, setUnitDraft] = useState('');
  const [currencyDraft, setCurrencyDraft] = useState('');
  const [catalogBusy, setCatalogBusy] = useState(false);

  const tabBottomPad = useTabScreenBottomPadding();

  useEffect(() => {
    if (!warehouseId && warehouses[0]) setWarehouseId(warehouses[0].id);
  }, [warehouseId, warehouses]);

  useEffect(() => {
    if (lines.length === 0 && products[0] && defaultCurrency) {
      setLines([newLine(products[0].id, defaultCurrency)]);
    }
  }, [lines.length, products, defaultCurrency]);

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

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name })),
    [products],
  );

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

  const onAddCurrency = useCallback(
    async (code: string) => {
      if (!token) return;
      await catalogApi.createCurrency({ code }, token);
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
      Alert.alert('Could not add unit', e?.message ?? 'Error');
    } finally {
      setCatalogBusy(false);
    }
  }

  async function saveNewCurrency() {
    if (!token) return;
    const t = currencyDraft.trim();
    if (!t) return;
    try {
      setCatalogBusy(true);
      await onAddCurrency(t);
      setCurrencyModal(false);
      setCurrencyDraft('');
    } catch (e: any) {
      Alert.alert('Could not add currency', e?.message ?? 'Error');
    } finally {
      setCatalogBusy(false);
    }
  }

  const canSubmit = useMemo(() => {
    if (!token || busy || !warehouseId || lines.length === 0) return false;
    for (const ln of lines) {
      const q = Number(ln.quantity);
      const p = Number(ln.unitPrice);
      if (!ln.productId || !ln.currencyId) return false;
      if (!Number.isFinite(q) || q <= 0) return false;
      if (!Number.isFinite(p) || p < 0) return false;
    }
    return true;
  }, [token, busy, warehouseId, lines]);

  async function onSubmit() {
    if (!token || !canSubmit) return;
    const anyOver = lines.some((ln) => {
      const q = Number(ln.quantity);
      const avail =
        stockMap.get(`${warehouseId}__${ln.productId}`) ?? 0;
      return Number.isFinite(q) && q > avail;
    });
    if (anyOver) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Quantity above on-hand',
          'At least one line exceeds available stock in the selected warehouse. Submit anyway?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Submit anyway', onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }
    await submitSaleRequest();
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
          })),
        },
        token,
      );
      await dispatch(fetchSalesDataset()).unwrap();
      await dispatch(fetchInventoryStock());
      Alert.alert('Sale logged', 'Your admin will see this in Signals.');
      setNotes('');
      const pid = products[0]?.id ?? '';
      const cid = currencies[0]?.id ?? '';
      setLines(pid && cid ? [newLine(pid, cid)] : []);
      setSaleDate(new Date().toISOString().slice(0, 10));
    } catch (e: any) {
      Alert.alert('Could not log sale', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading' && products.length === 0) {
    return (
      <MeshBackground>
        <SafeAreaView
          style={[styles.safe, { paddingBottom: tabBottomPad }]}
          edges={['top']}>
          <View style={styles.center}>
            <ActivityIndicator color={palette.emerald} />
            <Text style={styles.hint}>Loading catalog…</Text>
          </View>
        </SafeAreaView>
      </MeshBackground>
    );
  }

  return (
    <MeshBackground>
      <SafeAreaView
        style={[styles.safe, { paddingBottom: tabBottomPad }]}
        edges={['top']}>
        <ScreenHeader
          title="Log a sale"
          subtitle="Pick warehouse and lines. Availability is from received stock for that warehouse."
          tag="Sales"
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
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
              <Text style={styles.cardTitle}>Units & currencies</Text>
              <Text style={styles.catalogHint}>
                New values are saved to the catalog and show up in line dropdowns.
              </Text>
              <View style={styles.catalogRow}>
                <Pressable
                  onPress={() => setUnitModal(true)}
                  style={styles.catalogBtn}>
                  <Text style={styles.catalogBtnText}>+ Add unit</Text>
                </Pressable>
                <Pressable
                  onPress={() => setCurrencyModal(true)}
                  style={styles.catalogBtn}>
                  <Text style={styles.catalogBtnText}>+ Add currency</Text>
                </Pressable>
              </View>
            </GlassCard>

            {lines.map((ln, idx) => {
              const prod = products.find((p) => p.id === ln.productId);
              const unitLbl = prod ? unitLabelForProduct(prod, units) : '';
              const avail =
                warehouseId && ln.productId
                  ? (stockMap.get(`${warehouseId}__${ln.productId}`) ?? 0)
                  : 0;
              const qtyN = Number(ln.quantity);
              const over = Number.isFinite(qtyN) && qtyN > avail;

              return (
                <GlassCard key={ln.id} style={styles.lineCard}>
                  <View style={styles.lineHead}>
                    <Text style={styles.cardTitle}>Line {idx + 1}</Text>
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

                  <SelectMenu
                    label="Product"
                    value={ln.productId}
                    options={productOptions}
                    onChange={(pid) =>
                      setLines((prev) =>
                        prev.map((x) =>
                          x.id === ln.id ? { ...x, productId: pid } : x,
                        ),
                      )
                    }
                    placeholder="Select product"
                  />

                  {prod ? (
                    <Text style={styles.unitPill}>Unit: {unitLbl}</Text>
                  ) : null}

                  <SelectMenu
                    label="Currency"
                    value={ln.currencyId}
                    options={currencyOptions}
                    onChange={(cid) =>
                      setLines((prev) =>
                        prev.map((x) =>
                          x.id === ln.id ? { ...x, currencyId: cid } : x,
                        ),
                      )
                    }
                    placeholder="Select currency"
                  />

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
                  {warehouseId && ln.productId ? (
                    <Text style={[styles.avail, over && styles.availWarn]}>
                      Available in selected warehouse: {avail.toLocaleString()}{' '}
                      {unitLbl || 'units'}
                    </Text>
                  ) : null}

                  <Text style={[styles.label, styles.labelSpaced]}>
                    Unit price (
                    {currencies.find((c) => c.id === ln.currencyId)?.code ?? '—'})
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
                </GlassCard>
              );
            })}

            <Pressable
              onPress={() => {
                const pid = products[0]?.id ?? '';
                const cid = currencies[0]?.id ?? '';
                if (pid && cid) setLines((prev) => [...prev, newLine(pid, cid)]);
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

        <Modal visible={currencyModal} transparent animationType="fade">
          <Pressable
            style={styles.modalBg}
            onPress={() => !catalogBusy && setCurrencyModal(false)}>
            <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>New currency</Text>
              <TextInput
                value={currencyDraft}
                onChangeText={setCurrencyDraft}
                placeholder="e.g. EUR"
                autoCapitalize="characters"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                editable={!catalogBusy}
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => !catalogBusy && setCurrencyModal(false)}
                  style={styles.ghost}>
                  <Text style={styles.ghostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => void saveNewCurrency()}
                  disabled={catalogBusy || !currencyDraft.trim()}
                  style={[
                    styles.primaryMini,
                    (!currencyDraft.trim() || catalogBusy) && styles.primaryMiniOff,
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
  avail: {
    marginTop: 8,
    color: palette.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  availWarn: { color: palette.danger },
  lineCard: { marginTop: 0 },
  lineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
