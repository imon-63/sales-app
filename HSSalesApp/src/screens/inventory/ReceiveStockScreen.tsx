import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import * as inventoryApi from '../../api/inventory';
import { AppMenuButton } from '../../components/navigation/AppMenuButton';
import { StackBackButton } from '../../components/navigation/StackBackButton';
import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { useAppSideMenu } from '../../navigation/useAppSideMenu';
import { palette, radii } from '../../theme/designSystem';

type LineDraft = {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
};

function newLine(pid: string): LineDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: pid,
    quantity: '1',
    unitCost: '',
  };
}

export function ReceiveStockScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { menuModal, openMenu } = useAppSideMenu();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);
  const { products, warehouses, status: dataStatus } = useAppSelector((s) => s.salesData);

  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [purchaseDate, setPurchaseDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(() =>
    products[0] ? [newLine(products[0].id)] : [],
  );
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!warehouseId && warehouses[0]) setWarehouseId(warehouses[0].id);
  }, [warehouseId, warehouses]);

  React.useEffect(() => {
    if (lines.length === 0 && products[0]) setLines([newLine(products[0].id)]);
  }, [lines.length, products]);

  const canSubmit = useMemo(() => {
    if (!token || role !== 'admin' || busy || !warehouseId || lines.length === 0) {
      return false;
    }
    for (const ln of lines) {
      const q = Number(ln.quantity);
      const c = Number(ln.unitCost);
      if (!ln.productId || !Number.isFinite(q) || q <= 0) return false;
      if (!Number.isFinite(c) || c < 0) return false;
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
          })),
        },
        token,
      );
      await dispatch(fetchInventoryStock()).unwrap();
      Alert.alert('Received', 'Purchase recorded. Stock room reflects new lots.');
      setNotes('');
      setLines(products[0] ? [newLine(products[0].id)] : []);
      setPurchaseDate(new Date().toISOString().slice(0, 10));
    } catch (e: any) {
      Alert.alert('Could not receive', e?.message ?? 'Unknown error');
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
        <View style={[styles.head, { paddingTop: insets.top + 52 }]}>
          <Text style={styles.title}>Receive stock</Text>
          <Text style={styles.sub}>
            Creates purchase rows, new lots, and warehouse batches — JSON Server demo path.
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
              <Text style={styles.cardTitle}>Destination warehouse</Text>
              <View style={styles.chips}>
                {warehouses.map((w) => (
                  <Pressable
                    key={w.id}
                    onPress={() => setWarehouseId(w.id)}
                    style={[styles.chip, warehouseId === w.id ? styles.chipOn : null]}>
                    <Text
                      style={[
                        styles.chipText,
                        warehouseId === w.id ? styles.chipTextOn : null,
                      ]}>
                      {w.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

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

            {lines.map((ln, idx) => (
              <GlassCard key={ln.id} style={styles.lineCard}>
                <View style={styles.lineHead}>
                  <Text style={styles.cardTitle}>Line {idx + 1}</Text>
                  {lines.length > 1 ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() => setLines((prev) => prev.filter((x) => x.id !== ln.id))}>
                      <Text style={styles.remove}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.label}>Product</Text>
                <View style={styles.chips}>
                  {products.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() =>
                        setLines((prev) =>
                          prev.map((x) => (x.id === ln.id ? { ...x, productId: p.id } : x)),
                        )
                      }
                      style={[styles.chip, ln.productId === p.id ? styles.chipOn : null]}>
                      <Text
                        style={[
                          styles.chipText,
                          ln.productId === p.id ? styles.chipTextOn : null,
                        ]}>
                        {p.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
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
                <Text style={[styles.label, styles.labelSpaced]}>Unit cost (USD)</Text>
                <TextInput
                  value={ln.unitCost}
                  onChangeText={(t) =>
                    setLines((prev) =>
                      prev.map((x) => (x.id === ln.id ? { ...x, unitCost: t } : x)),
                    )
                  }
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </GlassCard>
            ))}

            <Pressable
              onPress={() => {
                const pid = products[0]?.id ?? '';
                if (pid) setLines((prev) => [...prev, newLine(pid)]);
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
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
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
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  remove: { color: palette.rose, fontWeight: '800', fontSize: 13 },
  secondary: { alignSelf: 'flex-start', paddingVertical: 8 },
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
});
