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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { SelectMenu } from '../../components/ui/SelectMenu';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchSalesDataset } from '../../store/slices/salesDataSlice';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { showToast } from '../../store/slices/uiSlice';
import { palette, radii } from '../../theme/designSystem';
import type { MainStackParamList } from '../../navigation/mainStackTypes';
import * as salesApi from '../../api/sales';
import * as inventoryApi from '../../api/inventory';
import { unitLabelForProduct } from '../../utils/sales';
import { useT } from '../../i18n/useT';
import type { TxKey } from '../../i18n/en';

type Tab = 'overview' | 'sales' | 'stock' | 'sell' | 'buy';

type RouteProps = RouteProp<MainStackParamList, 'ProductDetail'>;

const TAB_LABEL_KEYS: Record<Tab, TxKey> = {
  overview: 'product.tab.overview',
  sales: 'product.tab.sales',
  stock: 'product.tab.stock',
  sell: 'product.tab.sell',
  buy: 'product.tab.buy',
};
const TAB_ORDER: Tab[] = ['overview', 'sales', 'stock', 'sell', 'buy'];

export function ProductDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProps>();
  const { productId } = route.params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const t = useT();
  const locale = useAppSelector((s) => s.ui.locale);
  const token = useAppSelector((s) => s.auth.token);

  const { products, sales, salesItems, warehouses, units, currencies, users } =
    useAppSelector((s) => s.salesData);
  const { stockRows } = useAppSelector((s) => s.inventory);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sellWarehouseId, setSellWarehouseId] = useState('');
  const [sellQty, setSellQty] = useState('1');
  const [sellPrice, setSellPrice] = useState('');
  const [sellCurrencyId, setSellCurrencyId] = useState(() => currencies[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  // Buy (purchase) state
  const [buyWarehouseId, setBuyWarehouseId] = useState('');
  const [buyQty, setBuyQty] = useState('1');
  const [buyUnitCost, setBuyUnitCost] = useState('');
  const [buyLotNumber, setBuyLotNumber] = useState('');
  const [buyBusy, setBuyBusy] = useState(false);

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const unitLabel = useMemo(
    () => (product ? unitLabelForProduct(product, units) : ''),
    [product, units],
  );

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
        style: 'currency',
        currency: 'BDT',
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const productSalesItems = useMemo(
    () => salesItems.filter((si) => si.productId === productId),
    [salesItems, productId],
  );

  const totalQtySold = useMemo(
    () => productSalesItems.reduce((acc, si) => acc + Number(si.quantity), 0),
    [productSalesItems],
  );

  const totalRevenue = useMemo(
    () =>
      productSalesItems.reduce(
        (acc, si) => acc + Number(si.quantity) * Number(si.unitPrice),
        0,
      ),
    [productSalesItems],
  );

  const productStockRows = useMemo(
    () => stockRows.filter((r) => r.productId === productId),
    [stockRows, productId],
  );

  const totalOnHand = useMemo(
    () => productStockRows.reduce((acc, r) => acc + Number(r.quantityOnHand), 0),
    [productStockRows],
  );

  const sellWarehouseStock = useMemo(() => {
    if (!sellWarehouseId) return 0;
    return productStockRows
      .filter((r) => r.warehouseId === sellWarehouseId)
      .reduce((acc, r) => acc + Number(r.quantityOnHand), 0);
  }, [productStockRows, sellWarehouseId]);

  const enrichedSales = useMemo(() => {
    const saleIdSet = new Set(productSalesItems.map((si) => si.saleId));
    return sales
      .filter((s) => saleIdSet.has(s.id))
      .map((s) => {
        const items = productSalesItems.filter((si) => si.saleId === s.id);
        const qty = items.reduce((a, si) => a + Number(si.quantity), 0);
        const rev = items.reduce(
          (a, si) => a + Number(si.quantity) * Number(si.unitPrice),
          0,
        );
        const wh = warehouses.find((w) => w.id === s.warehouseId)?.name ?? '—';
        const seller = users.find((u) => u.id === s.createdBy)?.name ?? '—';
        return { sale: s, qty, rev, wh, seller };
      })
      .sort((a, b) => b.sale.saleDate.localeCompare(a.sale.saleDate));
  }, [sales, productSalesItems, warehouses, users]);

  const warehouseBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        warehouseName: string;
        total: number;
        lots: { lotNumber: string; qty: number; cost: number; acquiredAt: string }[];
      }
    >();
    for (const r of productStockRows) {
      const lotEntry = {
        lotNumber: r.lotNumber ?? 'N/A',
        qty: Number(r.quantityOnHand),
        cost: Number(r.unitCost ?? 0),
        acquiredAt: r.acquiredAt ?? r.purchaseDate ?? '',
      };
      const existing = map.get(r.warehouseId);
      if (existing) {
        existing.total += Number(r.quantityOnHand);
        existing.lots.push(lotEntry);
      } else {
        map.set(r.warehouseId, {
          warehouseName: r.warehouseName,
          total: Number(r.quantityOnHand),
          lots: [lotEntry],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [productStockRows]);

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.name })),
    [warehouses],
  );
  const currencyOptions = useMemo(
    () => currencies.map((c) => ({ value: c.id, label: c.code })),
    [currencies],
  );

  async function handleSell() {
    if (!token) return;
    const qty = Number(sellQty);
    const price = Number(sellPrice);
    if (!sellWarehouseId) {
      Alert.alert(t('product.sell.warehouseLabel'), t('product.sell.errWarehouse'));
      return;
    }
    if (!qty || qty <= 0) {
      Alert.alert(t('product.sell.qty'), t('product.sell.errQty'));
      return;
    }
    if (!price || price <= 0) {
      Alert.alert(t('product.sell.unitPrice'), t('product.sell.errPrice'));
      return;
    }
    if (qty > sellWarehouseStock) {
      Alert.alert(t('product.stat.inStock'), t('product.sell.errStock', { n: sellWarehouseStock, unit: unitLabel }));
      return;
    }
    setBusy(true);
    try {
      await salesApi.createSale(
        {
          warehouseId: sellWarehouseId,
          saleDate: new Date().toISOString().slice(0, 10),
          items: [{ productId, quantity: qty, unitPrice: price, currencyId: sellCurrencyId }],
        },
        token,
      );
      dispatch(
        showToast({
          title: t('product.sell.successTitle'),
          message: t('product.sell.successMsg', { qty, unit: unitLabel }),
          type: 'success',
        }),
      );
      setSellQty('1');
      setSellPrice('');
      await Promise.all([
        dispatch(fetchSalesDataset()).unwrap(),
        dispatch(fetchInventoryStock()).unwrap(),
      ]);
      setActiveTab('sales');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to record sale.');
    } finally {
      setBusy(false);
    }
  }

  async function handleBuy() {
    if (!token) return;
    const qty = Number(buyQty);
    const cost = Number(buyUnitCost);
    if (!buyWarehouseId) {
      Alert.alert(t('product.buy.destWarehouse'), t('product.buy.errWarehouse'));
      return;
    }
    if (!qty || qty <= 0) {
      Alert.alert(t('product.buy.qty'), t('product.buy.errQty'));
      return;
    }
    if (!cost || cost <= 0) {
      Alert.alert(t('product.buy.unitCost'), t('product.buy.errCost'));
      return;
    }
    setBuyBusy(true);
    try {
      await inventoryApi.createPurchase(
        {
          warehouseId: buyWarehouseId,
          purchaseDate: new Date().toISOString().slice(0, 10),
          notes: buyLotNumber ? `Lot: ${buyLotNumber}` : undefined,
          items: [{ productId, quantity: qty, unitCost: cost }],
        },
        token,
      );
      const whName = warehouses.find((w) => w.id === buyWarehouseId)?.name ?? '';
      dispatch(
        showToast({
          title: t('product.buy.successTitle'),
          message: t('product.buy.successMsg', { qty, unit: unitLabel, warehouse: whName }),
          type: 'success',
        }),
      );
      setBuyQty('1');
      setBuyUnitCost('');
      setBuyLotNumber('');
      await dispatch(fetchInventoryStock()).unwrap();
      setActiveTab('stock');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to record purchase.');
    } finally {
      setBuyBusy(false);
    }
  }

  if (!product) {
    return (
      <MeshBackground>
        <SafeAreaView style={styles.notFound}>
          <Text style={styles.notFoundText}>{t('product.notFound')}</Text>
        </SafeAreaView>
      </MeshBackground>
    );
  }

  const avgPrice = totalQtySold > 0 ? totalRevenue / totalQtySold : 0;

  return (
    <MeshBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            onPress={() =>
              navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Work')
            }
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.productName} numberOfLines={1}>
              {product.name}
            </Text>
            {!!unitLabel && (
              <View style={styles.unitPill}>
                <Text style={styles.unitPillText}>{unitLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Hero Stats Band ── */}
        <View style={styles.statsBand}>
          <StatBandItem value={totalOnHand.toLocaleString()} label={t('product.stat.inStock')} accent={palette.emerald} />
          <View style={styles.statDivider} />
          <StatBandItem value={totalQtySold.toLocaleString()} label={t('product.stat.totalSold')} accent={palette.violet} />
          <View style={styles.statDivider} />
          <StatBandItem value={String(enrichedSales.length)} label={t('product.stat.orders')} accent={palette.emeraldDeep} />
          <View style={styles.statDivider} />
          <StatBandItem value={money.format(totalRevenue)} label={t('product.stat.revenue')} accent={palette.emerald} />
        </View>

        {/* ── Tab Bar ── */}
        <View style={styles.tabBar}>
          {TAB_ORDER.map((key) => {
            const isActive = activeTab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setActiveTab(key)}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {t(TAB_LABEL_KEYS[key])}
                </Text>
                {isActive && <View style={styles.tabUnderline} />}
              </Pressable>
            );
          })}
        </View>

        {/* ── Tab Content ── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollInner, { paddingBottom: insets.bottom + 48 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <View style={styles.tabContent}>
              {/* Big Revenue Card */}
              <GlassCard style={styles.heroCard}>
                <View style={styles.heroCardHead}>
                  <View style={styles.heroIcon}>
                    <Text style={styles.heroIconText}>📦</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroCardLabel}>All-Time Revenue</Text>
                    <Text style={styles.heroCardValue}>{money.format(totalRevenue)}</Text>
                  </View>
                  <View style={styles.avgPriceBox}>
                    <Text style={styles.avgPriceLabel}>Avg Price</Text>
                    <Text style={styles.avgPriceValue}>{money.format(avgPrice)}</Text>
                  </View>
                </View>
                {/* Revenue bar vs theoretical if avg used */}
                <View style={styles.revenueBarTrack}>
                  <View style={[styles.revenueBarFill, { width: '100%' }]} />
                </View>
                <View style={styles.heroCardFooter}>
                  <Text style={styles.heroCardHint}>
                    {t('product.overview.soldAcross', { qty: totalQtySold.toLocaleString(), unit: unitLabel, orders: enrichedSales.length })}
                  </Text>
                </View>
              </GlassCard>

              {/* Stock Health Card */}
              <GlassCard style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{t('product.overview.stockHealth')}</Text>
                  <View
                    style={[
                      styles.healthBadge,
                      totalOnHand > 50
                        ? styles.healthGood
                        : totalOnHand > 10
                        ? styles.healthWarn
                        : styles.healthLow,
                    ]}>
                    <Text style={styles.healthBadgeText}>
                      {totalOnHand > 50 ? t('product.overview.healthy') : totalOnHand > 10 ? t('product.overview.low') : t('product.overview.critical')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.bigNumber}>
                  {totalOnHand.toLocaleString()}
                  <Text style={styles.bigNumberUnit}> {unitLabel}</Text>
                </Text>
                <View style={styles.stockHealthBar}>
                  <View
                    style={[
                      styles.stockHealthFill,
                      {
                        width: `${Math.min(100, (totalOnHand / Math.max(totalOnHand + totalQtySold, 1)) * 100)}%`,
                        backgroundColor:
                          totalOnHand > 50
                            ? palette.emerald
                            : totalOnHand > 10
                            ? '#FFD60A'
                            : palette.rose,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.stockHint}>
                  {t(warehouseBreakdown.length === 1 ? 'product.overview.warehouses' : 'product.overview.warehousesPlural', { n: warehouseBreakdown.length })}
                </Text>
              </GlassCard>

              {/* Warehouse Summary */}
              {warehouseBreakdown.length > 0 && (
                <GlassCard style={styles.card}>
                  <Text style={styles.cardTitle}>{t('product.overview.warehouseDist')}</Text>
                  <View style={styles.warehouseList}>
                    {warehouseBreakdown.map((wh, i) => {
                      const share = totalOnHand > 0 ? wh.total / totalOnHand : 0;
                      return (
                        <View key={i} style={styles.warehouseRow}>
                          <View style={styles.warehouseRowLeft}>
                            <View style={styles.whDot} />
                            <Text style={styles.whName} numberOfLines={1}>{wh.warehouseName}</Text>
                          </View>
                          <View style={styles.whBarWrap}>
                            <View style={[styles.whBar, { width: `${share * 100}%` }]} />
                          </View>
                          <Text style={styles.whQty}>{wh.total.toLocaleString()}</Text>
                        </View>
                      );
                    })}
                  </View>
                </GlassCard>
              )}

              {/* Recent Sales Preview */}
              {enrichedSales.length > 0 && (
                <GlassCard style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{t('product.overview.recentSales')}</Text>
                    <Pressable onPress={() => setActiveTab('sales')}>
                      <Text style={styles.seeAllBtn}>{t('product.overview.seeAll')}</Text>
                    </Pressable>
                  </View>
                  {enrichedSales.slice(0, 3).map((item, i) => (
                    <View key={i} style={[styles.recentSaleRow, i > 0 && styles.recentSaleRowBorder]}>
                      <View>
                        <Text style={styles.recentSaleDate}>{item.sale.saleDate}</Text>
                        <Text style={styles.recentSaleSeller}>{item.seller} · {item.wh}</Text>
                      </View>
                      <View style={styles.recentSaleRight}>
                        <Text style={styles.recentSaleQty}>{item.qty} {unitLabel}</Text>
                        <Text style={styles.recentSaleRev}>{money.format(item.rev)}</Text>
                      </View>
                    </View>
                  ))}
                </GlassCard>
              )}
            </View>
          )}

          {/* SALES HISTORY */}
          {activeTab === 'sales' && (
            <View style={styles.tabContent}>
              {/* Summary Row */}
              <View style={styles.salesSummaryRow}>
                <SummaryMini label={t('product.sales.totalQty')} value={`${totalQtySold.toLocaleString()} ${unitLabel}`} />
                <SummaryMini label={t('product.sales.totalRevenue')} value={money.format(totalRevenue)} />
                <SummaryMini label={t('product.stat.orders')} value={String(enrichedSales.length)} />
              </View>

              {enrichedSales.length === 0 ? (
                <GlassCard style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>📊</Text>
                  <Text style={styles.emptyTitle}>{t('product.sales.noSalesTitle')}</Text>
                  <Text style={styles.emptyBody}>{t('product.sales.noSalesBody')}</Text>
                  <Pressable
                    onPress={() => setActiveTab('sell')}
                    style={styles.emptyBtn}>
                    <Text style={styles.emptyBtnText}>{t('product.sales.logFirst')}</Text>
                  </Pressable>
                </GlassCard>
              ) : (
                enrichedSales.map((item, i) => (
                  <GlassCard key={i} style={styles.saleHistoryCard}>
                    <View style={styles.saleHistoryTop}>
                      <View>
                        <Text style={styles.saleHistoryDate}>{item.sale.saleDate}</Text>
                        <View style={styles.saleHistoryMeta}>
                          <View style={styles.whChip}>
                            <Text style={styles.whChipText}>{item.wh}</Text>
                          </View>
                          <Text style={styles.saleHistorySeller}>{item.seller}</Text>
                        </View>
                      </View>
                      <View style={styles.saleHistoryNums}>
                        <Text style={styles.saleHistoryRev}>{money.format(item.rev)}</Text>
                        <Text style={styles.saleHistoryQty}>
                          {item.qty.toLocaleString()} {unitLabel}
                        </Text>
                      </View>
                    </View>
                    {item.sale.notes ? (
                      <Text style={styles.saleHistoryNote} numberOfLines={1}>
                        {item.sale.notes}
                      </Text>
                    ) : null}
                  </GlassCard>
                ))
              )}
            </View>
          )}

          {/* STOCK / INVENTORY */}
          {activeTab === 'stock' && (
            <View style={styles.tabContent}>
              {/* Total on hand hero */}
              <GlassCard style={styles.stockHeroCard}>
                <View style={styles.stockHeroInner}>
                  <View>
                    <Text style={styles.stockHeroLabel}>{t('product.stock.totalOnHand')}</Text>
                    <Text style={styles.stockHeroValue}>
                      {totalOnHand.toLocaleString()}
                      <Text style={styles.stockHeroUnit}> {unitLabel}</Text>
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.stockHeroBadge,
                      totalOnHand > 50
                        ? styles.healthGood
                        : totalOnHand > 10
                        ? styles.healthWarn
                        : styles.healthLow,
                    ]}>
                    <Text style={styles.healthBadgeText}>
                      {totalOnHand > 50 ? t('product.overview.healthy') : totalOnHand > 10 ? t('product.overview.low') : t('product.overview.critical')}
                    </Text>
                  </View>
                </View>
              </GlassCard>

              {warehouseBreakdown.length === 0 ? (
                <GlassCard style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>📦</Text>
                  <Text style={styles.emptyTitle}>{t('product.stock.noStockTitle')}</Text>
                  <Text style={styles.emptyBody}>{t('product.stock.noStockBody')}</Text>
                </GlassCard>
              ) : (
                warehouseBreakdown.map((wh, wi) => (
                  <GlassCard key={wi} style={styles.whCard}>
                    <View style={styles.whCardHeader}>
                      <View style={styles.whCardBadge}>
                        <Text style={styles.whCardIcon}>🏭</Text>
                        <Text style={styles.whCardName}>{wh.warehouseName}</Text>
                      </View>
                      <Text style={styles.whCardTotal}>
                        {wh.total.toLocaleString()} {unitLabel}
                      </Text>
                    </View>
                    <View style={styles.whStockBar}>
                      <View
                        style={[
                          styles.whStockBarFill,
                          { width: totalOnHand > 0 ? `${(wh.total / totalOnHand) * 100}%` : '0%' },
                        ]}
                      />
                    </View>
                    {/* Lot rows */}
                    <View style={styles.lotList}>
                      {wh.lots.map((lot, li) => (
                        <View
                          key={li}
                          style={[styles.lotRow, li < wh.lots.length - 1 && styles.lotRowBorder]}>
                          <View>
                            <Text style={styles.lotNumber}>{t('product.stock.lot', { n: lot.lotNumber })}</Text>
                            {!!lot.acquiredAt && (
                              <Text style={styles.lotDate}>{t('product.stock.acquired', { date: lot.acquiredAt.slice(0, 10) })}</Text>
                            )}
                          </View>
                          <View style={styles.lotRight}>
                            <Text style={styles.lotQty}>{lot.qty.toLocaleString()}</Text>
                            {lot.cost > 0 && (
                              <Text style={styles.lotCost}>
                                {new Intl.NumberFormat('en-BD', {
                                  style: 'currency',
                                  currency: 'BDT',
                                  maximumFractionDigits: 0,
                                }).format(lot.cost)}/unit
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  </GlassCard>
                ))
              )}
            </View>
          )}

          {/* SELL */}
          {activeTab === 'sell' && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.tabContent}>
                <GlassCard style={styles.sellHeroCard}>
                  <View style={styles.sellHeroRow}>
                    <View style={styles.sellHeroIcon}>
                      <Text style={styles.sellHeroIconText}>✦</Text>
                    </View>
                    <View>
                      <Text style={styles.sellHeroTitle}>{t('product.sell.heroTitle')}</Text>
                      <Text style={styles.sellHeroSub}>{product.name}</Text>
                    </View>
                    {sellWarehouseId && (
                      <View style={styles.sellStockBadge}>
                        <Text style={styles.sellStockLabel}>{t('product.sell.available')}</Text>
                        <Text style={styles.sellStockValue}>{sellWarehouseStock}</Text>
                      </View>
                    )}
                  </View>
                </GlassCard>

                <GlassCard style={styles.card}>
                  <Text style={styles.formSectionLabel}>{t('product.sell.warehouseLabel')}</Text>
                  <SelectMenu
                    label={t('product.sell.selectWarehouse')}
                    value={sellWarehouseId}
                    options={warehouseOptions}
                    onChange={setSellWarehouseId}
                  />

                  <View style={styles.formRow}>
                    <View style={styles.formFieldHalf}>
                      <Text style={styles.fieldLabel}>{t('product.sell.qty')}</Text>
                      <TextInput
                        style={styles.input}
                        value={sellQty}
                        onChangeText={setSellQty}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor={palette.textMuted}
                        selectTextOnFocus
                      />
                    </View>
                    <View style={styles.formFieldHalf}>
                      <Text style={styles.fieldLabel}>{t('product.sell.unitPrice')}</Text>
                      <TextInput
                        style={styles.input}
                        value={sellPrice}
                        onChangeText={setSellPrice}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={palette.textMuted}
                        selectTextOnFocus
                      />
                    </View>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{t('product.sell.currency')}</Text>
                  <SelectMenu
                    label={t('product.sell.currency')}
                    value={sellCurrencyId}
                    options={currencyOptions}
                    onChange={setSellCurrencyId}
                  />

                  {/* Order Total Preview */}
                  {Number(sellQty) > 0 && Number(sellPrice) > 0 && (
                    <View style={styles.orderPreview}>
                      <Text style={styles.orderPreviewLabel}>{t('product.sell.orderTotal')}</Text>
                      <Text style={styles.orderPreviewValue}>
                        {new Intl.NumberFormat('en-BD', {
                          style: 'currency',
                          currency: 'BDT',
                          maximumFractionDigits: 0,
                        }).format(Number(sellQty) * Number(sellPrice))}
                      </Text>
                    </View>
                  )}
                </GlassCard>

                <Pressable
                  onPress={handleSell}
                  disabled={busy}
                  style={({ pressed }) => [styles.sellBtn, pressed && styles.sellBtnPressed, busy && styles.sellBtnBusy]}>
                  {busy ? (
                    <ActivityIndicator color={palette.onAccent} size="small" />
                  ) : (
                    <Text style={styles.sellBtnText}>{t('product.sell.submit')}</Text>
                  )}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}

          {/* BUY / RECEIVE STOCK */}
          {activeTab === 'buy' && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.tabContent}>

                {/* Hero banner */}
                <GlassCard style={styles.buyHeroCard}>
                  <View style={styles.sellHeroRow}>
                    <View style={[styles.sellHeroIcon, styles.buyHeroIcon]}>
                      <Text style={styles.sellHeroIconText}>⬇</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.buyHeroTitle}>{t('product.buy.heroTitle')}</Text>
                      <Text style={styles.sellHeroSub}>{product.name}</Text>
                    </View>
                    <View style={styles.currentStockBox}>
                      <Text style={styles.sellStockLabel}>{t('product.buy.onHand')}</Text>
                      <Text style={[styles.sellStockValue, { color: palette.violet }]}>
                        {totalOnHand.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </GlassCard>

                {/* Form */}
                <GlassCard style={styles.card}>
                  <Text style={styles.formSectionLabel}>{t('product.buy.destWarehouse')}</Text>
                  <SelectMenu
                    label={t('product.sell.selectWarehouse')}
                    value={buyWarehouseId}
                    options={warehouseOptions}
                    onChange={setBuyWarehouseId}
                  />

                  <View style={styles.formRow}>
                    <View style={styles.formFieldHalf}>
                      <Text style={styles.fieldLabel}>{t('product.buy.qty')}</Text>
                      <TextInput
                        style={styles.input}
                        value={buyQty}
                        onChangeText={setBuyQty}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={palette.textMuted}
                        selectTextOnFocus
                      />
                    </View>
                    <View style={styles.formFieldHalf}>
                      <Text style={styles.fieldLabel}>{t('product.buy.unitCost')}</Text>
                      <TextInput
                        style={styles.input}
                        value={buyUnitCost}
                        onChangeText={setBuyUnitCost}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={palette.textMuted}
                        selectTextOnFocus
                      />
                    </View>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                    {t('product.buy.lotNumber')} <Text style={styles.optionalLabel}>{t('product.buy.optional')}</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={buyLotNumber}
                    onChangeText={setBuyLotNumber}
                    placeholder="e.g. LOT-2026-001"
                    placeholderTextColor={palette.textMuted}
                    autoCapitalize="characters"
                  />

                  {/* Total cost preview */}
                  {Number(buyQty) > 0 && Number(buyUnitCost) > 0 && (
                    <View style={styles.orderPreview}>
                      <View>
                        <Text style={styles.orderPreviewLabel}>{t('product.buy.totalCost')}</Text>
                        <Text style={styles.buyCostHint}>
                          {Number(buyQty).toLocaleString()} {unitLabel} × {
                            new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(Number(buyUnitCost))
                          }
                        </Text>
                      </View>
                      <Text style={[styles.orderPreviewValue, { color: palette.violet }]}>
                        {new Intl.NumberFormat('en-BD', {
                          style: 'currency',
                          currency: 'BDT',
                          maximumFractionDigits: 0,
                        }).format(Number(buyQty) * Number(buyUnitCost))}
                      </Text>
                    </View>
                  )}
                </GlassCard>

                <Pressable
                  onPress={handleBuy}
                  disabled={buyBusy}
                  style={({ pressed }) => [
                    styles.buyBtn,
                    pressed && styles.buyBtnPressed,
                    buyBusy && styles.sellBtnBusy,
                  ]}>
                  {buyBusy ? (
                    <ActivityIndicator color={palette.onAccent} size="small" />
                  ) : (
                    <Text style={styles.sellBtnText}>{t('product.buy.submit')}</Text>
                  )}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}
        </ScrollView>
      </SafeAreaView>
    </MeshBackground>
  );
}

// ── Sub-components ──────────────────────────────────────────

function StatBandItem({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <View style={bandStyles.item}>
      <Text style={[bandStyles.value, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={bandStyles.label}>{label}</Text>
    </View>
  );
}

function SummaryMini({ label, value }: { label: string; value: string }) {
  return (
    <View style={summaryStyles.wrap}>
      <Text style={summaryStyles.label}>{label}</Text>
      <Text style={summaryStyles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const bandStyles = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  value: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  label: {
    marginTop: 3,
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});

const summaryStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: 'rgba(245,168,24,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(245,168,24,0.14)',
    borderRadius: radii.md,
    padding: 14,
    alignItems: 'center',
  },
  label: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  value: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: palette.rose, fontSize: 16, fontWeight: '800' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  backArrow: { color: palette.emerald, fontSize: 20, fontWeight: '900', marginTop: -2 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  productName: {
    flex: 1,
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  unitPill: {
    backgroundColor: palette.emeraldLight,
    borderWidth: 1,
    borderColor: 'rgba(245,168,24,0.28)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unitPillText: { color: palette.emerald, fontSize: 11, fontWeight: '900' },

  // Stats Band
  statsBand: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 4,
    backgroundColor: 'rgba(11, 74, 36, 0.60)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.stroke,
    overflow: 'hidden',
  },
  statDivider: {
    width: 1,
    backgroundColor: palette.stroke,
    marginVertical: 10,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: 'rgba(7, 52, 27, 0.80)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.stroke,
    padding: 4,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radii.md,
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: palette.night,
    shadowColor: palette.emerald,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tabLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: palette.emerald,
    fontWeight: '900',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 4,
    width: 20,
    height: 2,
    backgroundColor: palette.emerald,
    borderRadius: 999,
  },

  // Content
  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
  tabContent: { gap: 14 },

  // Cards
  card: {
    padding: 18,
    gap: 12,
    backgroundColor: 'palette.cardBg',
    borderWidth: 1,
    borderColor: 'palette.cardBorder',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  seeAllBtn: {
    color: palette.emerald,
    fontSize: 13,
    fontWeight: '800',
  },

  // Hero Card (Overview)
  heroCard: {
    padding: 20,
    backgroundColor: 'palette.cardBgPrimary',
    borderWidth: 1,
    borderColor: 'palette.cardBorderAccent',
    shadowColor: '#A6FF8A',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heroCardHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: 'rgba(245,168,24,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56,140,220,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconText: { fontSize: 24 },
  heroCardLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroCardValue: {
    color: '#D8FFD0',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 2,
    textShadowColor: 'rgba(245,168,24,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  avgPriceBox: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(245,168,24,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,168,24,0.18)',
    borderRadius: radii.sm,
    padding: 10,
  },
  avgPriceLabel: { color: palette.textMuted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  avgPriceValue: { color: palette.emerald, fontSize: 15, fontWeight: '900', marginTop: 2 },
  revenueBarTrack: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 999,
    marginTop: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56,140,220,0.14)',
  },
  revenueBarFill: {
    height: '100%',
    backgroundColor: palette.emeraldDeep,
    borderRadius: 999,
  },
  heroCardFooter: { marginTop: 8 },
  heroCardHint: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },

  // Stock Health
  healthBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  stockHeroBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  healthGood: { backgroundColor: 'rgba(245,168,24,0.18)', borderWidth: 1, borderColor: 'rgba(245,168,24,0.30)' },
  healthWarn: { backgroundColor: 'rgba(255,214,10,0.15)', borderWidth: 1, borderColor: 'rgba(255,214,10,0.28)' },
  healthLow: { backgroundColor: 'rgba(255,82,82,0.15)', borderWidth: 1, borderColor: 'rgba(255,82,82,0.28)' },
  healthBadgeText: { color: palette.text, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  bigNumber: { color: palette.text, fontSize: 42, fontWeight: '900', letterSpacing: -1.5, lineHeight: 48 },
  bigNumberUnit: { color: palette.textMuted, fontSize: 20, fontWeight: '700', letterSpacing: 0 },
  stockHealthBar: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56,140,220,0.14)',
  },
  stockHealthFill: { height: '100%', borderRadius: 999 },
  stockHint: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },

  // Warehouse distribution
  warehouseList: { gap: 10, marginTop: 4 },
  warehouseRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  warehouseRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 120 },
  whDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.emerald },
  whName: { color: palette.textLabel, fontSize: 13, fontWeight: '700', flex: 1 },
  whBarWrap: { flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 999, overflow: 'hidden' },
  whBar: { height: '100%', backgroundColor: palette.emeraldDeep, borderRadius: 999 },
  whQty: { color: palette.text, fontSize: 13, fontWeight: '900', minWidth: 48, textAlign: 'right' },

  // Recent Sales (Overview)
  recentSaleRow: { paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  recentSaleRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(56,140,220,0.12)' },
  recentSaleDate: { color: palette.text, fontSize: 14, fontWeight: '800' },
  recentSaleSeller: { color: palette.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  recentSaleRight: { alignItems: 'flex-end' },
  recentSaleQty: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  recentSaleRev: { color: palette.emerald, fontSize: 15, fontWeight: '900', marginTop: 2 },

  // Sales Tab
  salesSummaryRow: { flexDirection: 'row', gap: 10 },
  saleHistoryCard: {
    padding: 16,
    backgroundColor: 'palette.cardBg',
    borderWidth: 1,
    borderColor: 'palette.cardBorder',
    gap: 10,
  },
  saleHistoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  saleHistoryDate: { color: palette.text, fontSize: 15, fontWeight: '900' },
  saleHistoryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  whChip: {
    backgroundColor: 'rgba(245,168,24,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,168,24,0.20)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  whChipText: { color: palette.emerald, fontSize: 11, fontWeight: '800' },
  saleHistorySeller: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  saleHistoryNums: { alignItems: 'flex-end' },
  saleHistoryRev: {
    color: palette.emerald,
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(157,255,117,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  saleHistoryQty: { color: palette.textMuted, fontSize: 12, fontWeight: '700', marginTop: 3 },
  saleHistoryNote: { color: palette.textMuted, fontSize: 12, fontWeight: '600', fontStyle: 'italic' },

  // Stock Tab
  stockHeroCard: {
    padding: 20,
    backgroundColor: 'palette.cardBgPrimary',
    borderWidth: 1,
    borderColor: 'rgba(157,255,117,0.25)',
  },
  stockHeroInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stockHeroLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  stockHeroValue: { color: palette.text, fontSize: 36, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  stockHeroUnit: { color: palette.textMuted, fontSize: 18, fontWeight: '700', letterSpacing: 0 },
  whCard: {
    padding: 16,
    backgroundColor: 'palette.cardBg',
    borderWidth: 1,
    borderColor: 'palette.cardBorder',
    gap: 12,
  },
  whCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  whCardBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whCardIcon: { fontSize: 16 },
  whCardName: { color: palette.text, fontSize: 15, fontWeight: '900' },
  whCardTotal: { color: palette.emerald, fontSize: 16, fontWeight: '900' },
  whStockBar: { height: 6, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 999, overflow: 'hidden' },
  whStockBarFill: { height: '100%', backgroundColor: palette.emeraldDeep, borderRadius: 999 },
  lotList: { gap: 0, marginTop: 4 },
  lotRow: { paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lotRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(188,255,162,0.10)' },
  lotNumber: { color: palette.textLabel, fontSize: 13, fontWeight: '800' },
  lotDate: { color: palette.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  lotRight: { alignItems: 'flex-end' },
  lotQty: { color: palette.text, fontSize: 16, fontWeight: '900' },
  lotCost: { color: palette.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },

  // Sell Tab
  sellHeroCard: {
    padding: 20,
    backgroundColor: 'palette.cardBgPrimary',
    borderWidth: 1,
    borderColor: 'rgba(245,168,24,0.28)',
  },
  sellHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sellHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: palette.emeraldLight,
    borderWidth: 1,
    borderColor: 'rgba(245,168,24,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellHeroIconText: { color: palette.emerald, fontSize: 22, fontWeight: '900' },
  sellHeroTitle: { color: palette.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  sellHeroSub: { color: palette.textMuted, fontSize: 13, fontWeight: '700', marginTop: 2 },
  sellStockBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(245,168,24,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,168,24,0.24)',
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sellStockLabel: { color: palette.textMuted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  sellStockValue: { color: palette.emerald, fontSize: 20, fontWeight: '900', marginTop: 2 },
  formSectionLabel: {
    color: palette.textLabel,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  formRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  formFieldHalf: { flex: 1 },
  fieldLabel: {
    color: palette.textLabel,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  input: {
    backgroundColor: palette.inputInset,
    borderWidth: 1,
    borderColor: palette.stroke,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  orderPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(56,140,220,0.14)',
  },
  orderPreviewLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  orderPreviewValue: { color: palette.emerald, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  sellBtn: {
    backgroundColor: palette.emerald,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: palette.emerald,
    shadowOpacity: 0.40,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  sellBtnPressed: { backgroundColor: palette.emeraldDeep, opacity: 0.9 },
  sellBtnBusy: { opacity: 0.7 },
  sellBtnText: {
    color: palette.onAccent,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  // Buy tab
  buyHeroCard: {
    padding: 20,
    backgroundColor: 'palette.cardBgElevated',
    borderWidth: 1,
    borderColor: 'rgba(191,255,159,0.22)',
  },
  buyHeroIcon: {
    backgroundColor: 'rgba(52,207,255,0.10)',
    borderColor: 'rgba(52,207,255,0.22)',
  },
  buyHeroTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  currentStockBox: {
    backgroundColor: 'rgba(52,207,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52,207,255,0.18)',
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  optionalLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'none',
    letterSpacing: 0,
  },
  buyCostHint: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  buyBtn: {
    backgroundColor: palette.violet,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: palette.violet,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  buyBtnPressed: { opacity: 0.85 },

  // Empty state
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'palette.cardBg',
    borderWidth: 1,
    borderColor: 'palette.cardBorder',
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  emptyBody: { color: palette.textMuted, fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: palette.emerald,
    borderRadius: radii.lg,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: palette.onAccent, fontSize: 14, fontWeight: '900' },
});
