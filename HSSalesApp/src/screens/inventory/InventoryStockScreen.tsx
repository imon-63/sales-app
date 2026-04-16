import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMenuButton } from '../../components/navigation/AppMenuButton';
import { StackBackButton } from '../../components/navigation/StackBackButton';
import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { useAppSideMenu } from '../../navigation/useAppSideMenu';
import type { StockRow } from '../../types/models';
import { palette } from '../../theme/designSystem';

type Section = { title: string; data: StockRow[] };

export function InventoryStockScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const token = useAppSelector((s) => s.auth.token);
  const { stockRows, status, error } = useAppSelector((s) => s.inventory);
  const { menuModal, openMenu } = useAppSideMenu();

  useFocusEffect(
    useCallback(() => {
      if (token) {
        dispatch(fetchInventoryStock());
      }
    }, [dispatch, token]),
  );

  const sections: Section[] = useMemo(() => {
    const byWh = new Map<string, StockRow[]>();
    for (const r of stockRows) {
      const list = byWh.get(r.warehouseName) ?? [];
      list.push(r);
      byWh.set(r.warehouseName, list);
    }
    return Array.from(byWh.entries()).map(([title, data]) => ({
      title,
      data: data.sort((a, b) => a.productName.localeCompare(b.productName)),
    }));
  }, [stockRows]);

  return (
    <MeshBackground>
      <StackBackButton />
      <AppMenuButton onPress={openMenu} />
      {menuModal}
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.head, { paddingTop: insets.top + 52 }]}>
          <Text style={styles.title}>Stock room</Text>
          <Text style={styles.sub}>
            Live on-hand from lot batches — same numbers your POS deductions should respect.
          </Text>
        </View>

        {status === 'loading' && stockRows.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.emerald} />
            <Text style={styles.hint}>Syncing inventory…</Text>
          </View>
        ) : status === 'failed' ? (
          <View style={styles.center}>
            <Text style={styles.err}>{error}</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => `${item.productId}-${item.warehouseId}`}
            contentContainerStyle={styles.list}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={styles.section}>{title}</Text>
            )}
            renderItem={({ item }) => (
              <GlassCard style={styles.card}>
                <Text style={styles.pname}>{item.productName}</Text>
                <Text style={styles.pmeta}>
                  {item.quantityOnHand.toLocaleString()} {item.unit || 'units'}
                </Text>
              </GlassCard>
            )}
            ListEmptyComponent={
              <GlassCard>
                <Text style={styles.emptyTitle}>No batches</Text>
                <Text style={styles.emptyBody}>
                  Receive stock (admin) or seed data to see balances here.
                </Text>
              </GlassCard>
            }
            stickySectionHeadersEnabled={false}
          />
        )}
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingBottom: 28 },
  head: { paddingHorizontal: 20, paddingBottom: 12 },
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
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  section: {
    marginTop: 14,
    marginBottom: 8,
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: { marginBottom: 10, paddingVertical: 6 },
  pname: { color: palette.text, fontSize: 16, fontWeight: '900' },
  pmeta: { marginTop: 6, color: palette.emerald, fontSize: 14, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { marginTop: 10, color: palette.textMuted, fontWeight: '600' },
  err: { color: palette.danger, fontWeight: '700', textAlign: 'center' },
  emptyTitle: { color: palette.text, fontSize: 16, fontWeight: '900' },
  emptyBody: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
