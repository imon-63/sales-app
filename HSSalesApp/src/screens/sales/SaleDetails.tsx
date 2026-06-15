import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { unitLabelForProduct } from '../../utils/sales';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  InteractionManager,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import RNPrint from 'react-native-print';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useT } from '../../i18n/useT';
import { useAppSelector } from '../../store/hooks';
import { useAppDispatch } from '../../store/hooks';
import { fetchSalesDataset } from '../../store/slices/salesDataSlice';
import * as salesApi from '../../api/sales';
import { showToast } from '../../store/slices/uiSlice';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';
import type { MainStackParamList } from '../../navigation/mainStackTypes';
import {
  buildSalePrintDocument,
  buildSalePrintHtml,
  type SalePrintAudience,
  type SalePrintFulfillmentLine,
  type SalePrintInput,
  type SalePrintItem,
} from '../../utils/salePrint';

type DetailsRouteProp = RouteProp<MainStackParamList, 'SaleDetails'>;

/** Off-screen translateY so the print drawer starts fully above the viewport. */
const PRINT_DRAWER_HIDDEN_Y = -340;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function SaleDetails() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<DetailsRouteProp>();
  const { saleId, productId, lotBatchId } = route.params;

  const tabBottomPad = useTabScreenBottomPadding();
  const [printDrawerVisible, setPrintDrawerVisible] = useState(false);
  const [adminInfoExpanded, setAdminInfoExpanded] = useState(false);
  const printDrawerY = useRef(new Animated.Value(PRINT_DRAWER_HIDDEN_Y)).current;
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((s) => s.auth.user);
  const token = useAppSelector((s) => s.auth.token ?? '');
  const locale = useAppSelector((s) => s.ui.locale);
  const { sales, salesItems, products, warehouses, users, salesItemAllocations, lots, lotBatches, units, salePayments } = useAppSelector(
    (s) => s.salesData,
  );
  const { orders, orderPayments } = useAppSelector((s) => s.orders);

  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  const sale = useMemo(() => sales.find((s) => s.id === saleId), [sales, saleId]);

  // Build merged payment list with source labels.
  // For order-linked sales: show ONLY orderPayments + advance — Fix 2b mirrors every
  // addSalePayment into orderPayments, so all payments are captured there without duplication.
  // For direct sales: show salePayments.
  type MergedPayment = {
    id: string; amount: number; date: string;
    collectedByName?: string; notes?: string;
    source: 'order' | 'sale';
  };
  const mergedPayments = useMemo<MergedPayment[]>(() => {
    const rows: MergedPayment[] = [];

    if (sale?.orderId) {
      const linkedOrder = orders.find((o) => o.id === sale.orderId);

      // advance paid at order creation
      if (linkedOrder && Number(linkedOrder.advancePaid) > 0) {
        rows.push({
          id: `advance-${sale.orderId}`,
          amount: Number(linkedOrder.advancePaid),
          date: linkedOrder.orderDate ?? '',
          notes: 'Advance at order',
          source: 'order',
        });
      }

      // all order payment instalments (non-refund) — covers both payments taken in the
      // order flow AND payments added from SaleDetails (Fix 2b mirrors them here)
      orderPayments
        .filter((p) => p.orderId === sale.orderId && p.type !== 'refund')
        .forEach((p) => {
          rows.push({
            id: p.id,
            amount: Number(p.amount),
            date: p.paidAt ?? '',
            collectedByName: users.find((u) => u.id === p.recordedBy)?.name,
            notes: p.notes || undefined,
            source: 'order',
          });
        });
    } else {
      // non-order sale — plain salePayments
      salePayments
        .filter((p) => p.saleId === saleId)
        .forEach((p) => {
          rows.push({
            id: p.id,
            amount: Number(p.amount),
            date: p.paidAt ?? '',
            collectedByName: p.collectedByName || users.find((u) => u.id === p.collectedBy)?.name,
            notes: p.notes || undefined,
            source: 'sale',
          });
        });
    }

    return rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [sale, orders, orderPayments, salePayments, saleId, users]);

  async function handleAddPayment() {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      Alert.alert(locale === 'bn' ? 'পেমেন্ট' : 'Payment', locale === 'bn' ? 'সঠিক পরিমাণ দিন' : 'Enter a valid amount');
      return;
    }
    setPayBusy(true);
    try {
      await salesApi.addSalePayment({ saleId, amount: amt, notes: payNotes.trim() || undefined }, token);
      dispatch(showToast({ title: locale === 'bn' ? 'পেমেন্ট' : 'Payment', message: `${amt.toLocaleString()} ${locale === 'bn' ? 'সংগ্রহ হয়েছে' : 'collected'}`, type: 'success' }));
      setPayAmount('');
      setPayNotes('');
      await dispatch(fetchSalesDataset()).unwrap();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to record payment.');
    } finally {
      setPayBusy(false);
    }
  }

  const items = useMemo(
    () => salesItems.filter((it) => it.saleId === saleId && (!productId || it.productId === productId)),
    [salesItems, saleId, productId],
  );

  const warehouse = useMemo(
    () => warehouses.find((w) => w.id === sale?.warehouseId),
    [warehouses, sale],
  );

  const seller = useMemo(
    () => users.find((u) => u.id === sale?.createdBy),
    [users, sale],
  );

  // When navigated from a specific lot batch, show only that batch's portion
  const totalRevenue = useMemo(() => {
    return items.reduce((acc, it) => {
      if (lotBatchId) {
        const alloc = salesItemAllocations.find((a) => a.salesItemId === it.id && a.lotBatchId === lotBatchId);
        return acc + (alloc ? Number(alloc.quantityAllocated) * Number(it.unitPrice) : 0);
      }
      return acc + Number(it.quantity) * Number(it.unitPrice);
    }, 0);
  }, [items, salesItemAllocations, lotBatchId]);

  const totalCost = useMemo(() => {
    return items.reduce((acc, it) => {
      const itemAllocations = salesItemAllocations.filter(
        (a) => a.salesItemId === it.id && (!lotBatchId || a.lotBatchId === lotBatchId),
      );
      const itemCost = itemAllocations.reduce(
        (iAcc, a) => iAcc + a.quantityAllocated * a.unitCostAtTime,
        0,
      );
      return acc + itemCost;
    }, 0);
  }, [items, salesItemAllocations, lotBatchId]);

  // Proportional paid: when viewing from a specific lot, split by this lot's revenue share
  const totalPaid = useMemo(() => {
    const fullPaid = Number(sale?.paidAmount) || 0;
    if (!lotBatchId) return fullPaid;
    const fullSaleTotal = Number(sale?.totalAmount) || 0;
    return fullSaleTotal > 0 ? fullPaid * (totalRevenue / fullSaleTotal) : 0;
  }, [sale, lotBatchId, totalRevenue]);

  const saleExtraCost = Number(sale?.extraCost) || 0;
  const totalProfit = totalRevenue - totalCost - saleExtraCost;
  const marginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const composePrintInput = useCallback(
    (audience: SalePrintAudience): SalePrintInput => {
      if (!sale) {
        throw new Error('Sale missing');
      }
      const printItems: SalePrintItem[] = items.map((it) => {
        const prod = products.find((p) => p.id === it.productId);
        const subtotal = Number(it.quantity) * Number(it.unitPrice);
        const allocations = salesItemAllocations
          .filter((a) => a.salesItemId === it.id)
          .map((a) => {
            const batch = lotBatches.find((b) => b.id === a.lotBatchId);
            const lot = lots.find((l) => l.id === batch?.lotId);
            const wh = warehouses.find((w) => w.id === batch?.warehouseId);
            return {
              ...a,
              lotNumber: lot?.lotNumber || 'Unknown',
              warehouseName: wh?.name || 'Unknown',
            };
          });

        const itemCost = allocations.reduce(
          (acc, a) => acc + a.quantityAllocated * a.unitCostAtTime,
          0,
        );
        const itemProfit = subtotal - itemCost;
        const itemMarginPct = subtotal > 0 ? (itemProfit / subtotal) * 100 : 0;

        let fulfillments: SalePrintFulfillmentLine[] | undefined;
        if (audience === 'admin' && allocations.length > 0) {
          fulfillments = allocations.map((a) => {
            const sellValue = a.quantityAllocated * Number(it.unitPrice);
            const costPrice = a.quantityAllocated * a.unitCostAtTime;
            const profit = sellValue - costPrice;
            return {
              lotNumber: a.lotNumber,
              warehouseName: a.warehouseName,
              textLines: [
                `Sell value: ${a.quantityAllocated.toLocaleString()} × ${Number(it.unitPrice).toLocaleString()} ৳ = ${sellValue.toLocaleString()} ৳`,
                `Cost: ${a.quantityAllocated.toLocaleString()} × ${Number(a.unitCostAtTime).toLocaleString()} ৳ = ${costPrice.toLocaleString()} ৳`,
                `P/L: ${profit.toLocaleString()} ৳`,
              ],
            };
          });
        }

        return {
          productName: prod?.name || 'Unknown product',
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          subtotal,
          itemMarginPct: audience === 'admin' ? itemMarginPct : undefined,
          fulfillments,
        };
      });

      return {
        audience,
        saleId: sale.id,
        saleDate: sale.saleDate,
        warehouseName: warehouse?.name || 'Unknown',
        salesPerson: seller
          ? { name: seller.name, email: seller.email, phone: seller.phone }
          : null,
        notes: sale.notes,
        items: printItems,
        totalRevenue,
        totalCost: audience === 'admin' ? totalCost : undefined,
        totalProfit: audience === 'admin' ? totalProfit : undefined,
        marginPct: audience === 'admin' ? marginPct : undefined,
      };
    },
    [
      sale,
      items,
      products,
      warehouse,
      seller,
      salesItemAllocations,
      lotBatches,
      lots,
      warehouses,
      totalRevenue,
      totalCost,
      totalProfit,
      marginPct,
    ],
  );

  const executePrint = useCallback(
    async (audience: SalePrintAudience) => {
      if (!sale) return;
      let input: SalePrintInput;
      try {
        input = composePrintInput(audience);
      } catch {
        return;
      }
      // Let the print drawer finish closing before presenting print UI (avoids flash + freeze on iOS).
      await new Promise<void>((r) => setTimeout(r, 120));
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          setTimeout(resolve, 750);
        });
      });
      const html = buildSalePrintHtml(input);
      const printer = RNPrint as unknown as {
        print: (opts: { html: string; jobName?: string }) => Promise<unknown>;
      };
      try {
        await printer.print({
          html,
          jobName: `HS-Sale-${sale.saleDate}`,
        });
      } catch {
        try {
          await Share.share({
            title: `HS Sales — ${sale.saleDate}`,
            message: buildSalePrintDocument(input),
          });
        } catch {
          Alert.alert(t('saleDetails.printSheetTitle'), t('saleDetails.printFail'), [
            { text: t('common.done') },
          ]);
        }
      }
    },
    [sale, composePrintInput, t],
  );

  const animateDrawerClosed = useCallback(
    (onFinished?: () => void) => {
      Animated.timing(printDrawerY, {
        toValue: PRINT_DRAWER_HIDDEN_Y,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setPrintDrawerVisible(false);
        onFinished?.();
      });
    },
    [printDrawerY],
  );

  const openPrintDrawer = useCallback(() => {
    if (printDrawerVisible) return;
    printDrawerY.setValue(PRINT_DRAWER_HIDDEN_Y);
    setPrintDrawerVisible(true);
  }, [printDrawerVisible, printDrawerY]);

  useEffect(() => {
    if (!printDrawerVisible) return;
    Animated.spring(printDrawerY, {
      toValue: 0,
      stiffness: 420,
      damping: 32,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [printDrawerVisible, printDrawerY]);

  const onSelectPrintAudience = useCallback(
    (audience: SalePrintAudience) => {
      animateDrawerClosed(() => {
        setTimeout(() => void executePrint(audience), 0);
      });
    },
    [animateDrawerClosed, executePrint],
  );

  if (!sale) {
    return (
      <MeshBackground>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <ScreenHeader title={t('saleDetails.notFound')} />
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>{t('saleDetails.back')}</Text>
          </Pressable>
        </SafeAreaView>
      </MeshBackground>
    );
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <MeshBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader
          title={t('saleDetails.title')}
          subtitle={productId ? (products.find(p => p.id === productId)?.name ?? saleId.slice(0, 8)) : saleId.slice(0, 8)}
          tag={t('saleDetails.tag')}
          right={
            isAdmin ? (
              <Pressable
                onPress={openPrintDrawer}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('saleDetails.printA11y')}
                style={({ pressed }) => [styles.printHit, pressed ? styles.printHitPressed : null]}>
                <Text style={styles.printGlyph} allowFontScaling={false}>
                  🖨️
                </Text>
              </Pressable>
            ) : undefined
          }
        />

        <Modal
          visible={printDrawerVisible}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => animateDrawerClosed()}>
          <View style={styles.printDrawerRoot} pointerEvents="box-none">
            <Pressable style={styles.printDrawerBackdrop} onPress={() => animateDrawerClosed()} />
            <Animated.View
              style={[
                styles.printDrawerSheet,
                {
                  paddingTop: insets.top + 10,
                  transform: [{ translateY: printDrawerY }],
                },
              ]}>
              <View style={styles.printDrawerHandleRow}>
                <View style={styles.printDrawerHandle} />
              </View>
              <Text style={styles.printDrawerTitle}>{t('saleDetails.printSheetTitle')}</Text>

              <Pressable
                onPress={() => onSelectPrintAudience('customer')}
                style={({ pressed }) => [styles.printDrawerRow, pressed ? styles.printDrawerRowPressed : null]}>
                <View style={styles.printDrawerRowText}>
                  <Text style={styles.printDrawerRowTitle}>{t('saleDetails.printCustomer')}</Text>
                  <Text style={styles.printDrawerRowHint}>{t('saleDetails.printCustomerHint')}</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => onSelectPrintAudience('admin')}
                style={({ pressed }) => [styles.printDrawerRow, pressed ? styles.printDrawerRowPressed : null]}>
                <View style={styles.printDrawerRowText}>
                  <Text style={styles.printDrawerRowTitle}>{t('saleDetails.printAdmin')}</Text>
                  <Text style={styles.printDrawerRowHint}>{t('saleDetails.printAdminHint')}</Text>
                </View>
              </Pressable>

            </Animated.View>
          </View>
        </Modal>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: tabBottomPad + 40 }]}
          showsVerticalScrollIndicator={false}>

          {sale.status === 'cancelled' && (
            <View style={styles.cancelBanner}>
              <View style={styles.cancelBannerTop}>
                <View style={styles.cancelBannerBadge}>
                  <Text style={styles.cancelBannerBadgeText}>বাতিল বিক্রয়</Text>
                </View>
                {!!sale.cancelledAt && (
                  <Text style={styles.cancelBannerDate}>{sale.cancelledAt}</Text>
                )}
              </View>
              {!!sale.cancelReason && (
                <Text style={styles.cancelBannerReason}>{sale.cancelReason}</Text>
              )}
              <Text style={styles.cancelBannerNote}>
                এই বিক্রয়টি অর্ডার বাতিলের কারণে নিষ্ক্রিয় হয়েছে। ইনভেন্টরি পূর্বাবস্থায় ফিরিয়ে দেওয়া হয়েছে।
              </Text>
            </View>
          )}

          {isAdmin ? (
            <GlassCard style={styles.leftEdgeRoundCard} accentColor={palette.emeraldDeep}>
              <Pressable
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setAdminInfoExpanded((v) => !v);
                }}
                style={styles.collapsibleHead}>
                <Text style={styles.collapsibleTitle}>Overview & Sales Person</Text>
                <Text style={styles.collapsibleChevron}>{adminInfoExpanded ? '▾' : '▸'}</Text>
              </Pressable>

              {adminInfoExpanded ? (
                <>
                  <View style={styles.row}>
                    <Text style={styles.field}>Date</Text>
                    <Text style={styles.value}>{sale.saleDate}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.field}>Warehouse</Text>
                    <Text style={styles.value}>{warehouse?.name || 'Unknown'}</Text>
                  </View>
                  {!!sale.notes && (
                    <View style={styles.notesBox}>
                      <Text style={styles.field}>Notes</Text>
                      <Text style={styles.notesText}>{sale.notes}</Text>
                    </View>
                  )}

                  <View style={styles.sectionDivider} />
                  <Text style={styles.subSectionLabel}>Sales Person</Text>
                  <Text style={styles.sellerName}>{seller?.name || 'Unknown'}</Text>
                  {!!seller?.phone && <Text style={styles.sellerPhone}>{seller.phone}</Text>}
                  <Text style={styles.sellerEmail}>{seller?.email || '—'}</Text>
                </>
              ) : null}
            </GlassCard>
          ) : (
            <GlassCard style={styles.leftEdgeRoundCard} accentColor={palette.emerald}>
              <Text style={styles.sectionLabel}>Overview</Text>
              <View style={styles.row}>
                <Text style={styles.field}>Date</Text>
                <Text style={styles.value}>{sale.saleDate}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.field}>Warehouse</Text>
                <Text style={styles.value}>{warehouse?.name || 'Unknown'}</Text>
              </View>
              {!!sale.notes && (
                <View style={styles.notesBox}>
                  <Text style={styles.field}>Notes</Text>
                  <Text style={styles.notesText}>{sale.notes}</Text>
                </View>
              )}
            </GlassCard>
          )}

          {isAdmin && (
            <GlassCard
              style={[styles.leftEdgeRoundCard, styles.performanceCard]}
              accentColor={totalProfit >= 0 ? palette.success : palette.rose}>
               <Text style={styles.sectionLabel}>Transaction P&L Scorecard</Text>
               <View style={styles.summaryGrid}>
                 <View style={styles.summaryCol}>
                   <Text style={styles.summaryLabel}>Selling Value</Text>
                   <Text style={styles.summaryNum}>৳{totalRevenue.toLocaleString()}</Text>
                 </View>
                 <View style={styles.summaryCol}>
                   <Text style={styles.summaryLabel}>Cost Investment</Text>
                   <Text style={styles.summaryNum}>৳{totalCost.toLocaleString()}</Text>
                 </View>
               </View>
               {saleExtraCost > 0 && (
                 <View style={[styles.summaryGrid, { marginTop: 4 }]}>
                   <View style={styles.summaryCol}>
                     <Text style={styles.summaryLabel}>Extra Sell Cost</Text>
                     <Text style={[styles.summaryNum, { color: '#FBBF24' }]}>− ৳{saleExtraCost.toLocaleString()}</Text>
                   </View>
                 </View>
               )}
               <View style={styles.profitHighlight}>
                 <View>
                   <Text style={styles.highlightLabel}>{totalProfit >= 0 ? 'Net Profit' : 'Net Loss'}</Text>
                   <Text style={[styles.highlightValue, { color: totalProfit >= 0 ? palette.success : palette.rose }]}>
                     ৳{totalProfit.toLocaleString()}
                   </Text>
                 </View>
                 <View style={[styles.marginPill, { backgroundColor: totalProfit >= 0 ? palette.success : palette.rose }]}>
                   <Text style={styles.marginPillText}>{marginPct.toFixed(1)}% Margin</Text>
                 </View>
               </View>
            </GlassCard>
          )}

          <Text style={styles.listHeader}>Items ({items.length})</Text>
          {items.map((it) => {
            const prod = products.find((p) => p.id === it.productId);

            // Resolve allocations — filter to specific lot batch when navigated from a lot's sales tab
            const allocations = salesItemAllocations
              .filter((a) => a.salesItemId === it.id && (!lotBatchId || a.lotBatchId === lotBatchId))
              .map((a) => {
                const batch = lotBatches.find((b) => b.id === a.lotBatchId);
                const lot = lots.find((l) => l.id === batch?.lotId);
                const wh = warehouses.find((w) => w.id === batch?.warehouseId);
                return {
                  ...a,
                  lotNumber: lot?.lotNumber || 'Unknown',
                  warehouseName: wh?.name || 'Unknown',
                };
              });

            // When viewing from a specific lot batch, compute subtotal from allocation qty only
            const displayQty = lotBatchId
              ? allocations.reduce((s, a) => s + a.quantityAllocated, 0)
              : Number(it.quantity);
            const subtotal = displayQty * Number(it.unitPrice);

            const itemCost = allocations.reduce((acc, a) => acc + (a.quantityAllocated * a.unitCostAtTime), 0);
            const itemProfit = subtotal - itemCost;
            const itemMargin = subtotal > 0 ? (itemProfit / subtotal) * 100 : 0;
            const itemProd = products.find((p) => p.id === it.productId);
            const itemUnit = itemProd ? unitLabelForProduct(itemProd, units) : 'kg';

            return (
              <GlassCard key={it.id} style={[styles.leftEdgeRoundCard, styles.itemCard]}>
                <View style={styles.itemHead}>
                  <Text style={styles.itemProd}>{prod?.name || 'Unknown Product'}</Text>
                  <Text style={styles.itemTotal}>৳{subtotal.toLocaleString()}</Text>
                </View>
                <View style={[styles.row, { marginBottom: 0, marginTop: 4 }]}>
                   <Text style={styles.itemDetail}>
                    {displayQty.toLocaleString()} × ৳{Number(it.unitPrice).toLocaleString()}
                  </Text>
                  {isAdmin && (
                    <Text style={[styles.itemMargin, itemMargin < 0 && { color: palette.rose }]}>
                      {itemMargin.toFixed(1)}% margin
                    </Text>
                  )}
                </View>

                {/* Bottle breakdown */}
                {(() => {
                  if (!it.bottleBreakdown) return null;
                  try {
                    const bd: { sizeLiter: number; count: number; bottleCost: number }[] = JSON.parse(it.bottleBreakdown);
                    if (!bd.length) return null;
                    const grandTotal = bd.reduce((s, b) => s + b.count * (b.sizeLiter * Number(it.unitPrice) + b.bottleCost), 0);
                    return (
                      <View style={[styles.fulfillmentBox, { borderColor: `${palette.violet}30` }]}>
                        <Text style={[styles.fulfillmentTitle, { color: palette.violet }]}>🍶 Bottle Breakdown</Text>
                        {bd.map((b, bi) => {
                          const perBottle = b.sizeLiter * Number(it.unitPrice) + b.bottleCost;
                          return (
                            <View key={bi} style={styles.fulfillmentRow}>
                              <Text style={[styles.fulLot, { color: palette.violet }]}>{b.sizeLiter}L × {b.count}</Text>
                              <Text style={styles.formulaLine}>
                                {b.count} × ({b.sizeLiter}L × {Number(it.unitPrice).toLocaleString()} + {b.bottleCost.toLocaleString()}) = ৳{(b.count * perBottle).toLocaleString()}
                              </Text>
                            </View>
                          );
                        })}
                        <View style={[styles.profitResult, { borderTopColor: `${palette.violet}20` }]}>
                          <Text style={[styles.profitResultLabel, { color: palette.violet }]}>Total bottle value:</Text>
                          <Text style={[styles.profitResultVal, { color: palette.violet }]}>৳{grandTotal.toLocaleString()}</Text>
                        </View>
                      </View>
                    );
                  } catch { return null; }
                })()}

                {isAdmin && allocations.length > 0 && (
                  <View style={styles.fulfillmentBox}>
                    <Text style={styles.fulfillmentTitle}>P&L Breakdown for this Sale</Text>
                    {allocations.map((a, aIdx) => {
                      const sellValue = a.quantityAllocated * Number(it.unitPrice);
                      const costPrice = a.quantityAllocated * a.unitCostAtTime;
                      const profit = sellValue - costPrice;

                      return (
                        <View key={`${a.id}-${aIdx}`} style={styles.fulfillmentRow}>
                          <View style={styles.fulLeft}>
                            <Text style={styles.fulLot}>{a.lotNumber}</Text>
                            <Text style={styles.fulWh}>{a.warehouseName}</Text>
                          </View>
                          <View style={styles.fulRight}>
                            <Text style={styles.formulaLine}>
                              Sell Value: {a.quantityAllocated.toLocaleString()} {itemUnit} × ৳{Number(it.unitPrice).toLocaleString()} = ৳{sellValue.toLocaleString()}
                            </Text>
                            <Text style={styles.formulaLine}>
                              Cost Price: {a.quantityAllocated.toLocaleString()} {itemUnit} × ৳{Number(a.unitCostAtTime).toLocaleString()} = ৳{costPrice.toLocaleString()}
                            </Text>
                            <View style={styles.profitResult}>
                              <Text style={styles.profitResultLabel}>Profit on this single sale:</Text>
                              <Text style={[styles.profitResultVal, { color: profit >= 0 ? palette.success : palette.rose }]}>
                                ৳{profit.toLocaleString()}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </GlassCard>
            );
          })}


          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total Revenue</Text>
            <Text style={styles.totalValue}>৳{totalRevenue.toLocaleString()}</Text>
          </View>

          {/* ── Payment History ── */}
          <GlassCard style={styles.payCard}>
            <View style={styles.payHeader}>
              <Text style={styles.payHeaderTitle}>{locale === 'bn' ? 'পেমেন্ট ইতিহাস' : 'Payment History'}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {totalPaid > 0 && (
                  <View style={styles.payPaidBadge}>
                    <Text style={styles.payPaidBadgeText}>✓ {totalPaid.toLocaleString()}</Text>
                  </View>
                )}
                {totalRevenue - totalPaid > 0.01 && (
                  <View style={styles.payDueBadge}>
                    <Text style={styles.payDueBadgeText}>{locale === 'bn' ? 'বাকি' : 'Due'} {(totalRevenue - totalPaid).toLocaleString()}</Text>
                  </View>
                )}
              </View>
            </View>

            {mergedPayments.length === 0 ? (
              <Text style={styles.payEmpty}>{locale === 'bn' ? 'কোনো পেমেন্ট নেই' : 'No payments recorded'}</Text>
            ) : (
              mergedPayments.map((p, i) => (
                <View key={p.id} style={[styles.payRow, i > 0 && styles.payRowBorder]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.payRowDate}>{p.date}</Text>
                    {p.collectedByName ? <Text style={styles.payRowBy}>{p.collectedByName}</Text> : null}
                    {p.notes ? <Text style={styles.payRowNote}>{p.notes}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.payRowAmt}>{p.amount.toLocaleString()}</Text>
                    <View style={[styles.paySourceBadge, p.source === 'order' ? styles.paySourceOrder : styles.paySourceSale]}>
                      <Text style={styles.paySourceText}>{p.source === 'order' ? 'Order' : 'Sale'}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}

            {sale?.status !== 'cancelled' && totalRevenue - totalPaid > 0.01 && (
              <View style={styles.payFormWrap}>
                <View style={styles.payFormDivider} />
                <Text style={styles.payFormLabel}>{locale === 'bn' ? 'পেমেন্ট যোগ করুন' : 'Add Payment'}</Text>
                <TextInput
                  style={styles.payInput}
                  value={payAmount}
                  onChangeText={setPayAmount}
                  keyboardType="numeric"
                  placeholder={locale === 'bn' ? 'পরিমাণ' : 'Amount'}
                  placeholderTextColor={palette.textMuted}
                  selectTextOnFocus
                />
                <TextInput
                  style={[styles.payInput, { marginTop: 8 }]}
                  value={payNotes}
                  onChangeText={setPayNotes}
                  placeholder={locale === 'bn' ? 'নোট (ঐচ্ছিক)' : 'Notes (optional)'}
                  placeholderTextColor={palette.textMuted}
                />
                <Pressable
                  onPress={handleAddPayment}
                  disabled={payBusy}
                  style={({ pressed }) => [styles.payBtn, pressed && { opacity: 0.85 }, payBusy && { opacity: 0.5 }]}
                >
                  {payBusy
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.payBtnText}>{locale === 'bn' ? 'সংগ্রহ করুন' : 'Confirm Payment'}</Text>
                  }
                </Pressable>
              </View>
            )}
          </GlassCard>

          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed ? { opacity: 0.85 } : null,
            ]}>
            <Text style={styles.primaryBtnText}>Dismiss</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 6, gap: 14 },
  leftEdgeRoundCard: {
    borderTopLeftRadius: 30,
    borderBottomLeftRadius: 30,
  },
  sectionLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  collapsibleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  collapsibleTitle: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  collapsibleChevron: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionDivider: {
    marginTop: 12,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: palette.stroke,
  },
  subSectionLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  field: { color: palette.textMuted, fontWeight: '600', fontSize: 13 },
  value: { color: palette.text, fontWeight: '800', fontSize: 14 },
  notesBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.stroke },
  notesText: { marginTop: 4, color: palette.text, fontSize: 14, fontWeight: '600', fontStyle: 'italic' },
  spacedCard: { marginTop: 4 },
  sellerName: { color: palette.text, fontSize: 18, fontWeight: '900' },
  sellerPhone: { marginTop: 4, color: palette.emeraldDeep, fontSize: 14, fontWeight: '800' },
  sellerEmail: { marginTop: 2, color: palette.textMuted, fontSize: 13, fontWeight: '600' },
  listHeader: { marginTop: 10, color: palette.text, fontSize: 16, fontWeight: '900' },
  itemCard: { paddingVertical: 12 },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemProd: { color: palette.text, fontSize: 15, fontWeight: '800' },
  itemTotal: { color: palette.text, fontSize: 15, fontWeight: '900' },
  itemDetail: { marginTop: 4, color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  totalBox: {
    marginTop: 8,
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: palette.stroke,
  },
  totalLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  totalValue: { marginTop: 6, color: palette.text, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  itemMargin: { color: palette.success, fontSize: 11, fontWeight: '800' },
  profitRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,230,118,0.08)' },
  profitBadge: { flex: 1, backgroundColor: 'rgba(0,230,118,0.06)', padding: 8, borderRadius: radii.md },
  profitLabel: { fontSize: 10, fontWeight: '800', color: palette.textMuted, textTransform: 'uppercase', marginBottom: 2 },
  profitValue: { fontSize: 13, fontWeight: '800', color: palette.text },
  performanceCard: { marginTop: 10, paddingBottom: 20 },
  summaryGrid: { flexDirection: 'row', gap: 20, marginTop: 4 },
  summaryCol: { flex: 1 },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: palette.textMuted },
  summaryNum: { fontSize: 15, fontWeight: '800', color: palette.text, marginTop: 2 },
  profitHighlight: { 
    marginTop: 18, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(0, 230, 118, 0.06)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.15)',
  },
  highlightLabel: { fontSize: 12, fontWeight: '800', color: palette.textMuted, textTransform: 'uppercase' },
  highlightValue: { fontSize: 22, fontWeight: '900', marginTop: 2 },
  marginPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.xl },
  marginPillText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(0,230,118,0.08)',
    borderWidth: 1,
    borderColor: palette.stroke,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: palette.text, fontWeight: '900', fontSize: 15 },
  backBtn: { margin: 20, padding: 16, backgroundColor: palette.emerald, borderRadius: radii.md, alignItems: 'center' },
  backBtnText: { color: palette.onAccent, fontWeight: '900' },
  cancelBanner: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 4,
  },
  cancelBannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cancelBannerBadge: { backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  cancelBannerBadgeText: { color: '#EF4444', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  cancelBannerDate: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  cancelBannerReason: { color: '#EF4444', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  cancelBannerNote: { color: palette.textMuted, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  fulfillmentBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,230,118,0.08)',
  },
  fulfillmentTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  fulfillmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,230,118,0.04)',
    borderRadius: radii.sm,
    padding: 8,
    marginBottom: 6,
  },
  fulLeft: { flex: 1 },
  fulLot: { fontSize: 13, fontWeight: '900', color: palette.text },
  fulWh: { fontSize: 11, fontWeight: '600', color: palette.textMuted, marginTop: 2 },
  fulRight: { alignItems: 'flex-end', flex: 2.2 },
  formulaLine: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: palette.text, 
    marginTop: 2,
    textAlign: 'right'
  },
  profitResult: { 
    marginTop: 6, 
    paddingTop: 4, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(0,230,118,0.08)',
    alignItems: 'flex-end'
  },
  profitResultLabel: { fontSize: 10, fontWeight: '800', color: palette.textMuted, textTransform: 'uppercase' },
  profitResultVal: { fontSize: 14, fontWeight: '900', marginTop: 1 },
  printHit: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.emerald,
    borderWidth: 1,
    borderColor: palette.emeraldDeep,
  },
  printHitPressed: { opacity: 0.88 },
  printGlyph: {
    fontSize: 24,
    lineHeight: 28,
  },
  printDrawerRoot: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  printDrawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  printDrawerSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: palette.paper,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: palette.stroke,
    paddingHorizontal: 8,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  printDrawerHandleRow: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  printDrawerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.stroke,
  },
  printDrawerTitle: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  printDrawerRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    marginHorizontal: 4,
  },
  printDrawerRowPressed: { backgroundColor: 'rgba(0,230,118,0.08)' },
  printDrawerRowText: { gap: 4 },
  printDrawerRowTitle: { color: palette.text, fontSize: 16, fontWeight: '900' },
  printDrawerRowHint: { color: palette.textMuted, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  /* ── payment history card ── */
  payCard: { paddingVertical: 14 },
  payHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 },
  payHeaderTitle: { color: palette.text, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  payPaidBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  payPaidBadgeText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  payDueBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(251,191,36,0.15)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' },
  payDueBadgeText: { color: '#FBbF24', fontSize: 11, fontWeight: '700' },
  payEmpty: { color: palette.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  payRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9, gap: 8 },
  payRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  payRowDate: { color: palette.text, fontSize: 12, fontWeight: '700' },
  payRowBy: { color: palette.textMuted, fontSize: 11, marginTop: 1 },
  payRowNote: { color: palette.textMuted, fontSize: 11, fontStyle: 'italic' },
  payRowAmt: { color: '#10B981', fontSize: 14, fontWeight: '800' },
  payFormWrap: { gap: 8 },
  payFormDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 6 },
  payFormLabel: { color: palette.text, fontSize: 12, fontWeight: '700' },
  payInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    fontSize: 14,
  },
  payBtn: {
    marginTop: 4,
    backgroundColor: '#10B981',
    borderRadius: radii.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  payBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  paySourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  paySourceOrder: { backgroundColor: 'rgba(139,92,246,0.18)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)' },
  paySourceSale: { backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  paySourceText: { fontSize: 10, fontWeight: '800', color: palette.text },
});
