import React, { useMemo, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import * as inventoryApi from '../../api/inventory';
import { SelectMenu } from '../../components/ui/SelectMenu';
import { AppMenuButton } from '../../components/navigation/AppMenuButton';
import { StackBackButton } from '../../components/navigation/StackBackButton';
import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { useAppSideMenu } from '../../navigation/useAppSideMenu';
import { palette, radii } from '../../theme/designSystem';
import { showToast } from '../../store/slices/uiSlice';

type LineDraft = {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
  unitId: string;
  lotNumber: string;
};

function newLine(pid: string = '', unitId: string = ''): LineDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: pid,
    quantity: '1',
    unitCost: '',
    unitId: unitId,
    lotNumber: '',
  };
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function ReceiveStockScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { menuModal, openMenu } = useAppSideMenu();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);
  const { products, warehouses, units, status: dataStatus } = useAppSelector((s) => s.salesData);
  
  function getConversionFactor(pid: string, uid: string) {
    const unit = units.find((u) => u.id === uid);
    const product = products.find((p) => p.id === pid);

    if (!unit) return 1;
    if (typeof unit.globalFactor === 'number') return unit.globalFactor;
    if (product && product.conversions && typeof product.conversions[uid] === 'number') {
      return product.conversions[uid];
    }
    return 1;
  }

  const [warehouseId, setWarehouseId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.name })),
    [warehouses],
  );

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name })),
    [products],
  );

  // No auto-populate per user request (default Select warehouse)
  // React.useEffect(() => {
  //   if (!warehouseId && warehouses[0]) setWarehouseId(warehouses[0].id);
  // }, [warehouseId, warehouses]);

  React.useEffect(() => {
    if (lines.length === 0) {
      const first = newLine();
      setLines([first]);
      setExpandedLines(new Set([first.id]));
    }
  }, [lines.length]);

  function toggleExpand(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canSubmit = useMemo(() => {
    if (!token || role !== 'admin' || busy || !warehouseId || lines.length === 0) {
      return false;
    }
    for (const ln of lines) {
      const q = Number(ln.quantity);
      const c = Number(ln.unitCost);
      const u = units.find(x => x.id === ln.unitId);
      
      if (!ln.productId || !ln.unitId || !Number.isFinite(q) || q <= 0) return false;
      if (!Number.isFinite(c) || c < 0) return false;
      
      // Enforce whole numbers for specific units
      if (u?.isWholeNumber && !Number.isInteger(q)) return false;
    }
    return true;
  }, [token, role, busy, warehouseId, lines]);

  async function onSubmit() {
    if (!token || !canSubmit) return;
    try {
      setBusy(true);
      await inventoryApi.createPurchase(
        {
          warehouseId,
          purchaseDate: /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ? purchaseDate : undefined,
          notes: notes.trim() || undefined,
          items: lines.map((ln) => ({
            productId: ln.productId,
            quantity: Number(ln.quantity),
            unitCost: Number(ln.unitCost),
            unitId: ln.unitId,
            lotNumber: ln.lotNumber.trim() || undefined,
          })),
        },
        token,
      );
      await dispatch(fetchInventoryStock()).unwrap();
      dispatch(showToast({
        title: 'Received',
        message: 'Purchase recorded. Stock room reflects new lots.',
        type: 'success'
      }));
      setWarehouseId('');
      setNotes('');
      const freshLine = newLine();
      setLines([freshLine]);
      setExpandedLines(new Set([freshLine.id]));
      setPurchaseDate(new Date().toISOString().slice(0, 10));
    } catch (e: any) {
      dispatch(showToast({
        title: 'Could not receive',
        message: e?.message ?? 'Unknown error',
        type: 'error'
      }));
    } finally {
      setBusy(false);
    }
  }

  if (role !== 'admin') {
    return (
      <MeshBackground>
        <StackBackButton />
        <AppMenuButton onPress={openMenu} />
        {menuModal}
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={[styles.head, { paddingTop: insets.top + 52 }]}>
            <Text style={styles.title}>Receive stock</Text>
            <Text style={styles.sub}>Only administrators can post inbound purchases.</Text>
          </View>
        </SafeAreaView>
      </MeshBackground>
    );
  }

  if (dataStatus === 'loading' && products.length === 0) {
    return (
      <MeshBackground>
        <StackBackButton />
        <AppMenuButton onPress={openMenu} />
        {menuModal}
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
            <ActivityIndicator color={palette.emerald} />
          </View>
        </SafeAreaView>
      </MeshBackground>
    );
  }

  return (
    <MeshBackground>
      <StackBackButton />
      <AppMenuButton onPress={openMenu} />
      {menuModal}
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.head, { paddingTop: insets.top + 32 }]}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Receive stock</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{lines.length}</Text>
            </View>
          </View>
          <Text style={styles.sub}>
            Creates purchase rows, new lots, and warehouse batches.
          </Text>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <GlassCard>
              <SelectMenu
                label="Destination warehouse"
                value={warehouseId}
                options={warehouseOptions}
                onChange={setWarehouseId}
                placeholder="Select warehouse"
              />

              <Text style={[styles.label, styles.labelSpaced]}>Receive date</Text>
              <TextInput
                value={purchaseDate}
                onChangeText={setPurchaseDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
              />

              <Text style={[styles.label, styles.labelSpaced]}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Vendor, invoice #…"
                placeholderTextColor={palette.textMuted}
                style={[styles.input, styles.inputTall]}
                multiline
              />
            </GlassCard>

            {lines.map((ln, idx) => {
              const isExpanded = expandedLines.has(ln.id);
              return (
                <GlassCard key={ln.id} style={styles.lineCard}>
                  <Pressable 
                    onPress={() => toggleExpand(ln.id)}
                    style={({ pressed }) => [styles.lineHead, pressed && { opacity: 0.7 }]}>
                    <View style={styles.lineHeadLeft}>
                      <Text style={styles.arrow}>{isExpanded ? '▼' : '▶'}</Text>
                      <Text style={styles.cardTitle}>Line {idx + 1}</Text>
                    </View>
                    {lines.length > 1 ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setLines((prev) => prev.filter((x) => x.id !== ln.id));
                        }}>
                        <Text style={styles.remove}>✕</Text>
                      </Pressable>
                    ) : null}
                  </Pressable>

                  {isExpanded && (
                    <View style={styles.lineContent}>
                      <SelectMenu
                        label="Product"
                        value={ln.productId}
                        options={productOptions}
                        onChange={(pid) => {
                          const p = products.find(x => x.id === pid);
                          setLines((prev) =>
                            prev.map((x) => (x.id === ln.id ? { ...x, productId: pid, unitId: p?.unitId || '' } : x)),
                          )
                        }}
                        placeholder="Select product"
                      />

                      <Text style={[styles.label, styles.labelSpaced]}>Lot Number</Text>
                      <TextInput
                        value={ln.lotNumber}
                        onChangeText={(t) =>
                          setLines((prev) =>
                            prev.map((x) => (x.id === ln.id ? { ...x, lotNumber: t } : x)),
                          )
                        }
                        placeholder="e.g. WH-AUG-01"
                        placeholderTextColor={palette.textMuted}
                        style={styles.input}
                      />

                      <View style={styles.qtyUnitRow}>
                        <View style={styles.qtyCol}>
                          <Text style={[styles.label, styles.labelSpaced]}>Quantity</Text>
                          <TextInput
                            value={ln.quantity}
                            onChangeText={(t) =>
                              setLines((prev) =>
                                prev.map((x) => (x.id === ln.id ? { ...x, quantity: t } : x)),
                              )
                            }
                            keyboardType="decimal-pad"
                            style={styles.input}
                          />
                        </View>
                        <View style={styles.unitCol}>
                          <SelectMenu
                            label="Unit"
                            value={ln.unitId}
                            options={units
                              .filter(u => {
                                const p = products.find(prod => prod.id === ln.productId);
                                if (!p) return u.globalFactor !== undefined || u.label === 'BOSTA';
                                // Show global units AND product-specific conversions
                                return u.globalFactor !== undefined || (p.conversions && p.conversions[u.id] !== undefined) || u.id === p.unitId;
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
                        Cost per {units.find(u => u.id === (products.find(p => p.id === ln.productId)?.unitId))?.label || 'base unit'} (BDT)
                      </Text>
                      <TextInput
                        value={ln.unitCost}
                        onChangeText={(t) =>
                          setLines((prev) =>
                            prev.map((x) => (x.id === ln.id ? { ...x, unitCost: t } : x)),
                          )
                        }
                        placeholder="Price for 1 KG/LITER"
                        placeholderTextColor={palette.textMuted}
                        keyboardType="decimal-pad"
                        style={styles.input}
                      />

                      {Number(ln.quantity) > 0 && Number(ln.unitCost) > 0 && (
                        <View style={styles.lineSummary}>
                          <Text style={styles.lineSummaryText}>
                            Total Investment: {Number(ln.quantity).toLocaleString()} {units.find(u => u.id === ln.unitId)?.label || 'units'} × 
                            ({getConversionFactor(ln.productId, ln.unitId).toLocaleString()} × BDT {Number(ln.unitCost).toLocaleString()}) = 
                            <Text style={styles.lineSummaryVal}> BDT {(Number(ln.quantity) * getConversionFactor(ln.productId, ln.unitId) * Number(ln.unitCost)).toLocaleString()}</Text>
                          </Text>
                          <Text style={styles.lineSummaryNote}>
                            * This is recorded as BDT {Number(ln.unitCost).toLocaleString()} per {units.find(u => u.id === (products.find(p => p.id === ln.productId)?.unitId))?.label || 'base unit'}.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </GlassCard>
              );
            })}

            <Pressable
              onPress={() => {
                const newLn = newLine();
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setLines((prev) => [...prev, newLn]);
                setExpandedLines((prev) => new Set([...prev, newLn.id]));
              }}
              style={styles.secondary}>
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
                <Text style={styles.primaryText}>Record purchase</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, paddingBottom: 28 },
  head: { paddingHorizontal: 20, paddingBottom: 8 },
  title: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  titleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  badge: {
    backgroundColor: palette.emerald,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.5)',
  },
  badgeText: {
    color: palette.onAccent,
    fontSize: 14,
    fontWeight: '900',
  },
  sub: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    maxWidth: 360,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  center: { flex: 1, alignItems: 'center' },
  cardTitle: { color: palette.text, fontSize: 16, fontWeight: '900' },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  chipOn: {
    borderColor: palette.chipSelectedBorder,
    backgroundColor: palette.chipSelectedFill,
  },
  chipText: { color: palette.textMuted, fontWeight: '800', fontSize: 13 },
  chipTextOn: { color: palette.text },
  lineCard: {},
  lineHead: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 4, 
  },
  lineHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow: { color: palette.textMuted, fontSize: 13, fontWeight: '900', width: 14 },
  lineContent: { marginTop: 4 },
  remove: { 
    color: palette.rose, 
    fontWeight: '900', 
    fontSize: 18,
    paddingHorizontal: 4,
  },
  secondary: { alignSelf: 'flex-start', paddingVertical: 12 },
  secondaryText: { color: palette.emerald, fontWeight: '900', fontSize: 14 },
  primary: {
    marginTop: 6,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: palette.emerald,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryPressed: { backgroundColor: palette.emeraldDeep },
  primaryText: { color: palette.onAccent, fontWeight: '900', fontSize: 15 },
  qtyUnitRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  qtyCol: { flex: 0.6 },
  unitCol: { flex: 0.4 },
  lineSummary: {
    marginTop: 12,
    padding: 10,
    backgroundColor: 'rgba(13,27,17,0.03)',
    borderRadius: radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: palette.emerald,
  },
  lineSummaryText: { fontSize: 13, fontWeight: '700', color: palette.text },
  lineSummaryVal: { color: palette.emeraldDeep, fontWeight: '900' },
  lineSummaryNote: { fontSize: 10, fontWeight: '600', color: palette.textMuted, marginTop: 4, fontStyle: 'italic' },
});
