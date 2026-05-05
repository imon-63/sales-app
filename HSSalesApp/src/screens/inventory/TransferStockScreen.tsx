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

type LineDraft = { id: string; productId: string; quantity: string; unitId: string };

function newLine(pid: string = '', unitId: string = ''): LineDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: pid,
    quantity: '1',
    unitId,
  };
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function TransferStockScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { menuModal, openMenu } = useAppSideMenu();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);
  const { products, warehouses, units, lots, status: dataStatus } = useAppSelector((s) => s.salesData);
  const stockRows = useAppSelector((s) => s.inventory.stockRows);
  
  const [search, setSearch] = useState(''); // Not used but for UI consistency if needed
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [transferDate, setTransferDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [busy, setBusy] = useState(false);

  const fromOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.name })),
    [warehouses],
  );

  const toOptions = useMemo(
    () => warehouses.filter(w => w.id !== fromId).map((w) => ({ value: w.id, label: w.name })),
    [warehouses, fromId],
  );

  const productOptions = useMemo(() => {
    if (!fromId) return [];
    
    const availableProductIds = new Set(
      stockRows
        .filter((r) => r.warehouseId === fromId && r.quantityOnHand > 0)
        .map((r) => r.productId)
    );

    return products
      .filter((p) => availableProductIds.has(p.id))
      .map((p) => ({ value: p.id, label: p.name }));
  }, [products, stockRows, fromId]);

  React.useEffect(() => {
    // When the source warehouse changes, always force the user to re-select the destination.
    if (fromId) {
      setToId('');
    }
  }, [fromId]);

  React.useEffect(() => {
    if (token) {
      dispatch(fetchInventoryStock());
    }
  }, [dispatch, token]);

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
    if (!token || role !== 'admin' || busy || !fromId || !toId || fromId === toId) {
      return false;
    }
    for (const ln of lines) {
      const q = Number(ln.quantity);
      if (!ln.productId || !Number.isFinite(q) || q <= 0) return false;

      // Validate against physical stock
      const p = products.find((x) => x.id === ln.productId);
      const u = units.find((x) => x.id === ln.unitId);
      const factory = u?.globalFactor ?? p?.conversions?.[u?.id || ''] ?? 1;
      const requestedBase = q * factory;

      const avail = stockRows
        .filter((r) => r.warehouseId === fromId && r.productId === ln.productId)
        .reduce((sum, r) => sum + r.quantityOnHand, 0);

      if (requestedBase > avail) return false;
    }
    return true;
  }, [token, role, busy, fromId, toId, lines, stockRows, products, units]);

  async function onSubmit() {
    if (!token || !canSubmit) return;
    try {
      setBusy(true);
      await inventoryApi.createTransfer(
        {
          fromWarehouseId: fromId,
          toWarehouseId: toId,
          transferDate: /^\d{4}-\d{2}-\d{2}$/.test(transferDate) ? transferDate : undefined,
          lines: lines.map((ln) => {
            const p = products.find((x) => x.id === ln.productId);
            const u = units.find((x) => x.id === ln.unitId);
            const factory = u?.globalFactor ?? p?.conversions?.[u?.id || ''] ?? 1;
            return {
              productId: ln.productId,
              quantity: Number(ln.quantity) * factory,
            };
          }),
        },
        token,
      );
      await dispatch(fetchInventoryStock()).unwrap();
      dispatch(showToast({
        title: 'Transferred',
        message: 'FIFO move applied. Check Stock room.',
        type: 'success'
      }));
      setLines([newLine()]);
      setTransferDate(new Date().toISOString().slice(0, 10));
    } catch (e: any) {
      dispatch(showToast({
        title: 'Could not transfer',
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
            <Text style={styles.title}>Move stock</Text>
            <Text style={styles.sub}>Only administrators can run warehouse transfers.</Text>
          </View>
        </SafeAreaView>
      </MeshBackground>
    );
  }

  if (warehouses.length < 2) {
    return (
      <MeshBackground>
        <StackBackButton />
        <AppMenuButton onPress={openMenu} />
        {menuModal}
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={[styles.head, { paddingTop: insets.top + 52 }]}>
            <Text style={styles.title}>Move stock</Text>
            <Text style={styles.sub}>Seed at least two warehouses in db.json to use transfers.</Text>
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
            <Text style={styles.title}>Move stock</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{lines.length}</Text>
            </View>
          </View>
          <Text style={styles.sub}>
            Pulls FIFO from source batches and lands a new lot on the destination.
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
                label="From warehouse"
                value={fromId}
                options={fromOptions}
                onChange={setFromId}
                placeholder="Select source"
              />

              <View style={styles.gap} />
              
              <SelectMenu
                label="To warehouse"
                value={toId}
                options={toOptions}
                onChange={setToId}
                placeholder="Select destination"
              />

              <Text style={[styles.label, styles.labelSpaced]}>Transfer date</Text>
              <TextInput
                value={transferDate}
                onChangeText={setTransferDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
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

                      {ln.productId ? (
                        <View style={styles.stockHintWrap}>
                          {stockRows
                            .filter(r => r.warehouseId === fromId && r.productId === ln.productId && r.quantityOnHand > 0)
                            .map((r, i) => {
                              const lot = lots?.find(l => l.id === r.batchLotId);
                              const mt = (r.quantityOnHand / 1000).toFixed(3).replace(/\.?0+$/, '');
                              return (
                                <Text key={r.id || i} style={styles.stockHintText}>
                                  ✓ Available: {r.quantityOnHand} KG ({mt} MT) {lot ? `(Lot ${lot.lotNumber})` : ''}
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
                <Text style={styles.primaryText}>Run transfer</Text>
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
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  badgeText: {
    color: palette.onAccent,
    fontSize: 14,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 230, 118, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
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
  gap: { marginTop: 16 },
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
  chipOnAlt: {
    borderColor: palette.chipAltBorder,
    backgroundColor: palette.chipAltFill,
  },
  chipText: { color: palette.textMuted, fontWeight: '800', fontSize: 13 },
  chipTextOn: { color: palette.text },
  chipTextAlt: { color: palette.text },
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
  qtyUnitRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  qtyCol: { flex: 1 },
  unitCol: { flex: 1 },
  stockHintWrap: {
    paddingHorizontal: 4,
    paddingTop: 6,
    gap: 2,
  },
  stockHintText: {
    color: palette.emeraldDeep,
    fontSize: 12,
    fontWeight: '800',
  },
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
});
