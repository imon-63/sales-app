import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import RNPrint from 'react-native-print';
import { Calendar } from 'react-native-calendars';
import type { MarkedDates } from 'react-native-calendars/src/types';

import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { SelectMenu } from '../../components/ui/SelectMenu';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchSalesDataset } from '../../store/slices/salesDataSlice';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { fetchProductions } from '../../store/slices/productionSlice';
import { showToast } from '../../store/slices/uiSlice';
import { palette, radii } from '../../theme/designSystem';
import type { MainStackParamList } from '../../navigation/mainStackTypes';
import * as salesApi from '../../api/sales';
import * as inventoryApi from '../../api/inventory';
import { useT } from '../../i18n/useT';
import { unitLabelForProduct } from '../../utils/sales';
import { generateBengaliLotNumber } from '../../utils/lotNumber';
import { liveClient } from '../../utils/liveClient';
import { PulseDot } from '../../components/ui/PulseDot';
import * as productionApi from '../../api/production';
import type { ProductionConsumption } from '../../types/models';

type Tab = 'overview' | 'left' | 'sales' | 'sell' | 'buy' | 'invoice';
type RouteProps = RouteProp<MainStackParamList, 'PurchaseDetail'>;

const calendarTheme = {
  backgroundColor: palette.paper,
  calendarBackground: palette.paper,
  monthTextColor: palette.text,
  textMonthFontWeight: '800' as const,
  dayTextColor: palette.text,
  textDisabledColor: 'rgba(100,140,200,0.30)',
  selectedDayBackgroundColor: palette.emerald,
  selectedDayTextColor: palette.onAccent,
  todayTextColor: palette.emerald,
  arrowColor: palette.emerald,
  dotColor: palette.emeraldDeep,
  selectedDotColor: palette.onAccent,
};

/** "Hasan Akbor Afzol" → "HA Afzol" — initials of all words except last, then full last word */
function abbreviateName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length <= 1) return name;
  const initials = words.slice(0, -1).map(w => w[0].toUpperCase()).join('');
  return `${initials} ${words[words.length - 1]}`;
}

export function PurchaseDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProps>();
  const { lotBatchId } = route.params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const t = useT();
  const locale = useAppSelector((s) => s.ui.locale);
  const token = useAppSelector((s) => s.auth.token);
  const activeViews = useAppSelector((s) => s.notifications.activeViews);
  const currentUserId = useAppSelector((s) => s.auth.user?.id);

  // Refresh stock & sales every time this screen comes into focus so
  // remainingQty is always accurate and oversell validation is correct.
  useFocusEffect(
    useCallback(() => {
      if (token) {
        dispatch(fetchSalesDataset());
        dispatch(fetchInventoryStock());
        dispatch(fetchProductions());
      }
    }, [dispatch, token]),
  );

  // Production consumptions — read from Redux so old + new productions both show
  const { productions } = useAppSelector((s) => s.production);

  const { products, sales, salesItems, warehouses, units, currencies, users, lots, lotBatches, salesItemAllocations } =
    useAppSelector((s) => s.salesData);

  const batch = useMemo(() => lotBatches.find((b) => b.id === lotBatchId), [lotBatches, lotBatchId]);
  const lot = useMemo(() => (batch ? lots.find((l) => l.id === batch.lotId) : undefined), [lots, batch]);
  const product = useMemo(() => (lot ? products.find((p) => p.id === lot.productId) : undefined), [products, lot]);
  const warehouse = useMemo(() => (batch ? warehouses.find((w) => w.id === batch.warehouseId) : undefined), [warehouses, batch]);
  const unitLabel = useMemo(() => (product ? unitLabelForProduct(product, units) : ''), [product, units]);
  // "Direct" warehouse is the default — fall back to first warehouse if not found
  const directWarehouseId = useMemo(
    () => warehouses.find((w) => w.name.toLowerCase() === 'direct')?.id ?? warehouses[0]?.id ?? '',
    [warehouses],
  );
  const autoWarehouseId = useMemo(() => batch?.warehouseId ?? directWarehouseId, [batch, directWarehouseId]);

  // Productions that consumed from this specific lot batch
  const lotProductionConsumptions = React.useMemo(() =>
    productions.filter(p =>
      p.inputLotBatchId === lotBatchId,
    ),
    [productions, lotBatchId],
  );

  const money = useMemo(
    () => new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }),
    [locale],
  );

  const costMoney = useMemo(
    () => new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', { style: 'currency', currency: 'BDT', minimumFractionDigits: 0, maximumFractionDigits: 3 }),
    [locale],
  );

  const originalQty = Number(batch?.originalQuantity ?? 0);
  const remainingQty = Number(batch?.remainingQuantity ?? 0);
  const soldQty = originalQty - remainingQty;
  const pctSold = originalQty > 0 ? Math.round((soldQty / originalQty) * 100) : 0;
  const isSold = remainingQty === 0;

  // Sales that allocated from this lot batch
  const batchAllocations = useMemo(
    () => salesItemAllocations.filter((a) => a.lotBatchId === lotBatchId),
    [salesItemAllocations, lotBatchId],
  );
  const batchSaleItemIds = useMemo(() => new Set(batchAllocations.map((a) => a.salesItemId)), [batchAllocations]);
  const batchSaleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const si of salesItems) {
      if (batchSaleItemIds.has(si.id)) ids.add(si.saleId);
    }
    return ids;
  }, [salesItems, batchSaleItemIds]);

  const totalRevenue = useMemo(() => {
    let rev = 0;
    for (const si of salesItems) {
      if (!batchSaleItemIds.has(si.id)) continue;
      const alloc = batchAllocations.find((a) => a.salesItemId === si.id);
      if (alloc) rev += Number(alloc.quantityAllocated) * Number(si.unitPrice);
    }
    return rev;
  }, [salesItems, batchSaleItemIds, batchAllocations]);

  // Qty deducted by actual sales transactions
  const qtySoldViaSales = useMemo(() =>
    batchAllocations.reduce((a, al) => a + Number(al.quantityAllocated), 0),
    [batchAllocations],
  );
  // Qty deducted by production (gap between original/remaining that isn't covered by sales)
  const qtyUsedInProduction = useMemo(() => {
    const orig = Number(batch?.originalQuantity ?? 0);
    const rem = Number(batch?.remainingQuantity ?? 0);
    return Math.max(0, orig - rem - qtySoldViaSales);
  }, [batch, qtySoldViaSales]);

  // When fully sold: only Sales + Invoice. Otherwise full set.
  const TABS: { key: Tab; label: string }[] = isSold
    ? [
        { key: 'sales', label: t('pd.tab.sales') },
        { key: 'invoice', label: t('pd.tab.invoice') },
      ]
    : [
        { key: 'sell', label: t('pd.tab.sell') },
        { key: 'buy', label: locale === 'bn' ? 'ক্রয়' : 'Buy' },
        { key: 'sales', label: t('pd.tab.sales') },
        { key: 'invoice', label: t('pd.tab.invoice') },
      ];

  const defaultTab: Tab = isSold ? 'sales' : 'sell';
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  // Signal live dashboard when on the Sell tab — keyed by lotBatchId so two batches
  // of the same product don't both show live indicators
  React.useEffect(() => {
    if (activeTab === 'sell') {
      liveClient.enterSellTab(lotBatchId);
    } else {
      liveClient.leaveSellTab(lotBatchId);
    }
    return () => { liveClient.leaveSellTab(lotBatchId); };
  }, [activeTab, lotBatchId]);

  // Invoice sub-type
  const [invoiceType, setInvoiceType] = useState<'purchase' | 'sales'>('purchase');

  // Sell form state
  const [sellQty, setSellQty] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [busy, setBusy] = useState(false);

  // Bottle breakdown — only shown when this lot was produced AND production has ≥1 bottle price
  const BOTTLE_SIZES = [5, 2, 1, 0.5] as const;
  const sourceProduction = useMemo(
    () => productions.find(p => p.outputLotBatchId === lotBatchId),
    [productions, lotBatchId],
  );
  // Bottle prices from production (read-only per sale, set at production completion)
  const productionBottlePrices: Record<string, number> = useMemo(() => {
    if (!sourceProduction?.bottlePrices) return {};
    try {
      const parsed: Record<string, number> = JSON.parse(sourceProduction.bottlePrices);
      // Only include sizes with a non-zero price
      return Object.fromEntries(Object.entries(parsed).filter(([, v]) => Number(v) > 0));
    } catch { return {}; }
  }, [sourceProduction?.bottlePrices]);
  // Show bottle section only when production has at least one bottle price
  const isBottleMode = Object.keys(productionBottlePrices).length > 0;

  const [bottleCounts, setBottleCounts] = useState<Record<string, string>>({});
  // Oil sell price per liter — used in bottle mode instead of per-unit sellPrice
  const [oilPricePerLiter, setOilPricePerLiter] = useState('');

  const totalBottleLiters = useMemo(() =>
    BOTTLE_SIZES.reduce((sum, s) => sum + (Number(bottleCounts[String(s)]) || 0) * s, 0),
    [bottleCounts],
  );
  // In bottle mode: grand total = sum(count × (size × oilPrice + bottleCost))
  const bottleGrandTotal = useMemo(() => {
    const oilP = Number(oilPricePerLiter) || 0;
    return BOTTLE_SIZES.reduce((sum, s) => {
      const count = Number(bottleCounts[String(s)]) || 0;
      const bc = productionBottlePrices[String(s)] ?? 0;
      return sum + count * (s * oilP + bc);
    }, 0);
  }, [bottleCounts, oilPricePerLiter, productionBottlePrices]);
  // Effective price per liter (derived) — used as unitPrice in the sale record
  const bottleEffectiveUnitPrice = totalBottleLiters > 0 ? bottleGrandTotal / totalBottleLiters : 0;
  const bottleOverflow = isBottleMode && totalBottleLiters > remainingQty + 0.001;

  // Buy form state
  const [buyWarehouseId, setBuyWarehouseId] = useState(''); // empty = Direct
  const [buyQty, setBuyQty] = useState('');
  const [buyUnitCost, setBuyUnitCost] = useState('');
  const [buyExtraCost, setBuyExtraCost] = useState('');
  const [buyLotNumber, setBuyLotNumber] = useState('');
  const [buyBusy, setBuyBusy] = useState(false);

  // Resolved warehouse for buy: user selection → Direct → first warehouse
  const resolvedBuyWarehouseId = buyWarehouseId || directWarehouseId;
  const resolvedBuyWarehouseName = warehouses.find((w) => w.id === resolvedBuyWarehouseId)?.name ?? 'Direct';

  // Sales tab filters
  const [salesPersonFilter, setSalesPersonFilter] = useState('ALL');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const currencyOptions = useMemo(() => currencies.map((c) => ({ value: c.id, label: c.code })), [currencies]);
  const warehouseOptions = useMemo(() => warehouses.map((w) => ({ value: w.id, label: w.name })), [warehouses]);

  const salesPersonOptions = useMemo(() => {
    // Only include users who actually have sales on this lot batch
    const sellerIds = new Set(
      sales.filter((s) => batchSaleIds.has(s.id)).map((s) => s.createdBy),
    );
    const sellers = users
      .filter((u) => sellerIds.has(u.id))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    return [
      { value: 'ALL', label: t('pd.sales.filter.allPeople') },
      ...sellers.map((u) => ({ value: u.id, label: u.name?.trim() ? u.name : u.email })),
    ];
  }, [users, sales, batchSaleIds, t]);

  // Filtered sales for Sales tab
  const filteredSales = useMemo(() => {
    return sales
      .filter((s) => {
        if (!batchSaleIds.has(s.id)) return false;
        if (salesPersonFilter !== 'ALL' && s.createdBy !== salesPersonFilter) return false;
        if (selectedDate && s.saleDate !== selectedDate) return false;
        return true;
      })
      .map((s) => {
        const sItems = salesItems.filter((si) => si.saleId === s.id && si.productId === lot?.productId);
        const qty = sItems.reduce((a, si) => a + Number(si.quantity), 0);
        const rev = sItems.reduce((a, si) => a + Number(si.quantity) * Number(si.unitPrice), 0);
        const fullName = users.find((u) => u.id === s.createdBy)?.name ?? s.createdBy;
        const seller = abbreviateName(fullName);
        return { sale: s, qty, rev, seller };
      })
      .sort((a, b) => b.sale.saleDate.localeCompare(a.sale.saleDate));
  }, [sales, batchSaleIds, salesItems, lot, salesPersonFilter, selectedDate, users]);

  // Pre-computed for sales invoice
  const salesInvTotals = useMemo(() => {
    const unitCostVal = Number(batch?.unitCost ?? 0);
    const salesRevenue = filteredSales.reduce((a, x) => a + x.rev, 0);
    const salesQty = filteredSales.reduce((a, x) => a + x.qty, 0);
    // Production consumption is treated as a cost-price transfer (no profit, no loss)
    const prodRevenue = qtyUsedInProduction * unitCostVal;
    const totalSold = salesRevenue + prodRevenue;
    const totalQtySold = salesQty + qtyUsedInProduction;
    const totalCost = originalQty * unitCostVal;
    const profit = totalSold - totalCost;
    const profitPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    return { totalSold, totalQtySold, totalCost, profit, profitPct, salesRevenue, salesQty, prodRevenue };
  }, [filteredSales, originalQty, batch, qtyUsedInProduction]);

  const markedDates: MarkedDates = useMemo(() => {
    const m: MarkedDates = {};
    for (const s of sales) {
      if (!batchSaleIds.has(s.id)) continue;
      m[s.saleDate] = { marked: true, dotColor: palette.emeraldDeep };
    }
    if (selectedDate) {
      m[selectedDate] = { ...m[selectedDate], selected: true, selectedColor: palette.emerald, selectedTextColor: palette.onAccent };
    }
    return m;
  }, [sales, batchSaleIds, selectedDate]);

  async function handleSell() {
    if (!token || !lot?.productId) return;
    const defaultCurrencyId = currencies[0]?.id ?? '';

    if (isBottleMode) {
      // Bottle mode: qty = totalBottleLiters, unitPrice = derived from grand total
      if (totalBottleLiters <= 0) { Alert.alert(locale === 'bn' ? 'বোতল' : 'Bottles', locale === 'bn' ? 'অন্তত একটি বোতল যোগ করুন' : 'Add at least one bottle'); return; }
      if (!(Number(oilPricePerLiter) > 0)) { Alert.alert(locale === 'bn' ? 'তেলের দাম' : 'Oil price', locale === 'bn' ? 'প্রতি লিটার দাম দিন' : 'Enter price per liter'); return; }
      if (bottleOverflow) { Alert.alert(locale === 'bn' ? 'মজুদ কম' : 'Insufficient stock', locale === 'bn' ? `মজুদ ${remainingQty}L কিন্তু বোতলে ${totalBottleLiters}L` : `Only ${remainingQty}L in stock, bottles need ${totalBottleLiters}L`); return; }
      setBusy(true);
      const bottleBreakdownItems = BOTTLE_SIZES
        .map(s => ({ sizeLiter: s, count: Number(bottleCounts[String(s)]) || 0, bottleCost: productionBottlePrices[String(s)] ?? 0 }))
        .filter(b => b.count > 0);
      try {
        await salesApi.createSale({
          warehouseId: autoWarehouseId,
          saleDate: new Date().toISOString().slice(0, 10),
          items: [{ productId: lot.productId, quantity: totalBottleLiters, unitPrice: bottleEffectiveUnitPrice, currencyId: defaultCurrencyId, lotIds: [lot.id], bottleBreakdown: JSON.stringify(bottleBreakdownItems) }],
        }, token);
        dispatch(showToast({ title: t('product.sell.successTitle'), message: t('product.sell.successMsg', { qty: totalBottleLiters, unit: unitLabel }), type: 'success' }));
        setBottleCounts({});
        setOilPricePerLiter('');
        await Promise.all([dispatch(fetchSalesDataset()).unwrap(), dispatch(fetchInventoryStock()).unwrap()]);
        setActiveTab('sales');
      } catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to record sale.'); }
      finally { setBusy(false); }
      return;
    }

    // Regular (non-bottle) mode
    const qty = Number(sellQty);
    const price = Number(sellPrice);
    if (!qty || qty <= 0) { Alert.alert(t('product.sell.qty'), t('product.sell.errQty')); return; }
    if (!price || price <= 0) { Alert.alert(t('product.sell.unitPrice'), t('product.sell.errPrice')); return; }
    if (qty > remainingQty) { Alert.alert(t('product.stat.inStock'), t('product.sell.errStock', { n: remainingQty, unit: unitLabel })); return; }
    setBusy(true);
    try {
      await salesApi.createSale({
        warehouseId: autoWarehouseId,
        saleDate: new Date().toISOString().slice(0, 10),
        items: [{ productId: lot.productId, quantity: qty, unitPrice: price, currencyId: defaultCurrencyId, lotIds: [lot.id] }],
      }, token);
      dispatch(showToast({ title: t('product.sell.successTitle'), message: t('product.sell.successMsg', { qty, unit: unitLabel }), type: 'success' }));
      setSellQty('');
      setSellPrice('');
      await Promise.all([dispatch(fetchSalesDataset()).unwrap(), dispatch(fetchInventoryStock()).unwrap()]);
      setActiveTab('sales');
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to record sale.'); }
    finally { setBusy(false); }
  }

  async function handleBuy() {
    if (!token || !lot?.productId) return;
    const qty = Number(buyQty);
    const cost = Number(buyUnitCost);
    const extra = Number(buyExtraCost) || 0;
    if (!qty || qty <= 0) { Alert.alert(t('product.buy.qty'), t('product.buy.errQty')); return; }
    if (!cost || cost <= 0) { Alert.alert(t('product.buy.unitCost'), t('product.buy.errCost')); return; }
    // Effective landed cost per unit = (base_total + extra) / qty
    const effectiveUnitCost = (qty * cost + extra) / qty;
    // Auto-generate a Bengali lot number if user left the field blank
    const resolvedLotNumber = buyLotNumber.trim() || generateBengaliLotNumber();
    setBuyBusy(true);
    try {
      await inventoryApi.createPurchase({
        warehouseId: resolvedBuyWarehouseId,
        purchaseDate: new Date().toISOString().slice(0, 10),
        notes: [
          `bc:${cost}`,
          extra > 0 ? `ec:${extra}` : null,
        ].filter(Boolean).join('|') || undefined,
        items: [{ productId: lot.productId, quantity: qty, unitCost: effectiveUnitCost, baseUnitCost: cost, lotNumber: resolvedLotNumber }],
      }, token);
      dispatch(showToast({ title: t('product.buy.successTitle'), message: t('product.buy.successMsg', { qty, unit: unitLabel, warehouse: resolvedBuyWarehouseName }), type: 'success' }));
      setBuyQty(''); setBuyUnitCost(''); setBuyExtraCost(''); setBuyLotNumber(''); setBuyWarehouseId('');
      await Promise.all([dispatch(fetchSalesDataset()).unwrap(), dispatch(fetchInventoryStock()).unwrap()]);
      setActiveTab('sales');
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to record purchase.'); }
    finally { setBuyBusy(false); }
  }

  async function handlePrint(type: 'purchase' | 'sales') {
    if (!product || !batch) return;
    const dateStr = batch.acquiredAt
      ? new Date(batch.acquiredAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
      : '—';
    const printedAt = new Date().toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-GB');
    const CSS = `
      <style>
        body{font-family:Arial,sans-serif;padding:28px;color:#111;font-size:14px}
        h1{font-size:20px;margin-bottom:2px}
        .sub{color:#555;font-size:12px;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        th{background:#f0f4ff;padding:9px 10px;text-align:left;font-size:12px;border-bottom:2px solid #ccd}
        td{padding:9px 10px;border-bottom:1px solid #e8e8e8}
        .total-row td,.total-row th{font-weight:bold;font-size:15px;border-top:2px solid #111;background:#f9f9f9}
        .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;background:#e8f0ff;color:#0055cc}
        .footer{margin-top:24px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:10px}
        .ts{color:#888;font-size:12px}
      </style>
    `;

    let html = '';
    if (type === 'purchase') {
      html = `<html><head><meta charset="utf-8">${CSS}</head><body>
        <span class="badge">Purchase Invoice</span>
        <h1>${product.name}</h1>
        <p class="sub">Lot: ${lot?.lotNumber ?? '—'} &nbsp;·&nbsp; ${warehouse?.name ?? '—'} &nbsp;·&nbsp; ${dateStr}</p>
        <table>
          <tr><th>Product</th><td>${product.name}</td></tr>
          <tr><th>Lot Number</th><td>${lot?.lotNumber ?? '—'}</td></tr>
          <tr><th>Purchase Date</th><td>${dateStr}</td></tr>
          <tr><th>Warehouse</th><td>${warehouse?.name ?? '—'}</td></tr>
          <tr><th>Quantity</th><td>${originalQty.toLocaleString()} ${unitLabel}</td></tr>
          <tr><th>Unit Cost</th><td>${costMoney.format(Number(batch.unitCost))}</td></tr>
          <tr class="total-row"><th>Total Purchase Cost</th><td>${money.format(originalQty * Number(batch.unitCost))}</td></tr>
        </table>
        <p class="footer">Printed ${printedAt}</p>
      </body></html>`;
    } else {
      // Sales invoice — full breakdown
      const salesRows = filteredSales.map((item) => {
        const ts = new Date(item.sale.saleDate).toLocaleDateString(
          locale === 'bn' ? 'bn-BD' : 'en-GB',
          { day: 'numeric', month: 'short', year: 'numeric' },
        );
        return `<tr>
          <td><strong>${ts}</strong><br><span class="ts">${item.seller}</span></td>
          <td>${item.qty.toLocaleString()} ${unitLabel}</td>
          <td><strong>${money.format(item.rev)}</strong></td>
        </tr>`;
      }).join('');
      const { totalSold, totalQtySold, totalCost, profit, profitPct } = salesInvTotals;
      const profitColor = profit >= 0 ? '#00a86b' : '#cc2200';
      const profitSign = profit >= 0 ? '+' : '';

      html = `<html><head><meta charset="utf-8">${CSS}</head><body>
        <span class="badge">Sales Invoice</span>
        <h1>${product.name}</h1>
        <p class="sub">Lot: ${lot?.lotNumber ?? '—'} &nbsp;·&nbsp; ${filteredSales.length} transaction${filteredSales.length !== 1 ? 's' : ''}</p>
        <table>
          <tr><th>Date · Seller</th><th>Quantity</th><th>Revenue</th></tr>
          ${salesRows || '<tr><td colspan="3" style="text-align:center;color:#999">No sales recorded</td></tr>'}
          <tr class="total-row">
            <th>Total</th>
            <td>${totalQtySold.toLocaleString()} ${unitLabel}</td>
            <td>${money.format(totalSold)}</td>
          </tr>
        </table>
        <table style="margin-top:16px;border:2px solid ${profitColor}22;border-radius:8px;overflow:hidden">
          <tr><th style="background:#f8f8f8">Total Cost Price</th><td>${money.format(totalCost)}</td></tr>
          <tr><th style="background:#f8f8f8">Total Sold Price</th><td>${money.format(totalSold)}</td></tr>
          <tr style="background:${profitColor}11">
            <th style="color:${profitColor}">${profit >= 0 ? 'Total Profit' : 'Total Loss'}</th>
            <td style="color:${profitColor};font-size:17px;font-weight:bold">${profitSign}${money.format(profit)}</td>
          </tr>
          <tr style="background:${profitColor}08">
            <th style="color:${profitColor}">Profit %</th>
            <td style="color:${profitColor};font-weight:bold">${profit >= 0 ? '▲' : '▼'} ${Math.abs(profitPct).toFixed(1)}%</td>
          </tr>
        </table>
        <p class="footer">Printed ${printedAt}</p>
      </body></html>`;
    }
    try { await RNPrint.print({ html }); }
    catch { Alert.alert('Print', 'Could not open print dialog.'); }
  }

  if (!batch || !lot || !product) {
    return (
      <MeshBackground>
        <SafeAreaView style={s.notFound}>
          <Text style={s.notFoundText}>{t('pd.notFound')}</Text>
        </SafeAreaView>
      </MeshBackground>
    );
  }

  const purchaseDate = batch.acquiredAt
    ? new Date(batch.acquiredAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  const healthColor = isSold ? palette.rose : remainingQty <= originalQty * 0.2 ? '#FFD740' : palette.emerald;

  return (
    <MeshBackground>
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Pressable
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Work')}
            style={({ pressed }) => [s.back, pressed && { opacity: 0.7 }]}
            accessibilityRole="button">
            <Text style={s.backArrow} allowFontScaling={false}>‹</Text>
          </Pressable>
          <View style={s.headerInfo}>
            <Text style={s.productName} numberOfLines={1}>{product.name}</Text>
            {isSold ? (
              <View style={s.soldBadge}><Text style={s.soldBadgeText}>{t('feed.sold')}</Text></View>
            ) : (
              <View style={[s.remainingBadge, { borderColor: `${healthColor}45` }]}>
                <Text style={[s.remainingBigNum, { color: healthColor }]}>{remainingQty.toLocaleString()}</Text>
                <Text style={s.remainingUnit}>{unitLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tab Bar — full width, equal share per tab */}
        <View style={s.tabBarRow}>
          {TABS.map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <Pressable key={key} onPress={() => setActiveTab(key)} style={[s.tabItem, isActive && s.tabItemActive]}>
                <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>{label}</Text>
                {isActive && <View style={s.tabUnder} />}
              </Pressable>
            );
          })}
        </View>

        {/* Content */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.scrollInner, { paddingBottom: insets.bottom + 48 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <View style={s.tabContent}>
              <GlassCard style={s.heroCard}>
                <Row icon="📦" label={t('pd.overview.lot')} value={lot.lotNumber || '—'} />
                <Row icon="📅" label={t('pd.overview.date')} value={purchaseDate} />
                <Row icon="🏭" label={t('pd.overview.warehouse')} value={warehouse?.name ?? '—'} />
                <Row icon="💰" label={t('pd.overview.unitCost')} value={costMoney.format(Number(batch.unitCost))} accent />
                <Row icon="📊" label={t('pd.overview.originalQty')} value={`${originalQty.toLocaleString()} ${unitLabel}`} />
                <View style={s.totalCostRow}>
                  <Text style={s.totalCostLabel}>{t('pd.overview.totalCost')}</Text>
                  <Text style={s.totalCostValue}>{money.format(originalQty * Number(batch.unitCost))}</Text>
                </View>
              </GlassCard>
            </View>
          )}

          {/* ── LEFT ── */}
          {activeTab === 'left' && (
            <View style={s.tabContent}>
              <GlassCard style={[s.heroCard, { borderColor: `${healthColor}40` }]}>
                <Text style={s.leftLabel}>{t('pd.left.onHand')}</Text>
                <Text style={[s.leftBigNum, { color: healthColor }]}>
                  {remainingQty.toLocaleString()}<Text style={s.leftUnit}> {unitLabel}</Text>
                </Text>
                <View style={s.leftBarTrack}>
                  <View style={[s.leftBarFill, { width: `${100 - pctSold}%` as `${number}%`, backgroundColor: healthColor }]} />
                </View>
                <View style={s.leftLegend}>
                  <Text style={s.leftLegendText}>{t('pd.left.sold')}: {soldQty.toLocaleString()} {unitLabel}</Text>
                  <Text style={[s.leftLegendText, { color: healthColor }]}>{t('pd.left.pctSold', { pct: pctSold })}</Text>
                </View>
                <Text style={s.leftStatusText}>
                  {isSold ? t('pd.left.depleted') : remainingQty <= originalQty * 0.2 ? t('pd.left.low') : t('pd.left.healthy')}
                </Text>
              </GlassCard>
              <GlassCard style={s.card}>
                <StatRow label={t('pd.overview.originalQty')} value={`${originalQty.toLocaleString()} ${unitLabel}`} />
                <StatRow label={t('pd.left.sold')} value={`${soldQty.toLocaleString()} ${unitLabel}`} />
                <StatRow label={t('pd.left.onHand')} value={`${remainingQty.toLocaleString()} ${unitLabel}`} accent />
                {totalRevenue > 0 && <StatRow label={t('pd.sales.totalRev')} value={money.format(totalRevenue)} accent />}
              </GlassCard>
            </View>
          )}

          {/* ── SALES (with filters) ── */}
          {activeTab === 'sales' && (
            <View style={s.tabContent}>
              {/* Filter card — compact */}
              <View style={s.filterCard}>
                <SelectMenu
                  label={t('pd.sales.filter.allPeople')}
                  value={salesPersonFilter}
                  options={salesPersonOptions}
                  onChange={setSalesPersonFilter}
                />

                <View style={s.filterDivider} />

                <View style={s.dateChipRow}>
                  <Pressable
                    onPress={() => setCalendarOpen((v) => !v)}
                    style={({ pressed }) => [s.dateChip, (selectedDate || calendarOpen) && s.dateChipActive, pressed && { opacity: 0.8 }]}>
                    <Text style={s.dateChipIcon}>🗓</Text>
                    <Text style={[s.dateChipLabel, selectedDate && s.dateChipLabelActive]} numberOfLines={1}>
                      {selectedDate
                        ? new Date(selectedDate).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : locale === 'bn' ? 'তারিখ ফিল্টার' : 'Filter by date'}
                    </Text>
                  </Pressable>
                  {selectedDate && (
                    <Pressable onPress={() => setSelectedDate(null)} style={s.clearDateChip}>
                      <Text style={s.clearDateChipText}>✕ {locale === 'bn' ? 'পরিষ্কার' : 'Clear'}</Text>
                    </Pressable>
                  )}
                </View>

                {calendarOpen && (
                  <View style={s.inlineCalendar}>
                    <Calendar
                      current={selectedDate ?? undefined}
                      markedDates={markedDates}
                      onDayPress={(d) => { setSelectedDate(d.dateString); setCalendarOpen(false); }}
                      enableSwipeMonths
                      theme={calendarTheme}
                    />
                  </View>
                )}
              </View>

              {/* Summary chips — different colours */}
              <View style={s.summaryRow}>
                <SummaryChip
                  label={t('pd.sales.totalQty')}
                  value={`${filteredSales.reduce((a, x) => a + x.qty, 0).toLocaleString()} ${unitLabel}`}
                  accentColor={palette.emerald}
                />
                <SummaryChip
                  label={t('pd.sales.totalRev')}
                  value={money.format(filteredSales.reduce((a, x) => a + x.rev, 0))}
                  accentColor={palette.violet}
                />
                <SummaryChip
                  label={t('pd.sales.orders')}
                  value={String(filteredSales.length)}
                  accentColor="#34CFFF"
                />
              </View>

              {/* Production usage — treated as transfer at cost price */}
              {qtyUsedInProduction > 0 && (
                <View style={[s.saleCard, { borderColor: `${palette.violet}40`, borderWidth: 1 }]}>
                  <View style={s.saleCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.saleDate}>
                        {lotProductionConsumptions[0]?.startDate ?? batch?.acquiredAt ?? '—'}
                      </Text>
                      <Text style={[s.saleSeller, { color: palette.violet }]}>
                        ⚙️ {locale === 'bn' ? 'উৎপাদনে ব্যবহৃত' : 'Used in Production'}
                      </Text>
                      {lotProductionConsumptions[0] && (
                        <Text style={[s.saleSeller, { color: `${palette.violet}99`, fontSize: 11, marginTop: 1 }]}>
                          {lotProductionConsumptions[0].productionNumber}
                        </Text>
                      )}
                    </View>
                    <View style={s.saleRight}>
                      <Text style={[s.saleRev, { color: palette.violet }]}>
                        {money.format(qtyUsedInProduction * Number(batch?.unitCost ?? 0))}
                      </Text>
                      <Text style={s.saleQty}>{qtyUsedInProduction.toLocaleString()} {unitLabel}</Text>
                      <Text style={[s.saleQty, { fontSize: 10, color: palette.textMuted, marginTop: 1 }]}>
                        @ {costMoney.format(Number(batch?.unitCost ?? 0))}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {filteredSales.length === 0 && qtyUsedInProduction === 0 ? (
                <GlassCard style={s.emptyCard}>
                  <Text style={s.emptyTitle}>{t('pd.sales.noSales')}</Text>
                  <Text style={s.emptyBody}>{t('pd.sales.noSalesBody')}</Text>
                </GlassCard>
              ) : (
                filteredSales.map((item) => (
                  <Pressable
                    key={item.sale.id}
                    onPress={() => navigation.navigate('SaleDetails', { saleId: item.sale.id })}
                    style={({ pressed }) => [s.saleCard, pressed && { opacity: 0.82 }]}>
                    <View style={s.saleCardTop}>
                      <View>
                        <Text style={s.saleDate}>{item.sale.saleDate}</Text>
                        <Text style={s.saleSeller}>{item.seller}</Text>
                      </View>
                      <View style={s.saleRight}>
                        <Text style={s.saleRev}>{money.format(item.rev)}</Text>
                        <Text style={s.saleQty}>{item.qty.toLocaleString()} {unitLabel}</Text>
                        <Text style={s.saleArrow}>›</Text>
                      </View>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          )}

          {/* ── SELL ── */}
          {activeTab === 'sell' && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={s.tabContent}>

                {/* Cost price + available strip */}
                {/* Live pill — right-aligned above the context bar */}
                {(activeViews.find(v => v.lotBatchId === lotBatchId)?.users ?? []).filter(u => u.id !== currentUserId).length > 0 && (() => {
                  const others = (activeViews.find(v => v.lotBatchId === lotBatchId)?.users ?? []).filter(u => u.id !== currentUserId);
                  return (
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={s.sellLivePill}>
                        <PulseDot color={palette.rose} />
                        <Text style={s.sellLiveText}>
                          {others.length === 1 ? others[0].name.split(' ')[0] : `${others.length}`}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                <View style={s.sellContextBar}>

                  <View style={s.sellContextCell}>
                    <Text style={s.sellContextIcon}>💰</Text>
                    <View>
                      <Text style={s.sellContextLabel}>{locale === 'bn' ? 'ক্রয় মূল্য' : 'Cost Price'}</Text>
                      <Text style={s.sellContextValue}>{costMoney.format(Number(batch.unitCost))}</Text>
                      <Text style={s.sellContextSub}>{locale === 'bn' ? 'প্রতি একক' : 'per unit'}</Text>
                    </View>
                  </View>

                  <View style={s.sellContextDivider} />

                  <View style={[s.sellContextCell, { alignItems: 'flex-end' }]}>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <Text style={s.sellContextLabel}>{locale === 'bn' ? 'উপলব্ধ' : 'Available'}</Text>
                      <Text style={[s.sellContextValue, { color: healthColor }]}>
                        {remainingQty.toLocaleString()}
                      </Text>
                      <Text style={s.sellContextSub}>{unitLabel}</Text>
                    </View>
                    <Text style={[s.sellContextIcon, { color: healthColor, marginLeft: 8 }]}>📦</Text>
                  </View>
                </View>

                {isBottleMode ? (
                  /* ── Bottle mode: oil price per liter + bottle counts ── */
                  <GlassCard style={[s.card, { borderColor: `${palette.violet}35`, borderWidth: 1 }]}>
                    <Text style={[s.fieldLabel, { color: palette.violet, fontSize: 13, fontWeight: '900', marginBottom: 12 }]}>
                      🍶 {locale === 'bn' ? 'বোতলে বিক্রয়' : 'Sell in Bottles'}
                    </Text>

                    {/* Oil price per liter — single price input */}
                    <Text style={s.fieldLabel}>{locale === 'bn' ? 'তেলের দাম (প্রতি লিটার)' : 'Oil price per litre'}</Text>
                    <TextInput
                      style={s.input}
                      value={oilPricePerLiter}
                      onChangeText={setOilPricePerLiter}
                      keyboardType="numeric" placeholder="0"
                      placeholderTextColor={palette.textMuted} selectTextOnFocus
                    />

                    <View style={{ marginTop: 14 }}>
                      {BOTTLE_SIZES.filter(s2 => productionBottlePrices[String(s2)] != null).map(size => {
                        const key = String(size);
                        const count = Number(bottleCounts[key]) || 0;
                        const bc = productionBottlePrices[key] ?? 0;
                        const oilP = Number(oilPricePerLiter) || 0;
                        const perBottle = size * oilP + bc;
                        return (
                          <View key={key} style={{ marginBottom: 12 }}>
                            <View style={s.formRow}>
                              <View style={s.formHalf}>
                                <Text style={s.fieldLabel}>{size}L {locale === 'bn' ? 'বোতল সংখ্যা' : 'bottles'}</Text>
                                <TextInput
                                  style={s.input}
                                  value={bottleCounts[key] ?? ''}
                                  onChangeText={v => setBottleCounts(p => ({ ...p, [key]: v }))}
                                  keyboardType="numeric" placeholder="0"
                                  placeholderTextColor={palette.textMuted} selectTextOnFocus
                                />
                              </View>
                              {/* Bottle cost — read-only from production */}
                              <View style={s.formHalf}>
                                <Text style={s.fieldLabel}>{locale === 'bn' ? 'বোতল খরচ' : 'Bottle cost'}</Text>
                                <View style={[s.input, { justifyContent: 'center', backgroundColor: `${palette.violet}08`, borderColor: `${palette.violet}30` }]}>
                                  <Text style={{ color: palette.violet, fontSize: 14, fontWeight: '800' }}>{costMoney.format(bc)}</Text>
                                </View>
                              </View>
                            </View>
                            {count > 0 && oilP > 0 && (
                              <View style={{ backgroundColor: `${palette.violet}10`, borderRadius: 6, padding: 8, marginTop: 2, borderWidth: 1, borderColor: `${palette.violet}20` }}>
                                <Text style={{ color: `${palette.violet}cc`, fontSize: 11, fontWeight: '700' }}>
                                  {count} × ({size}L × {costMoney.format(oilP)} + {costMoney.format(bc)}) = {costMoney.format(perBottle)}{locale === 'bn' ? '/বোতল' : '/bottle'}
                                </Text>
                                <Text style={{ color: palette.violet, fontSize: 12, fontWeight: '900', marginTop: 2 }}>
                                  {locale === 'bn' ? 'মোট' : 'Total'}: {money.format(count * perBottle)}
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    {/* Overflow warning */}
                    {bottleOverflow && (
                      <View style={{ backgroundColor: `${palette.rose}14`, borderRadius: 6, padding: 8, marginTop: 4, borderWidth: 1, borderColor: `${palette.rose}40` }}>
                        <Text style={{ color: palette.rose, fontSize: 12, fontWeight: '900' }}>
                          ⚠️ {locale === 'bn' ? `মজুদ ${remainingQty}L কিন্তু বোতলে ${totalBottleLiters}L` : `Only ${remainingQty}L in stock, bottles need ${totalBottleLiters}L`}
                        </Text>
                      </View>
                    )}

                    {/* Grand total summary */}
                    {totalBottleLiters > 0 && Number(oilPricePerLiter) > 0 && (
                      <View style={{ borderTopWidth: 1, borderTopColor: `${palette.violet}25`, marginTop: 12, paddingTop: 10, gap: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ color: palette.textMuted, fontSize: 12, fontWeight: '700' }}>{locale === 'bn' ? 'মোট তেল' : 'Total oil'}</Text>
                          <Text style={{ color: palette.text, fontSize: 12, fontWeight: '900' }}>{totalBottleLiters}L</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ color: palette.textMuted, fontSize: 12, fontWeight: '700' }}>{locale === 'bn' ? 'কার্যকর মূল্য/লিটার' : 'Effective price/litre'}</Text>
                          <Text style={{ color: palette.violet, fontSize: 12, fontWeight: '900' }}>{costMoney.format(bottleEffectiveUnitPrice)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                          <Text style={{ color: palette.text, fontSize: 13, fontWeight: '900' }}>{locale === 'bn' ? 'মোট বিক্রয়' : 'Grand Total'}</Text>
                          <Text style={{ color: palette.emerald, fontSize: 15, fontWeight: '900' }}>{money.format(bottleGrandTotal)}</Text>
                        </View>
                      </View>
                    )}
                  </GlassCard>
                ) : (
                  /* ── Regular mode: qty + unit price ── */
                  <GlassCard style={s.card}>
                    <View style={s.formRow}>
                      <View style={s.formHalf}>
                        <Text style={s.fieldLabel}>{t('product.sell.qty')}</Text>
                        <TextInput style={s.input} value={sellQty} onChangeText={setSellQty} keyboardType="numeric" placeholder="0" placeholderTextColor={palette.textMuted} selectTextOnFocus />
                      </View>
                      <View style={s.formHalf}>
                        <Text style={s.fieldLabel}>{t('product.sell.unitPrice')}</Text>
                        <TextInput style={s.input} value={sellPrice} onChangeText={setSellPrice} keyboardType="numeric" placeholder="0" placeholderTextColor={palette.textMuted} selectTextOnFocus />
                      </View>
                    </View>
                    {Number(sellQty) > 0 && Number(sellPrice) > 0 && (
                      <View style={s.orderPreview}>
                        <Text style={s.orderPreviewLabel}>{t('product.sell.orderTotal')}</Text>
                        <Text style={s.orderPreviewValue}>{money.format(Number(sellQty) * Number(sellPrice))}</Text>
                      </View>
                    )}
                  </GlassCard>
                )}

                <Pressable onPress={handleSell} disabled={busy || isSold || bottleOverflow} style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.85 }, (busy || isSold || bottleOverflow) && { opacity: 0.5 }]}>
                  {busy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={s.actionBtnText}>{t('product.sell.submit')}</Text>}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}

          {/* ── BUY ── */}
          {activeTab === 'buy' && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={s.tabContent}>
                <GlassCard style={s.card}>
                  {/* Warehouse — optional, defaults to Direct */}
                  <View style={s.warehouseOptRow}>
                    <Text style={s.fieldLabel}>{t('product.buy.destWarehouse')}</Text>
                    <Text style={s.warehouseOptHint}>{locale === 'bn' ? 'ঐচ্ছিক · ডিফল্ট: Direct' : 'optional · default: Direct'}</Text>
                  </View>
                  <SelectMenu
                    label={locale === 'bn' ? 'গুদাম' : 'Warehouse'}
                    value={buyWarehouseId}
                    options={[
                      { value: '', label: locale === 'bn' ? 'Direct (ডিফল্ট)' : 'Direct (default)' },
                      ...warehouseOptions.filter((w) => w.label.toLowerCase() !== 'direct'),
                    ]}
                    onChange={setBuyWarehouseId}
                  />

                  <View style={[s.formRow, { marginTop: 14 }]}>
                    <View style={s.formHalf}>
                      <Text style={s.fieldLabel}>{t('product.buy.qty')}</Text>
                      <TextInput style={s.input} value={buyQty} onChangeText={setBuyQty} keyboardType="numeric" placeholder="0" placeholderTextColor={palette.textMuted} selectTextOnFocus />
                    </View>
                    <View style={s.formHalf}>
                      <Text style={s.fieldLabel}>{t('product.buy.unitCost')}</Text>
                      <TextInput style={s.input} value={buyUnitCost} onChangeText={setBuyUnitCost} keyboardType="numeric" placeholder="0" placeholderTextColor={palette.textMuted} selectTextOnFocus />
                    </View>
                  </View>

                  <Text style={[s.fieldLabel, { marginTop: 14 }]}>{t('product.buy.extraCost')}</Text>
                  <Text style={s.extraCostHint}>{t('product.buy.extraCostHint')}</Text>
                  <TextInput style={s.input} value={buyExtraCost} onChangeText={setBuyExtraCost} keyboardType="numeric" placeholder="0" placeholderTextColor={palette.textMuted} selectTextOnFocus />

                  <Text style={[s.fieldLabel, { marginTop: 14 }]}>{t('product.buy.lotNumber')} <Text style={s.optionalInline}>{t('product.buy.optional')}</Text></Text>
                  <TextInput style={s.input} value={buyLotNumber} onChangeText={setBuyLotNumber} placeholder="e.g. LOT-2026-001" placeholderTextColor={palette.textMuted} autoCapitalize="characters" />

                  {/* Cost breakdown */}
                  {Number(buyQty) > 0 && Number(buyUnitCost) > 0 && (() => {
                    const qty = Number(buyQty);
                    const cost = Number(buyUnitCost);
                    const extra = Number(buyExtraCost) || 0;
                    const baseTot = qty * cost;
                    const totalLanded = baseTot + extra;
                    const effectiveUnit = totalLanded / qty;
                    return (
                      <View style={s.costBreakdown}>
                        <CostRow label={t('product.buy.baseCost')} value={money.format(baseTot)} />
                        {extra > 0 && <CostRow label={t('product.buy.extraCost')} value={`+ ${money.format(extra)}`} muted />}
                        <View style={s.costBreakdownDivider} />
                        <CostRow label={t('product.buy.totalLanded')} value={money.format(totalLanded)} />
                        <CostRow label={t('product.buy.effectiveUnitCost')} value={costMoney.format(effectiveUnit)} accent />
                      </View>
                    );
                  })()}
                </GlassCard>

                <Pressable onPress={handleBuy} disabled={buyBusy} style={({ pressed }) => [s.actionBtn, { backgroundColor: palette.violet, shadowColor: palette.violet }, pressed && { opacity: 0.85 }, buyBusy && { opacity: 0.5 }]}>
                  {buyBusy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={s.actionBtnText}>{t('product.buy.submit')}</Text>}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}

          {/* ── INVOICE ── */}
          {activeTab === 'invoice' && (
            <View style={s.tabContent}>
              {/* Left-side badge selectors */}
              <View style={s.invTypeBadges}>
                <Pressable
                  onPress={() => setInvoiceType('purchase')}
                  style={[s.invBadge, invoiceType === 'purchase' && s.invBadgeActive]}>
                  <Text style={[s.invBadgeText, invoiceType === 'purchase' && s.invBadgeTextActive]}>
                    🛒 {locale === 'bn' ? 'ক্রয় রসিদ' : 'Purchase'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setInvoiceType('sales')}
                  style={[s.invBadge, invoiceType === 'sales' && s.invBadgeActive]}>
                  <Text style={[s.invBadgeText, invoiceType === 'sales' && s.invBadgeTextActive]}>
                    💰 {locale === 'bn' ? 'বিক্রয় রসিদ' : 'Sales'}
                  </Text>
                </Pressable>
              </View>

              {/* Purchase Invoice */}
              {invoiceType === 'purchase' && (
                <GlassCard style={s.invoiceCard}>
                  <View style={s.invoiceHeader}>
                    <View style={s.invTypePill}>
                      <Text style={s.invTypePillText}>{locale === 'bn' ? 'ক্রয় রসিদ' : 'Purchase Invoice'}</Text>
                    </View>
                    <Text style={s.invoiceProductName}>{product.name}</Text>
                    <Text style={s.invoiceSubLine}>{lot.lotNumber || '—'}  ·  {purchaseDate}</Text>
                  </View>
                  <View style={s.invoiceTable}>
                    <InvoiceRow label={t('pd.invoice.product')} value={product.name} />
                    <InvoiceRow label={t('pd.invoice.lot')} value={lot.lotNumber || '—'} />
                    <InvoiceRow label={t('pd.invoice.date')} value={purchaseDate} />
                    <InvoiceRow label={t('pd.invoice.warehouse')} value={warehouse?.name ?? '—'} />
                    <InvoiceRow label={t('pd.invoice.qty')} value={`${originalQty.toLocaleString()} ${unitLabel}`} />
                    <InvoiceRow label={t('pd.invoice.unitCost')} value={costMoney.format(Number(batch.unitCost))} />
                    <View style={s.invoiceTotalRow}>
                      <Text style={s.invoiceTotalLabel}>{t('pd.invoice.total')}</Text>
                      <Text style={s.invoiceTotalValue}>{money.format(originalQty * Number(batch.unitCost))}</Text>
                    </View>
                  </View>
                </GlassCard>
              )}

              {/* Sales Invoice */}
              {invoiceType === 'sales' && (
                <GlassCard style={s.invoiceCard}>
                  <View style={s.invoiceHeader}>
                    <View style={[s.invTypePill, s.invTypePillSales]}>
                      <Text style={[s.invTypePillText, { color: palette.violet }]}>{locale === 'bn' ? 'বিক্রয় রসিদ' : 'Sales Invoice'}</Text>
                    </View>
                    <View style={s.invoiceProductRow}>
                      <Text style={[s.invoiceProductName, { flex: 1 }]} numberOfLines={1}>{product.name}</Text>
                      {!!unitLabel && (
                        <View style={s.invoiceUnitPill}>
                          <Text style={s.invoiceUnitText}>{unitLabel}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.invoiceSubLine}>
                      {filteredSales.length + (qtyUsedInProduction > 0 ? 1 : 0)} {locale === 'bn' ? 'লেনদেন' : 'transaction'}{(filteredSales.length + (qtyUsedInProduction > 0 ? 1 : 0)) !== 1 ? 's' : ''}
                      {' · '}{lot.lotNumber || '—'}
                    </Text>
                  </View>

                  {/* Sales rows */}
                  {filteredSales.length === 0 && qtyUsedInProduction === 0 ? (
                    <Text style={s.invEmptyText}>{t('pd.sales.noSalesBody')}</Text>
                  ) : (
                    <View style={s.salesInvoiceTable}>
                      {/* Header — Seller | Qty | Revenue */}
                      <View style={[s.salesInvRow, s.salesInvHeaderRow]}>
                        <Text style={[s.salesInvCell, s.salesInvHeader, s.salesInvDateSellerCol]} numberOfLines={1}>
                          {locale === 'bn' ? 'বিক্রেতা' : 'Seller'}
                        </Text>
                        <Text style={[s.salesInvCell, s.salesInvHeader]} numberOfLines={1}>
                          {locale === 'bn' ? 'পরিমাণ' : 'Qty'}
                        </Text>
                        <Text style={[s.salesInvCell, s.salesInvHeader, s.salesInvRevenue]} numberOfLines={1}>
                          {locale === 'bn' ? 'আয়' : 'Revenue'}
                        </Text>
                      </View>

                      {filteredSales.map((item, i) => (
                        <View key={item.sale.id} style={[s.salesInvRow, i % 2 === 1 && s.salesInvRowAlt]}>
                          <View style={s.salesInvDateSellerCol}>
                            <Text style={s.salesInvDateLine} numberOfLines={1}>
                              {new Date(item.sale.saleDate).toLocaleDateString(
                                locale === 'bn' ? 'bn-BD' : 'en-GB',
                                { day: 'numeric', month: 'short', year: 'numeric' },
                              )}
                            </Text>
                            <Text style={s.salesInvSellerLine} numberOfLines={1}>{item.seller}</Text>
                          </View>
                          <Text style={s.salesInvCell} numberOfLines={1}>{item.qty.toLocaleString()}</Text>
                          <Text style={[s.salesInvCell, s.salesInvRevenue]} numberOfLines={1}>{money.format(item.rev)}</Text>
                        </View>
                      ))}

                      {/* Production consumption row — at cost price (0 profit) */}
                      {qtyUsedInProduction > 0 && (
                        <View style={[s.salesInvRow, { backgroundColor: `${palette.violet}12` }]}>
                          <View style={s.salesInvDateSellerCol}>
                            <Text style={[s.salesInvDateLine, { color: palette.violet }]} numberOfLines={1}>
                              {lotProductionConsumptions[0]?.startDate
                                ? new Date(lotProductionConsumptions[0].startDate).toLocaleDateString(
                                    locale === 'bn' ? 'bn-BD' : 'en-GB',
                                    { day: 'numeric', month: 'short', year: 'numeric' },
                                  )
                                : (batch?.acquiredAt ?? '—')}
                            </Text>
                            <Text style={[s.salesInvSellerLine, { color: `${palette.violet}cc` }]} numberOfLines={1}>
                              ⚙️ {lotProductionConsumptions[0]?.productionNumber ?? (locale === 'bn' ? 'উৎপাদন' : 'Production')}
                            </Text>
                          </View>
                          <Text style={[s.salesInvCell, { color: palette.violet }]} numberOfLines={1}>
                            {qtyUsedInProduction.toLocaleString()}
                          </Text>
                          <Text style={[s.salesInvCell, s.salesInvRevenue, { color: palette.violet }]} numberOfLines={1}>
                            {money.format(salesInvTotals.prodRevenue)}
                          </Text>
                        </View>
                      )}

                      {/* Totals row */}
                      <View style={s.salesInvTotalRow}>
                        <Text style={[s.salesInvCell, s.salesInvTotalLabel, s.salesInvDateSellerCol]} numberOfLines={1}>
                          {locale === 'bn' ? 'মোট' : 'Total'}
                        </Text>
                        <Text style={[s.salesInvCell, s.salesInvTotalLabel]} numberOfLines={1}>
                          {salesInvTotals.totalQtySold.toLocaleString()}
                        </Text>
                        <Text style={[s.salesInvCell, s.salesInvTotalValue, s.salesInvRevenue]} numberOfLines={1}>
                          {money.format(salesInvTotals.totalSold)}
                        </Text>
                      </View>

                      {/* Profit summary — only when fully sold */}
                      {isSold && (
                        <View style={[s.profitSummary, salesInvTotals.profit >= 0 ? s.profitSummaryPos : s.profitSummaryNeg]}>
                          <View style={s.profitRow}>
                            <Text style={s.profitLabel}>{locale === 'bn' ? 'মোট ক্রয় মূল্য' : 'Total Cost Price'}</Text>
                            <Text style={s.profitVal}>{money.format(salesInvTotals.totalCost)}</Text>
                          </View>
                          <View style={s.profitRow}>
                            <Text style={s.profitLabel}>{locale === 'bn' ? 'মোট বিক্রয় মূল্য' : 'Total Sold Price'}</Text>
                            <Text style={s.profitVal}>{money.format(salesInvTotals.totalSold)}</Text>
                          </View>
                          <View style={s.profitDivider} />
                          <View style={s.profitRow}>
                            <Text style={s.profitBigLabel}>
                              {salesInvTotals.profit >= 0
                                ? (locale === 'bn' ? 'মোট মুনাফা' : 'Total Profit')
                                : (locale === 'bn' ? 'মোট ক্ষতি' : 'Total Loss')}
                            </Text>
                            <Text style={[s.profitBigVal, { color: salesInvTotals.profit >= 0 ? palette.success : palette.rose }]}>
                              {salesInvTotals.profit >= 0 ? '+' : ''}{money.format(salesInvTotals.profit)}
                            </Text>
                          </View>
                          <View style={[s.profitPctBadge, { backgroundColor: salesInvTotals.profit >= 0 ? 'rgba(0,214,143,0.15)' : 'rgba(255,59,92,0.13)' }]}>
                            <Text style={[s.profitPctText, { color: salesInvTotals.profit >= 0 ? palette.success : palette.rose }]}>
                              {salesInvTotals.profit >= 0 ? '▲' : '▼'} {Math.abs(salesInvTotals.profitPct).toFixed(1)}%{' '}
                              {salesInvTotals.profit >= 0
                                ? (locale === 'bn' ? 'মুনাফা' : 'profit')
                                : (locale === 'bn' ? 'ক্ষতি' : 'loss')}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </GlassCard>
              )}

              {/* Print button */}
              <Pressable
                onPress={() => handlePrint(invoiceType)}
                style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.85 }]}>
                <Text style={s.actionBtnText}>🖨  {t('pd.invoice.print')}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </MeshBackground>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CostRow({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: boolean }) {
  return (
    <View style={crS.row}>
      <Text style={crS.label}>{label}</Text>
      <Text style={[crS.value, muted && crS.muted, accent && crS.accent]}>{value}</Text>
    </View>
  );
}
const crS = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  label: { color: palette.textMuted, fontSize: 12, fontWeight: '700', flex: 1 },
  value: { color: palette.text, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  muted: { color: palette.textMuted },
  accent: { color: palette.emerald, fontSize: 15 },
});

function Row({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <View style={rowS.row}>
      <Text style={rowS.icon}>{icon}</Text>
      <Text style={rowS.label}>{label}</Text>
      <Text style={[rowS.value, accent && rowS.accent]}>{value}</Text>
    </View>
  );
}
const rowS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  icon: { fontSize: 15, width: 22 },
  label: { color: palette.textMuted, fontSize: 13, fontWeight: '700', flex: 1 },
  value: { color: palette.text, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  accent: { color: palette.emerald },
});

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={statS.row}>
      <Text style={statS.label}>{label}</Text>
      <Text style={[statS.value, accent && statS.accent]}>{value}</Text>
    </View>
  );
}
const statS = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.cardBorder },
  label: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  value: { color: palette.text, fontSize: 14, fontWeight: '900' },
  accent: { color: palette.emerald },
});

function SummaryChip({ label, value, accentColor }: { label: string; value: string; accentColor?: string }) {
  return (
    <View style={[
      chipS.wrap,
      accentColor && { borderColor: `${accentColor}35`, backgroundColor: `${accentColor}0E` },
    ]}>
      <Text style={chipS.label}>{label}</Text>
      <Text style={[chipS.value, accentColor && { color: accentColor }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}
const chipS = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.cardBgElevated, borderWidth: 1, borderColor: palette.cardBorder, borderRadius: radii.md, padding: 12, alignItems: 'center' },
  label: { color: palette.textMuted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  value: { color: palette.text, fontSize: 13, fontWeight: '900', textAlign: 'center' },
});

function InvoiceRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={invS.row}>
      <Text style={invS.label}>{label}</Text>
      <Text style={invS.value}>{value}</Text>
    </View>
  );
}
const invS = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: palette.cardBorder },
  label: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  value: { color: palette.text, fontSize: 13, fontWeight: '900' },
});

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: palette.rose, fontSize: 16, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10, gap: 14 },
  back: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.stroke, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: palette.emerald, fontSize: Platform.OS === 'android' ? 26 : 28, fontWeight: Platform.OS === 'android' ? '700' : '300', lineHeight: 32, includeFontPadding: false },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  productName: { flex: 1, color: palette.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  soldBadge: {
    backgroundColor: 'rgba(255,59,92,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,92,0.55)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    shadowColor: '#FF3B5C',
    shadowOpacity: 0.80,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  soldBadgeText: { color: palette.rose, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' as const, letterSpacing: 0.6 },
  remainingBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: palette.cardBgElevated,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 3,
  },
  remainingBigNum: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  remainingUnit: { color: palette.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },

  tabBarRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 2, gap: 4 },
  tabItem: { flex: 1, paddingVertical: 10, borderRadius: radii.md, position: 'relative', alignItems: 'center' },
  tabItemActive: { backgroundColor: palette.paper, shadowColor: palette.emerald, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 3 }, elevation: 9 },
  tabLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  tabLabelActive: { color: palette.emerald, fontWeight: '900', textShadowColor: 'rgba(0,168,255,0.55)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  tabUnder: { position: 'absolute', bottom: 4, width: 26, height: 2.5, backgroundColor: palette.emerald, borderRadius: 999, shadowColor: palette.emerald, shadowOpacity: 0.80, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },

  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: 10, paddingTop: 12, gap: 14 },
  tabContent: { gap: 14 },

  heroCard: { padding: 18, gap: 4, backgroundColor: palette.cardBgPrimary, borderWidth: 1, borderColor: palette.cardBorderAccent },
  card: { padding: 18, gap: 12, backgroundColor: palette.cardBg, borderWidth: 1, borderColor: palette.cardBorder },

  totalCostRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.cardBorder },
  totalCostLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  totalCostValue: { color: palette.emerald, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },

  leftLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  leftBigNum: { fontSize: 44, fontWeight: '900', letterSpacing: -1.5, marginTop: 4 },
  leftUnit: { fontSize: 20, fontWeight: '700', letterSpacing: 0, color: palette.textMuted },
  leftBarTrack: { height: 8, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 999, overflow: 'hidden', marginTop: 14 },
  leftBarFill: { height: '100%', borderRadius: 999 },
  leftLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  leftLegendText: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  leftStatusText: { color: palette.textLabel, fontSize: 13, fontWeight: '800', marginTop: 6 },

  summaryRow: { flexDirection: 'row', gap: 10 },
  dateFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  dateBtn: { flex: 1, backgroundColor: palette.inputInset, borderWidth: 1, borderColor: palette.stroke, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 11 },
  dateBtnText: { color: palette.text, fontSize: 13, fontWeight: '800' },
  clearBtn: { width: 36, height: 36, borderRadius: radii.sm, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.stroke, alignItems: 'center', justifyContent: 'center' },
  clearBtnText: { color: palette.textMuted, fontSize: 14, fontWeight: '900' },

  saleCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.cardBg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    borderRadius: radii.lg,
  },
  saleCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  saleDate: { color: palette.text, fontSize: 14, fontWeight: '900' },
  saleSeller: { color: palette.textMuted, fontSize: 12, fontWeight: '700', marginTop: 3 },
  saleRight: { alignItems: 'flex-end' },
  saleRev: { color: palette.emerald, fontSize: 17, fontWeight: '900' },
  saleQty: { color: palette.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  saleArrow: { color: palette.emerald, fontSize: 18, fontWeight: '900', marginTop: 4, textAlign: 'right' as const },

  sellHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sellHeroIcon: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: 'rgba(0,168,255,0.14)', borderWidth: 1, borderColor: 'rgba(0,168,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  sellHeroTitle: { color: palette.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  sellHeroSub: { color: palette.textMuted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  availBox: { backgroundColor: 'rgba(0,168,255,0.10)', borderWidth: 1, borderColor: 'rgba(0,168,255,0.22)', borderRadius: radii.sm, padding: 10, alignItems: 'center' },
  availLabel: { color: palette.textMuted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  availValue: { color: palette.emerald, fontSize: 20, fontWeight: '900', marginTop: 2 },

  formRow: { flexDirection: 'row', gap: 12 },
  formHalf: { flex: 1 },
  fieldLabel: { color: palette.textLabel, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input: { backgroundColor: palette.inputInset, borderWidth: 1, borderColor: palette.stroke, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 13, color: palette.text, fontSize: 16, fontWeight: '800' },
  orderPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: palette.cardBorder },
  orderPreviewLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  orderPreviewValue: { color: palette.emerald, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },

  actionBtn: { backgroundColor: palette.emerald, borderRadius: radii.lg, paddingVertical: 18, alignItems: 'center', shadowColor: palette.emerald, shadowOpacity: 0.75, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 14 },
  actionBtnText: { color: palette.onAccent, fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },

  invoiceTitle: { color: palette.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3, marginBottom: 12 },
  invoiceTable: { gap: 0 },
  invoiceTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, marginTop: 4 },
  invoiceTotalLabel: { color: palette.text, fontSize: 15, fontWeight: '900' },
  invoiceTotalValue: { color: palette.emerald, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },

  emptyCard: { padding: 40, alignItems: 'center', gap: 10 },
  emptyTitle: { color: palette.text, fontSize: 17, fontWeight: '900' },
  emptyBody: { color: palette.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  extraCostHint: { color: palette.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 8, marginTop: -4 },
  optionalInline: { fontWeight: '600', textTransform: 'none' as const, letterSpacing: 0, fontSize: 11 },
  costBreakdown: {
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 0,
  },
  costBreakdownDivider: { height: 1, backgroundColor: palette.cardBorder, marginVertical: 6 },

  // ── Invoice tab ──────────────────────────────────────────────────────────────
  invTypeBadges: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  invBadge: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.md,
    backgroundColor: palette.cardBgElevated,
    borderWidth: 1,
    borderColor: palette.cardBorder,
  },
  invBadgeActive: {
    backgroundColor: palette.emeraldLight,
    borderColor: `${palette.emerald}60`,
  },
  invBadgeText: { color: palette.textMuted, fontSize: 13, fontWeight: '800' },
  invBadgeTextActive: { color: palette.emerald },

  invoiceCard: {
    paddingHorizontal: 6,
    paddingVertical: 12,
    gap: 0,
    backgroundColor: palette.cardBgPrimary,
    borderWidth: 1,
    borderColor: palette.cardBorderAccent,
  },
  invoiceHeader: { marginBottom: 14, gap: 4 },
  invTypePill: {
    alignSelf: 'flex-start' as const,
    backgroundColor: palette.emeraldLight,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  invTypePillSales: { backgroundColor: 'rgba(255,179,0,0.14)' },
  invTypePillText: { color: palette.emerald, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  invoiceProductName: { color: palette.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  invoiceSubLine: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  invEmptyText: { color: palette.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' as const, paddingVertical: 20 },

  salesInvoiceTable: { marginTop: 4 },
  salesInvRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.cardBorder,
  },
  salesInvHeaderRow: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: radii.sm,
    borderBottomWidth: 0,
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  salesInvRowAlt: { backgroundColor: 'rgba(0,0,0,0.08)' },
  salesInvCell: { flex: 1, color: palette.text, fontSize: 12, fontWeight: '700', paddingHorizontal: 2 },
  salesInvHeader: { color: palette.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  salesInvTimestamp: { color: palette.textMuted, fontSize: 10, fontWeight: '600', marginTop: 1, paddingHorizontal: 2 },
  salesInvRevenue: { flex: 1.8, color: palette.emerald, fontWeight: '900', fontSize: 12, textAlign: 'right' as const, paddingRight: 4 },
  salesInvDateSellerCol: { flex: 2, paddingHorizontal: 2 },
  salesInvTotalRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: palette.cardBorderAccent,
  },
  salesInvTotalLabel: { color: palette.text, fontSize: 13, fontWeight: '900' },
  salesInvTotalValue: { color: palette.emerald, fontSize: 15, fontWeight: '900', textAlign: 'right' as const },

  // Combined date+seller column
  salesInvDateLine: { color: palette.text, fontSize: 12, fontWeight: '800', paddingHorizontal: 0 },
  salesInvSellerLine: { color: palette.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 },

  // Profit summary block
  profitSummary: {
    marginTop: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    gap: 0,
  },
  profitSummaryPos: {
    backgroundColor: 'rgba(0,214,143,0.08)',
    borderColor: 'rgba(0,214,143,0.25)',
  },
  profitSummaryNeg: {
    backgroundColor: 'rgba(255,59,92,0.08)',
    borderColor: 'rgba(255,59,92,0.25)',
  },
  profitRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 5,
  },
  profitLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  profitVal: { color: palette.text, fontSize: 13, fontWeight: '900' },
  profitDivider: { height: 1, backgroundColor: palette.cardBorder, marginVertical: 6 },
  profitBigLabel: { color: palette.text, fontSize: 14, fontWeight: '900' },
  profitBigVal: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  profitPctBadge: {
    alignSelf: 'flex-start' as const,
    marginTop: 8,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  profitPctText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.2 },

  sellLivePill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  sellLiveText: { color: palette.rose, fontSize: 11, fontWeight: '900' },
  warehouseOptRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'baseline' as const, marginBottom: 8 },
  warehouseOptHint: { color: palette.textMuted, fontSize: 10, fontWeight: '600' as const },

  filterCard: {
    backgroundColor: palette.cardBg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    overflow: 'hidden' as const,
  },
  filterDivider: { height: 1, backgroundColor: palette.cardBorder },
  inlineCalendar: { borderRadius: radii.md, overflow: 'hidden' as const, marginTop: 4 },

  // Sell tab context strip
  sellContextBar: {
    flexDirection: 'row' as const,
    backgroundColor: palette.cardBgPrimary,
    borderWidth: 1,
    borderColor: palette.cardBorderAccent,
    borderRadius: radii.lg,
    overflow: 'hidden' as const,
    shadowColor: palette.emerald,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  sellContextCell: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sellContextDivider: { width: 1, backgroundColor: palette.cardBorder, marginVertical: 10 },
  sellContextIcon: { fontSize: 22 },
  sellContextLabel: { color: palette.textMuted, fontSize: 10, fontWeight: '800' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 3 },
  sellContextValue: { color: palette.emerald, fontSize: 20, fontWeight: '900' as const, letterSpacing: -0.4 },
  sellContextSub: { color: palette.textMuted, fontSize: 10, fontWeight: '700' as const, marginTop: 2 },

  invoiceProductRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  invoiceUnitPill: {
    backgroundColor: 'rgba(255,179,0,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,179,0,0.30)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    flexShrink: 0,
  },
  invoiceUnitText: { color: palette.violet, fontSize: 12, fontWeight: '900' },

  // ── Sales tab filter chips ───────────────────────────────────────────────────
  personChipsScroll: { paddingBottom: 4, gap: 8 },
  personChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: palette.cardBgElevated,
    borderWidth: 1,
    borderColor: palette.cardBorder,
  },
  personChipActive: {
    backgroundColor: palette.emeraldLight,
    borderColor: `${palette.emerald}55`,
    shadowColor: palette.emerald,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  personChipText: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  personChipTextActive: { color: palette.emerald, fontWeight: '900' },

  dateChipRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  dateChip: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: palette.cardBgElevated,
    borderWidth: 1,
    borderColor: palette.cardBorder,
  },
  dateChipActive: {
    backgroundColor: 'rgba(0,168,255,0.10)',
    borderColor: `${palette.emerald}55`,
  },
  dateChipIcon: { fontSize: 15 },
  dateChipLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700', flex: 1 },
  dateChipLabelActive: { color: palette.emerald, fontWeight: '800' },
  clearDateChip: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255,59,92,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,92,0.28)',
  },
  clearDateChipText: { color: palette.rose, fontSize: 12, fontWeight: '800' },
});
