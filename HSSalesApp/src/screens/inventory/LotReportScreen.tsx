import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAppSelector } from '../../store/hooks';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';
import type { MainStackParamList } from '../../navigation/mainStackTypes';

type LotReportRouteProp = RouteProp<MainStackParamList, 'LotReport'>;

export function LotReportScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<LotReportRouteProp>();
  const { lotId } = route.params;

  const tabBottomPad = useTabScreenBottomPadding();
  const { 
    lots, 
    lotBatches, 
    salesItemAllocations, 
    salesItems, 
    sales, 
    products, 
    warehouses,
    inventoryTransfers,
    inventoryTransferLines
  } = useAppSelector((s) => s.salesData);

  const lot = useMemo(() => lots.find((l) => l.id === lotId), [lots, lotId]);
  const product = useMemo(() => products.find((p) => p.id === lot?.productId), [products, lot]);
  const batches = useMemo(() => lotBatches.filter((b) => b.lotId === lotId), [lotBatches, lotId]);
  
  const batchIds = useMemo(() => new Set(batches.map(b => b.id)), [batches]);
  
  const allocations = useMemo(() => 
    salesItemAllocations.filter((a) => batchIds.has(a.lotBatchId)),
    [salesItemAllocations, batchIds]
  );

  // Financial aggregates
  const totalQuantityProduced = useMemo(() => 
    batches.reduce((acc, b) => acc + b.originalQuantity, 0),
    [batches]
  );

  const costOfSoldUnits = useMemo(() => {
    // Each allocation captures the unit cost at the time of sale
    return allocations.reduce((acc, a) => acc + (a.quantityAllocated * a.unitCostAtTime), 0);
  }, [allocations]);

  const realizedRevenue = useMemo(
    () =>
      allocations.reduce((acc, a) => {
        const item = salesItems.find((it) => it.id === a.salesItemId);
        if (!item) return acc;
        return acc + a.quantityAllocated * Number(item.unitPrice);
      }, 0),
    [allocations, salesItems],
  );

  const netProfit = realizedRevenue - costOfSoldUnits;
  const marginPct = realizedRevenue > 0 ? (netProfit / realizedRevenue) * 100 : 0;

  const remainingValueAtCost = useMemo(
    () => batches.reduce((acc, b) => acc + Number(b.remainingQuantity) * Number(b.unitCost), 0),
    [batches],
  );

  // History mapping
  const salesHistory = useMemo(() => {
    const historical: { saleId: string; date: string; qty: number; price: number; subtotal: number }[] = [];
    
    allocations.forEach(a => {
      const item = salesItems.find(it => it.id === a.salesItemId);
      const sale = sales.find(s => s.id === item?.saleId);
      if (item && sale) {
        historical.push({
          saleId: sale.id,
          date: sale.saleDate,
          qty: a.quantityAllocated,
          price: item.unitPrice,
          subtotal: a.quantityAllocated * item.unitPrice
        });
      }
    });

    return historical.sort((a, b) => b.date.localeCompare(a.date));
  }, [allocations, salesItems, sales]);

  if (!lot) {
    return (
      <MeshBackground>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <ScreenHeader title="Not found" subtitle="Lot missing." />
        </SafeAreaView>
      </MeshBackground>
    );
  }

  return (
    <MeshBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Lot" subtitle={lot.lotNumber} tag="Report" />

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: tabBottomPad + 40 }]}
          showsVerticalScrollIndicator={false}>
          
          <GlassCard accentColor={palette.emerald}>
            <Text style={styles.sectionLabel}>Product Info</Text>
            <Text style={styles.prodName}>{product?.name || 'Unknown'}</Text>
            <Text style={styles.prodMeta}>Lot ID: {lotId}</Text>
            <View style={styles.badgeRow}>
               <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>Batches</Text>
                  <Text style={styles.badgeValue}>{batches.length}</Text>
               </View>
               <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>Total Yield</Text>
                  <Text style={styles.badgeValue}>{totalQuantityProduced.toLocaleString()}</Text>
               </View>
            </View>
          </GlassCard>

          <View style={styles.badgeRow}>
            {batches.map((b) => {
              const wh = warehouses.find((w) => w.id === b.warehouseId);
              return (
                <View key={b.id} style={[styles.badge, { flex: 0, minWidth: '45%' }]}>
                  <Text style={styles.badgeLabel}>{wh?.name || 'Warehouse'}</Text>
                  <Text style={styles.badgeValue}>
                    {Number(b.remainingQuantity).toLocaleString()} / {Number(b.originalQuantity).toLocaleString()} units
                  </Text>
                </View>
              );
            })}
          </View>

          <GlassCard style={styles.spacedCard} accentColor={netProfit >= 0 ? palette.success : palette.rose}>
            <Text style={styles.sectionLabel}>Lifecycle Performance Summary</Text>
            
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Realized Revenue</Text>
                <Text style={styles.summaryVal}>BDT {realizedRevenue.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Cost of Units Sold</Text>
                <Text style={styles.summaryVal}>BDT {costOfSoldUnits.toLocaleString()}</Text>
              </View>
            </View>

            <View style={[styles.profitBox, { backgroundColor: netProfit >= 0 ? 'rgba(107, 142, 120, 0.1)' : 'rgba(217, 115, 106, 0.1)' }]}>
              <Text style={styles.profitTitle}>Total Realized Profit</Text>
              <Text style={[styles.profitMain, { color: netProfit >= 0 ? palette.success : palette.rose }]}>
                BDT {netProfit.toLocaleString()}
              </Text>
              <View style={[styles.marginPill, { backgroundColor: netProfit >= 0 ? palette.success : palette.rose }]}>
                <Text style={styles.marginText}>{marginPct.toFixed(1)}% Realized Margin</Text>
              </View>
            </View>

            <View style={styles.unrealizedRow}>
               <Text style={styles.unrealizedLabel}>Current stock value (at cost):</Text>
               <Text style={styles.unrealizedVal}>BDT {remainingValueAtCost.toLocaleString()}</Text>
            </View>
          </GlassCard>

          <Text style={styles.listTitle}>Inventory Movements</Text>
          {(() => {
            const lotTransfers = inventoryTransferLines
              .filter(l => l.lotId === lotId)
              .map(l => {
                const head = inventoryTransfers.find(h => h.id === l.transferId);
                return { ...l, head };
              })
              .sort((a, b) => String(b.head?.transferDate).localeCompare(String(a.head?.transferDate)));

            if (lotTransfers.length === 0) {
              return (
                <GlassCard>
                  <Text style={styles.empty}>No internal movements for this lot.</Text>
                </GlassCard>
              );
            }

            return lotTransfers.map((tr) => (
              <GlassCard key={tr.id} style={styles.historyCard}>
                <View style={styles.shRow}>
                  <Text style={styles.shDate}>{tr.head?.transferDate}</Text>
                  <Text style={[styles.shTotal, { color: palette.emeraldDeep }]}>Moved {tr.quantity.toLocaleString()}</Text>
                </View>
                <Text style={styles.shDetail}>
                  From {warehouses.find(w => w.id === tr.head?.fromWarehouseId)?.name} ⮕ {warehouses.find(w => w.id === tr.head?.toWarehouseId)?.name}
                </Text>
                {!!tr.head?.notes && <Text style={styles.transferNotes}>"{tr.head.notes}"</Text>}
              </GlassCard>
            ));
          })()}

          <Text style={styles.listTitle}>Sales History</Text>
          {salesHistory.length === 0 ? (
            <GlassCard>
              <Text style={styles.empty}>No sales recorded for this lot yet.</Text>
            </GlassCard>
          ) : (
            salesHistory.map((sh, idx) => {
              const saleProfit = (sh.qty * sh.price) - (sh.qty * (lotBatches[0]?.unitCost || 0));
              return (
              <Pressable 
                key={`${sh.saleId}-${idx}`} 
                onPress={() => navigation.navigate('SaleDetails', { saleId: sh.saleId })}>
                <GlassCard style={styles.historyCard}>
                  <View style={styles.shRow}>
                    <Text style={styles.shDate}>{sh.date}</Text>
                    <Text style={styles.shTotal}>Sell Value: BDT {sh.subtotal.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.shDetail}>
                    Sold {sh.qty.toLocaleString()} units @ BDT {sh.price.toLocaleString()}
                  </Text>
                  <View style={styles.inlineProfit}>
                    <Text style={styles.inlineProfitLabel}>Contribution:</Text>
                    <Text style={[styles.inlineProfitVal, { color: saleProfit >= 0 ? palette.success : palette.rose }]}>
                      {saleProfit >= 0 ? '+' : ''}BDT {saleProfit.toLocaleString()}
                    </Text>
                  </View>
                </GlassCard>
              </Pressable>
              );
            })
          )}

          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.dismiss}>
            <Text style={styles.dismissText}>Close Report</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 6, gap: 14 },
  sectionLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 12 },
  prodName: { color: palette.text, fontSize: 20, fontWeight: '900' },
  prodMeta: { color: palette.textMuted, fontSize: 13, fontWeight: '600', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 14, marginTop: 16 },
  badge: { flex: 1, backgroundColor: 'rgba(13,27,17,0.04)', padding: 10, borderRadius: radii.md },
  badgeLabel: { fontSize: 10, fontWeight: '700', color: palette.textMuted, textTransform: 'uppercase' },
  badgeValue: { fontSize: 15, fontWeight: '900', color: palette.text, marginTop: 2 },
  spacedCard: { marginTop: 4 },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: palette.stroke },
  summaryItem: { flex: 1 },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: palette.textMuted },
  summaryVal: { fontSize: 16, fontWeight: '800', color: palette.text, marginTop: 4 },
  profitBox: { marginTop: 16, padding: 16, borderRadius: radii.md, alignItems: 'center' },
  profitTitle: { fontSize: 12, fontWeight: '800', color: palette.textMuted, textTransform: 'uppercase' },
  profitMain: { fontSize: 28, fontWeight: '900', marginVertical: 8 },
  marginPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.xl },
  marginText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  listTitle: { marginTop: 12, fontSize: 16, fontWeight: '900', color: palette.text },
  empty: { color: palette.textMuted, fontWeight: '600', fontStyle: 'italic' },
  historyCard: { paddingVertical: 12 },
  shRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shDate: { fontSize: 14, fontWeight: '800', color: palette.text },
  shTotal: { fontSize: 14, fontWeight: '800', color: palette.text },
  shDetail: { marginTop: 4, fontSize: 12, fontWeight: '600', color: palette.textMuted },
  unrealizedRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 14, 
    paddingTop: 10, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(0,0,0,0.05)' 
  },
  unrealizedLabel: { fontSize: 11, fontWeight: '700', color: palette.textMuted },
  unrealizedVal: { fontSize: 12, fontWeight: '800', color: palette.text },
  inlineProfit: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  inlineProfitLabel: { fontSize: 11, fontWeight: '700', color: palette.textMuted },
  inlineProfitVal: { fontSize: 12, fontWeight: '800' },
  transferNotes: { marginTop: 6, fontSize: 11, fontWeight: '600', fontStyle: 'italic', color: palette.textMuted, opacity: 0.8 },
  dismiss: { marginTop: 10, padding: 16, borderRadius: radii.lg, backgroundColor: 'rgba(13,27,17,0.04)', alignItems: 'center', borderWidth: 1, borderColor: palette.stroke },
  dismissText: { color: palette.text, fontWeight: '900', fontSize: 15 },
});
