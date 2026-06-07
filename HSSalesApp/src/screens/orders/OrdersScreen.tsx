import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { Calendar } from 'react-native-calendars';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { SelectMenu } from '../../components/ui/SelectMenu';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchOrders, upsertOrder, removeOrder, addPayment } from '../../store/slices/ordersSlice';
import { showToast } from '../../store/slices/uiSlice';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';
import * as ordersApi from '../../api/orders';
import type { Order, OrderItem, OrderPayment, OrderStatus } from '../../types/models';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<OrderStatus, { en: string; bn: string; color: string; icon: string }> = {
  draft:            { en: 'Draft',             bn: 'খসড়া',          color: '#7B93A8',         icon: '📋' },
  confirmed:        { en: 'Confirmed',         bn: 'নিশ্চিত',        color: '#60A5FA',         icon: '✅' },
  processing:       { en: 'Processing',        bn: 'প্রস্তুত হচ্ছে', color: '#FFD740',         icon: '⚙️' },
  out_for_delivery: { en: 'Out for Delivery',  bn: 'ডেলিভারি চলছে', color: '#FB923C',         icon: '🚚' },
  delivered:        { en: 'Delivered',         bn: 'ডেলিভারি সম্পন্ন', color: palette.success, icon: '✔️' },
  cancelled:        { en: 'Cancelled',         bn: 'বাতিল',          color: palette.rose,      icon: '❌' },
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  draft: 'confirmed',
  confirmed: 'processing',
  processing: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

function statusLabel(status: OrderStatus, locale: string) {
  const s = STATUS_LABEL[status];
  return locale === 'bn' ? s.bn : s.en;
}

// ── Step tracker ──────────────────────────────────────────────────────────────

const FLOW_STEPS: OrderStatus[] = ['draft', 'confirmed', 'processing', 'out_for_delivery', 'delivered'];

function StepTracker({ status, locale }: { status: OrderStatus; locale: string }) {
  if (status === 'cancelled') return null;
  const currentIdx = FLOW_STEPS.indexOf(status);
  return (
    <View style={st2.root}>
      {FLOW_STEPS.map((step, idx) => {
        const info = STATUS_LABEL[step];
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        const future = idx > currentIdx;
        const dotColor = done ? info.color : active ? info.color : 'rgba(255,255,255,0.12)';
        const lineColor = idx < currentIdx ? STATUS_LABEL[FLOW_STEPS[idx]]?.color ?? palette.textMuted : 'rgba(255,255,255,0.1)';
        return (
          <React.Fragment key={step}>
            <View style={st2.stepCol}>
              <View style={[
                st2.dot,
                { borderColor: active ? info.color : done ? `${info.color}80` : 'rgba(255,255,255,0.15)', backgroundColor: done ? `${info.color}30` : active ? `${info.color}22` : 'transparent' },
                active && { shadowColor: info.color, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
              ]}>
                <Text style={[st2.dotIcon, future && { opacity: 0.3 }]}>{done ? '✓' : info.icon}</Text>
              </View>
              <Text style={[st2.stepLabel, { color: active ? info.color : done ? `${info.color}90` : 'rgba(255,255,255,0.25)' }, active && { fontWeight: '900' }]} numberOfLines={1}>
                {locale === 'bn' ? info.bn : info.en}
              </Text>
            </View>
            {idx < FLOW_STEPS.length - 1 && (
              <View style={[st2.line, { backgroundColor: idx < currentIdx ? `${lineColor}60` : 'rgba(255,255,255,0.07)' }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const st2 = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 12, paddingHorizontal: 2 },
  stepCol: { alignItems: 'center', gap: 4, minWidth: 44 },
  dot: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dotIcon: { fontSize: 13 },
  stepLabel: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: 0.3, textAlign: 'center' as const, maxWidth: 48 },
  line: { flex: 1, height: 1.5, marginTop: 15, borderRadius: 2 },
});

// ── Single order card ─────────────────────────────────────────────────────────

function OrderCard({
  order,
  items,
  payments,
  locale,
  money,
  products,
  isAdmin,
  isOwner,
  onAdvance,
  onCancel,
  onDelete,
  onEdit,
  onRecordPayment,
}: {
  order: Order;
  items: OrderItem[];
  payments: OrderPayment[];
  locale: string;
  money: Intl.NumberFormat;
  products: { id: string; name: string }[];
  isAdmin: boolean;
  isOwner: boolean;
  onAdvance: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRecordPayment: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const st = STATUS_LABEL[order.status];
  const nextStatus = NEXT_STATUS[order.status];
  const canAdvance = !!nextStatus;
  const canCancel = !['delivered', 'cancelled'].includes(order.status) && (isAdmin || isOwner);
  const canDelete = !['delivered'].includes(order.status) && (isAdmin || isOwner);
  const total = items.reduce((a, it) => a + it.quantity * it.unitPrice, 0);
  const totalPaid = (order.advancePaid ?? 0) + payments.reduce((a, p) => a + p.amount, 0);
  const balance = total - totalPaid;
  const isPaid = total > 0 && balance <= 0;
  const nextSt = nextStatus ? STATUS_LABEL[nextStatus] : null;
  const bn = locale === 'bn';

  return (
    <Pressable
      onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity')); setExpanded(v => !v); }}
      style={({ pressed }) => [oc.card, { borderColor: `${st.color}30`, shadowColor: st.color }, order.status === 'cancelled' && oc.cancelled, pressed && { opacity: 0.9 }]}>

      {/* Top accent bar */}
      <View style={[oc.topBar, { backgroundColor: `${st.color}22`, borderBottomColor: `${st.color}30` }]}>
        <View style={oc.topBarLeft}>
          <View style={[oc.statusDot, { backgroundColor: st.color, shadowColor: st.color }]} />
          <Text style={[oc.orderNum, { color: st.color }]}>{order.orderNumber}</Text>
        </View>
        <View style={[oc.statusChip, { backgroundColor: `${st.color}18`, borderColor: `${st.color}40` }]}>
          <Text style={oc.statusChipIcon}>{st.icon}</Text>
          <Text style={[oc.statusChipText, { color: st.color }]}>{statusLabel(order.status, locale)}</Text>
        </View>
      </View>

      <View style={oc.body}>
        {/* Customer + total */}
        <View style={oc.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={oc.customer}>{order.customerName}</Text>
            {order.customerPhone && (
              <Text style={oc.customerPhone}>📞 {order.customerPhone}</Text>
            )}
            <Text style={oc.dateText}>📅 {order.orderDate}{order.expectedDelivery ? ` → ${order.expectedDelivery}` : ''}</Text>
          </View>
          <View style={oc.totalBox}>
            <Text style={oc.totalVal}>{money.format(total)}</Text>
            {isPaid
              ? <View style={oc.paidBadge}><Text style={oc.paidText}>{bn ? '✓ পরিশোধিত' : '✓ Paid'}</Text></View>
              : total > 0 ? <Text style={oc.dueText}>{bn ? `বাকি ${money.format(balance)}` : `Due ${money.format(balance)}`}</Text> : null}
          </View>
        </View>

        {/* Step tracker — always visible */}
        <StepTracker status={order.status} locale={locale} />

        {/* Cancelled reason preview */}
        {order.status === 'cancelled' && order.cancelReason && (
          <Text style={oc.cancelNote}>❌ {order.cancelReason}</Text>
        )}

        {/* Expand toggle */}
        <View style={oc.expandRow}>
          <Text style={oc.expandHint}>{expanded ? (bn ? 'কম দেখুন ▴' : 'Less ▴') : (bn ? 'বিস্তারিত ▾' : 'Details ▾')}</Text>
        </View>

        {/* Expanded content */}
        {expanded && (
          <View style={oc.expanded}>
            <View style={oc.divider} />

            {/* Items table */}
            <View style={oc.itemsHeader}>
              <Text style={[oc.itemCol, { flex: 1 }]}>{bn ? 'পণ্য' : 'Product'}</Text>
              <Text style={oc.itemColR}>{bn ? 'পরিমাণ' : 'Qty'}</Text>
              <Text style={oc.itemColR}>{bn ? 'মূল্য' : 'Amount'}</Text>
            </View>
            {items.map(it => {
              const prod = products.find(p => p.id === it.productId);
              return (
                <View key={it.id} style={oc.itemRow}>
                  <Text style={[oc.itemName, { flex: 1 }]} numberOfLines={1}>{prod?.name ?? '—'}</Text>
                  <Text style={oc.itemQty}>×{it.quantity.toLocaleString()}</Text>
                  <Text style={oc.itemPrice}>{money.format(it.quantity * it.unitPrice)}</Text>
                </View>
              );
            })}

            {/* Payment section */}
            <View style={oc.paySection}>
              <View style={oc.paySectionHeader}>
                <Text style={oc.paySectionTitle}>{bn ? '💰 পেমেন্ট' : '💰 Payments'}</Text>
              </View>
              <View style={oc.payRow}>
                <Text style={oc.payLabel}>{bn ? 'মোট অর্ডার' : 'Order Total'}</Text>
                <Text style={oc.payVal}>{money.format(total)}</Text>
              </View>
              {(order.advancePaid ?? 0) > 0 && (
                <View style={oc.payRow}>
                  <Text style={oc.payLabel}>{bn ? 'বায়না' : 'Advance'}</Text>
                  <Text style={[oc.payVal, { color: palette.success }]}>– {money.format(order.advancePaid!)}</Text>
                </View>
              )}
              {payments.map(p => (
                <View key={p.id} style={oc.payRow}>
                  <Text style={oc.payLabel}>💳 {p.paidAt}{p.notes ? ` · ${p.notes}` : ''}</Text>
                  <Text style={[oc.payVal, { color: palette.success }]}>– {money.format(p.amount)}</Text>
                </View>
              ))}
              <View style={[oc.payRow, oc.payTotal, { borderColor: isPaid ? `${palette.success}40` : `${palette.rose}40`, backgroundColor: isPaid ? `${palette.success}08` : `${palette.rose}08` }]}>
                <Text style={[oc.payLabel, { fontWeight: '900', color: isPaid ? palette.success : palette.rose }]}>
                  {bn ? (isPaid ? '✓ সম্পূর্ণ পরিশোধিত' : 'বাকি') : (isPaid ? '✓ Fully Paid' : 'Balance Due')}
                </Text>
                <Text style={[oc.payVal, { color: isPaid ? palette.success : palette.rose, fontSize: 15, fontWeight: '900' }]}>
                  {isPaid ? '—' : money.format(balance)}
                </Text>
              </View>
            </View>

            {/* Record Payment — available until fully paid, even after delivery */}
            {!isPaid && order.status !== 'cancelled' && (
              <Pressable onPress={onRecordPayment} style={({ pressed }) => [oc.payBtn, pressed && { opacity: 0.8 }]}>
                <Text style={oc.payBtnText}>💳 {bn ? 'পেমেন্ট রেকর্ড করুন' : 'Record Payment'}</Text>
              </Pressable>
            )}

            {order.notes && (
              <View style={oc.notesBox}>
                <Text style={oc.notesLabel}>{bn ? 'নোট' : 'Note'}</Text>
                <Text style={oc.notesText}>{order.notes}</Text>
              </View>
            )}

            {/* Actions — show for non-delivered; cancelled orders still get permanent delete for admin */}
            {(order.status !== 'delivered') && (
              <View style={oc.actions}>
                {order.status !== 'cancelled' && (isAdmin || isOwner) && (
                  <Pressable onPress={onEdit} style={({ pressed }) => [oc.editBtn, pressed && { opacity: 0.8 }]}>
                    <Text style={oc.editBtnText}>✎ {bn ? 'সম্পাদনা' : 'Edit'}</Text>
                  </Pressable>
                )}
                {canCancel && (
                  <Pressable onPress={onCancel} style={({ pressed }) => [oc.cancelBtn, pressed && { opacity: 0.8 }]}>
                    <Text style={oc.cancelBtnText}>{bn ? 'বাতিল' : 'Cancel'}</Text>
                  </Pressable>
                )}
                {(canDelete || (order.status === 'cancelled' && isAdmin)) && (
                  <Pressable onPress={onDelete} style={({ pressed }) => [oc.deleteBtn, pressed && { opacity: 0.8 }]}>
                    <Text style={oc.deleteBtnText}>🗑</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Advance button — full-width, prominent */}
            {canAdvance && nextSt && (
              <Pressable onPress={onAdvance} style={({ pressed }) => [oc.advanceBtn, { backgroundColor: nextSt.color, shadowColor: nextSt.color }, pressed && { opacity: 0.85 }]}>
                <Text style={oc.advanceBtnIcon}>{nextSt.icon}</Text>
                <Text style={oc.advanceBtnText}>
                  {bn ? `${nextSt.bn}-এ নিয়ে যান` : `Move to ${nextSt.en}`}
                </Text>
                <Text style={oc.advanceBtnArrow}>›</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const oc = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    backgroundColor: palette.cardBg,
    overflow: 'hidden',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  cancelled: { opacity: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4, shadowOpacity: 0.8, shadowRadius: 5, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  orderNum: { fontSize: 12, fontWeight: '900', letterSpacing: 0.2 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusChipIcon: { fontSize: 12 },
  statusChipText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  body: { padding: 14 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  customer: { color: palette.text, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  customerPhone: { color: palette.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  dateText: { color: palette.textMuted, fontSize: 11, fontWeight: '700', marginTop: 4 },
  totalBox: { alignItems: 'flex-end', flexShrink: 0 },
  totalVal: { color: palette.emerald, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  paidBadge: { backgroundColor: 'rgba(0,214,143,0.15)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 3, borderWidth: 1, borderColor: 'rgba(0,214,143,0.35)' },
  paidText: { color: palette.success, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' as const },
  dueText: { color: palette.rose, fontSize: 10, fontWeight: '800', marginTop: 3 },
  cancelNote: { color: palette.rose, fontSize: 11, fontWeight: '600', fontStyle: 'italic', marginBottom: 4 },
  expandRow: { alignItems: 'center', paddingTop: 2 },
  expandHint: { color: `${palette.emerald}80`, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  expanded: { marginTop: 4 },
  divider: { height: 1, backgroundColor: palette.cardBorder, marginBottom: 12 },
  itemsHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: palette.cardBorder, marginBottom: 4 },
  itemCol: { color: palette.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  itemColR: { color: palette.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: 0.5, minWidth: 60, textAlign: 'right' as const },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8, borderBottomWidth: 1, borderBottomColor: `${palette.cardBorder}60` },
  itemName: { color: palette.textLabel, fontSize: 13, fontWeight: '700' },
  itemQty: { color: palette.textMuted, fontSize: 12, fontWeight: '700', minWidth: 36, textAlign: 'right' as const },
  itemPrice: { color: palette.text, fontSize: 13, fontWeight: '900', minWidth: 72, textAlign: 'right' as const },
  paySection: { marginTop: 14, borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorder, overflow: 'hidden' },
  paySectionHeader: { backgroundColor: palette.cardBgElevated, paddingHorizontal: 12, paddingVertical: 7 },
  paySectionTitle: { color: palette.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderTopWidth: 1, borderTopColor: `${palette.cardBorder}60` },
  payTotal: { borderTopWidth: 1.5, borderRadius: 0 },
  payLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '700', flex: 1 },
  payVal: { color: palette.text, fontSize: 13, fontWeight: '900' },
  payBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(0,214,143,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,214,143,0.40)',
    borderRadius: radii.md,
    paddingVertical: 11,
    alignItems: 'center',
    shadowColor: palette.success,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  payBtnText: { color: palette.success, fontSize: 13, fontWeight: '900' },
  notesBox: { marginTop: 10, padding: 10, backgroundColor: palette.cardBgElevated, borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorder },
  notesLabel: { color: palette.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' as const, marginBottom: 3 },
  notesText: { color: palette.textLabel, fontSize: 12, fontWeight: '600', fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' as const },
  editBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.cardBgElevated },
  editBtnText: { color: palette.text, fontSize: 12, fontWeight: '800' },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.md, backgroundColor: 'rgba(255,59,92,0.10)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.30)' },
  cancelBtnText: { color: palette.rose, fontSize: 12, fontWeight: '800' },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.cardBgElevated },
  deleteBtnText: { fontSize: 14 },
  advanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: radii.lg,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  advanceBtnIcon: { fontSize: 16 },
  advanceBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
  advanceBtnArrow: { color: 'rgba(255,255,255,0.7)', fontSize: 20, fontWeight: '900' },
});

// ── New order form ─────────────────────────────────────────────────────────────

type LineDraft = { id: string; productId: string; quantity: string; unitPrice: string };
function newLine(): LineDraft { return { id: String(Math.random()), productId: '', quantity: '1', unitPrice: '' }; }

function NewOrderForm({ products, currencies, stockByProduct, locale, onClose, onCreated }: {
  products: { id: string; name: string }[];
  currencies: { id: string; code: string }[];
  stockByProduct: Map<string, number>;
  locale: string;
  onClose: () => void;
  onCreated: (order: Order) => void;
}) {
  const token = useAppSelector(s => s.auth.token);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [showDeliveryCalendar, setShowDeliveryCalendar] = useState(false);
  const [advancePaid, setAdvancePaid] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [busy, setBusy] = useState(false);

  // Show available stock in product labels
  const productOptions = products.map(p => {
    const avail = stockByProduct.get(p.id) ?? 0;
    const suffix = avail > 0 ? ` (${avail.toLocaleString()} available)` : ` (${locale === 'bn' ? 'মজুদ নেই' : 'no stock'})`;
    return { value: p.id, label: p.name + suffix };
  });
  const curId = currencies[0]?.id ?? '';
  const bn = locale === 'bn';

  async function submit() {
    if (!token || !customerName.trim()) { Alert.alert(bn ? 'ত্রুটি' : 'Error', bn ? 'কাস্টমারের নাম দিন' : 'Enter customer name'); return; }
    const validLines = lines.filter(l => l.productId && Number(l.quantity) > 0 && Number(l.unitPrice) >= 0);
    if (validLines.length === 0) { Alert.alert(bn ? 'ত্রুটি' : 'Error', bn ? 'কমপক্ষে একটি পণ্য দিন' : 'Add at least one item'); return; }
    setBusy(true);
    try {
      const order = await ordersApi.createOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        orderDate,
        expectedDelivery: expectedDelivery.trim() || undefined,
        advancePaid: Number(advancePaid) || 0,
        notes: notes.trim() || undefined,
        items: validLines.map(l => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), currencyId: curId })),
      }, token);
      onCreated(order);
    } catch (e: any) { Alert.alert(bn ? 'ত্রুটি' : 'Error', e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  }

  const lbl = (t: string) => <Text style={nof.label}>{t}</Text>;
  const inp = (value: string, onChange: (v: string) => void, ph: string, opts?: object) => (
    <TextInput value={value} onChangeText={onChange} placeholder={ph} placeholderTextColor={palette.textMuted} style={nof.input} {...opts} />
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={nof.sheet} contentContainerStyle={nof.sheetInner} keyboardShouldPersistTaps="handled">
        <View style={nof.sheetHeader}>
          <Text style={nof.sheetTitle}>{bn ? 'নতুন অর্ডার' : 'New Order'}</Text>
          <Pressable onPress={onClose} style={nof.closeBtn}><Text style={nof.closeBtnText}>✕</Text></Pressable>
        </View>

        {lbl(bn ? 'কাস্টমারের নাম *' : 'Customer Name *')}
        {inp(customerName, setCustomerName, bn ? 'নাম লিখুন' : 'Full name')}
        {lbl(bn ? 'ফোন নম্বর' : 'Phone')}
        {inp(customerPhone, setCustomerPhone, '+880...', { keyboardType: 'phone-pad' })}
        {lbl(bn ? 'প্রত্যাশিত ডেলিভারি' : 'Expected Delivery')}
        <Pressable
          onPress={() => setShowDeliveryCalendar(v => !v)}
          style={({ pressed }) => [nof.datePicker, pressed && { opacity: 0.8 }]}>
          <Text style={nof.datePickerText}>
            {expectedDelivery
              ? new Date(expectedDelivery).toLocaleDateString(bn ? 'bn-BD' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
              : (bn ? 'তারিখ বেছে নিন 🗓' : 'Pick a date 🗓')}
          </Text>
          {expectedDelivery && (
            <Pressable onPress={e => { e.stopPropagation(); setExpectedDelivery(''); }} hitSlop={8}>
              <Text style={{ color: palette.textMuted, fontSize: 14, fontWeight: '800', paddingHorizontal: 4 }}>✕</Text>
            </Pressable>
          )}
        </Pressable>
        {showDeliveryCalendar && (
          <Calendar
            current={expectedDelivery || new Date().toISOString().slice(0, 10)}
            minDate={new Date().toISOString().slice(0, 10)}
            onDayPress={d => { setExpectedDelivery(d.dateString); setShowDeliveryCalendar(false); }}
            enableSwipeMonths
            theme={{
              backgroundColor: palette.cardBgElevated,
              calendarBackground: palette.cardBgElevated,
              monthTextColor: palette.text,
              textMonthFontWeight: '900',
              dayTextColor: palette.text,
              textDisabledColor: 'rgba(100,140,200,0.30)',
              selectedDayBackgroundColor: palette.emerald,
              selectedDayTextColor: palette.onAccent,
              todayTextColor: palette.emerald,
              arrowColor: palette.emerald,
              dotColor: palette.emeraldDeep,
            }}
            style={{ borderRadius: radii.md, overflow: 'hidden', marginTop: 6 }}
          />
        )}
        {lbl(bn ? 'বায়না (BDT)' : 'Advance Paid (BDT)')}
        {inp(advancePaid, setAdvancePaid, '0', { keyboardType: 'numeric' })}
        {lbl(bn ? 'নোট' : 'Notes')}
        {inp(notes, setNotes, '...')}

        <Text style={[nof.label, { marginTop: 18 }]}>{bn ? 'পণ্য তালিকা' : 'Items'}</Text>
        {lines.map((l, i) => {
          const available = l.productId ? (stockByProduct.get(l.productId) ?? 0) : 0;
          const ordered = Number(l.quantity) || 0;
          const overStock = l.productId && ordered > available;
          const noStock = l.productId && available === 0;
          return (
          <View key={l.id} style={[nof.lineCard, overStock && { borderColor: palette.rose }]}>
            <SelectMenu label={bn ? 'পণ্য' : 'Product'} value={l.productId} options={productOptions} onChange={v => setLines(prev => prev.map((x, j) => j === i ? { ...x, productId: v } : x))} />
            {noStock && <Text style={{ color: palette.rose, fontSize: 11, fontWeight: '800', marginTop: 4 }}>⚠️ {bn ? 'এই পণ্যের মজুদ নেই — ডেলিভারি ব্লক হবে' : 'No stock — delivery will be blocked'}</Text>}
            <View style={nof.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={nof.smallLabel}>{bn ? `পরিমাণ (মজুদ: ${available})` : `Qty (avail: ${available})`}</Text>
                <TextInput value={l.quantity} onChangeText={v => setLines(prev => prev.map((x, j) => j === i ? { ...x, quantity: v } : x))} keyboardType="numeric" style={[nof.smallInput, overStock && { borderColor: palette.rose }]} placeholderTextColor={palette.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={nof.smallLabel}>{bn ? 'দাম (BDT)' : 'Price (BDT)'}</Text>
                <TextInput value={l.unitPrice} onChangeText={v => setLines(prev => prev.map((x, j) => j === i ? { ...x, unitPrice: v } : x))} keyboardType="numeric" placeholder="0" style={nof.smallInput} placeholderTextColor={palette.textMuted} />
              </View>
              {lines.length > 1 && (
                <Pressable onPress={() => setLines(prev => prev.filter((_, j) => j !== i))} style={nof.removeBtn}><Text style={{ color: palette.rose, fontSize: 16 }}>✕</Text></Pressable>
              )}
            </View>
            {overStock && <Text style={{ color: palette.rose, fontSize: 11, fontWeight: '700', marginTop: 6 }}>⚠️ {bn ? `চাহিদা (${ordered}) মজুদের (${available}) বেশি` : `Ordered (${ordered}) exceeds stock (${available})`}</Text>}
          </View>
          );
        })}
        <Pressable onPress={() => setLines(prev => [...prev, newLine()])} style={nof.addLineBtn}>
          <Text style={nof.addLineBtnText}>+ {bn ? 'পণ্য যোগ করুন' : 'Add item'}</Text>
        </Pressable>

        <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [nof.submitBtn, pressed && { opacity: 0.85 }, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={nof.submitBtnText}>{bn ? 'অর্ডার তৈরি করুন' : 'Create Order'}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const nof = StyleSheet.create({
  sheet: { backgroundColor: palette.cardBgPrimary, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, maxHeight: '92%', paddingBottom: 8 },
  sheetInner: { padding: 20, gap: 0, paddingBottom: 40 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { color: palette.text, fontSize: 20, fontWeight: '900' },
  closeBtn: { padding: 8 },
  closeBtnText: { color: palette.textMuted, fontSize: 18, fontWeight: '800' },
  label: { color: palette.textLabel, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: palette.stroke, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 11, color: palette.text, backgroundColor: palette.inputInset, fontWeight: '600', fontSize: 14 },
  lineCard: { backgroundColor: palette.cardBgElevated, borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorder, padding: 12, marginBottom: 10 },
  lineRow: { flexDirection: 'row', gap: 10, marginTop: 8, alignItems: 'flex-end' },
  smallLabel: { color: palette.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  smallInput: { borderWidth: 1, borderColor: palette.stroke, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 9, color: palette.text, backgroundColor: palette.inputInset, fontSize: 14, fontWeight: '700' },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 9 },
  datePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: palette.stroke, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: palette.inputInset, marginTop: 6 },
  datePickerText: { color: palette.text, fontSize: 14, fontWeight: '700', flex: 1 },
  addLineBtn: { borderWidth: 1, borderColor: palette.emerald, borderRadius: radii.md, borderStyle: 'dashed', paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  addLineBtnText: { color: palette.emerald, fontSize: 13, fontWeight: '900' },
  submitBtn: { backgroundColor: palette.emerald, borderRadius: radii.lg, paddingVertical: 16, alignItems: 'center', marginTop: 20, shadowColor: palette.emerald, shadowOpacity: 0.50, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 9 },
  submitBtnText: { color: palette.onAccent, fontSize: 16, fontWeight: '900' },
});

// ── Edit order form ────────────────────────────────────────────────────────────

function EditOrderForm({ order, existingItems, products, currencies, locale, onClose, onUpdated }: {
  order: Order;
  existingItems: OrderItem[];
  products: { id: string; name: string }[];
  currencies: { id: string; code: string }[];
  locale: string;
  onClose: () => void;
  onUpdated: (order: Order, items: OrderItem[]) => void;
}) {
  const token = useAppSelector(s => s.auth.token);
  const bn = locale === 'bn';
  const [customerName, setCustomerName] = useState(order.customerName);
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone ?? '');
  const [expectedDelivery, setExpectedDelivery] = useState(order.expectedDelivery ?? '');
  const [showCalendar, setShowCalendar] = useState(false);
  const [advancePaid, setAdvancePaid] = useState(String(order.advancePaid ?? ''));
  const [notes, setNotes] = useState(order.notes ?? '');
  const [lines, setLines] = useState<LineDraft[]>(() =>
    existingItems.length > 0
      ? existingItems.map(it => ({ id: it.id, productId: it.productId, quantity: String(it.quantity), unitPrice: String(it.unitPrice) }))
      : [newLine()],
  );
  const [busy, setBusy] = useState(false);
  const curId = currencies[0]?.id ?? '';

  // Live total so user can see impact of unit price changes immediately
  const liveTotal = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const money = new Intl.NumberFormat(bn ? 'bn-BD' : 'en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 });

  const productOptions = products.map(p => ({ value: p.id, label: p.name }));

  async function save() {
    if (!token || !customerName.trim()) { Alert.alert(bn ? 'ত্রুটি' : 'Error', bn ? 'কাস্টমারের নাম দিন' : 'Customer name required'); return; }
    const validLines = lines.filter(l => l.productId && Number(l.quantity) > 0);
    if (validLines.length === 0) { Alert.alert(bn ? 'ত্রুটি' : 'Error', bn ? 'কমপক্ষে একটি পণ্য দিন' : 'Add at least one item'); return; }
    setBusy(true);
    try {
      const updated = await ordersApi.updateOrder(order.id, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        expectedDelivery: expectedDelivery.trim() || undefined,
        advancePaid: Number(advancePaid) || 0,
        notes: notes.trim() || undefined,
        items: validLines.map(l => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) || 0, currencyId: curId })),
      }, token);
      onUpdated(updated, validLines.map(l => ({ id: l.id, orderId: order.id, productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) || 0, currencyId: curId })));
    } catch (e: any) { Alert.alert(bn ? 'ত্রুটি' : 'Error', e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={nof.sheet} contentContainerStyle={nof.sheetInner} keyboardShouldPersistTaps="handled">
        <View style={nof.sheetHeader}>
          <Text style={nof.sheetTitle}>{bn ? 'অর্ডার সম্পাদনা' : 'Edit Order'}</Text>
          <Text style={[nof.sheetTitle, { fontSize: 13, color: palette.textMuted }]}>{order.orderNumber}</Text>
          <Pressable onPress={onClose} style={nof.closeBtn}><Text style={nof.closeBtnText}>✕</Text></Pressable>
        </View>

        <Text style={nof.label}>{bn ? 'কাস্টমারের নাম *' : 'Customer Name *'}</Text>
        <TextInput value={customerName} onChangeText={setCustomerName} placeholder={bn ? 'নাম লিখুন' : 'Full name'} placeholderTextColor={palette.textMuted} style={nof.input} />

        <Text style={nof.label}>{bn ? 'ফোন নম্বর' : 'Phone'}</Text>
        <TextInput value={customerPhone} onChangeText={setCustomerPhone} placeholder="+880..." placeholderTextColor={palette.textMuted} style={nof.input} keyboardType="phone-pad" />

        <Text style={nof.label}>{bn ? 'প্রত্যাশিত ডেলিভারি' : 'Expected Delivery'}</Text>
        <Pressable onPress={() => setShowCalendar(v => !v)} style={({ pressed }) => [nof.datePicker, pressed && { opacity: 0.8 }]}>
          <Text style={nof.datePickerText}>
            {expectedDelivery
              ? new Date(expectedDelivery).toLocaleDateString(bn ? 'bn-BD' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
              : (bn ? 'তারিখ বেছে নিন 🗓' : 'Pick a date 🗓')}
          </Text>
          {expectedDelivery && <Pressable onPress={e => { e.stopPropagation(); setExpectedDelivery(''); }} hitSlop={8}><Text style={{ color: palette.textMuted, fontWeight: '800', paddingHorizontal: 4 }}>✕</Text></Pressable>}
        </Pressable>
        {showCalendar && (
          <Calendar
            current={expectedDelivery || new Date().toISOString().slice(0, 10)}
            minDate={new Date().toISOString().slice(0, 10)}
            onDayPress={d => { setExpectedDelivery(d.dateString); setShowCalendar(false); }}
            enableSwipeMonths
            theme={{ backgroundColor: palette.cardBgElevated, calendarBackground: palette.cardBgElevated, monthTextColor: palette.text, textMonthFontWeight: '900', dayTextColor: palette.text, textDisabledColor: 'rgba(100,140,200,0.30)', selectedDayBackgroundColor: palette.emerald, selectedDayTextColor: palette.onAccent, todayTextColor: palette.emerald, arrowColor: palette.emerald }}
            style={{ borderRadius: radii.md, overflow: 'hidden', marginTop: 6 }}
          />
        )}

        <Text style={nof.label}>{bn ? 'বায়না (BDT)' : 'Advance Paid (BDT)'}</Text>
        <TextInput value={advancePaid} onChangeText={setAdvancePaid} placeholder="0" placeholderTextColor={palette.textMuted} style={nof.input} keyboardType="numeric" />

        <Text style={nof.label}>{bn ? 'নোট' : 'Notes'}</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="..." placeholderTextColor={palette.textMuted} style={nof.input} />

        <Text style={[nof.label, { marginTop: 18 }]}>{bn ? 'পণ্য তালিকা' : 'Items'}</Text>
        {lines.map((l, i) => (
          <View key={l.id} style={nof.lineCard}>
            <SelectMenu label={bn ? 'পণ্য' : 'Product'} value={l.productId} options={productOptions} onChange={v => setLines(prev => prev.map((x, j) => j === i ? { ...x, productId: v } : x))} />
            <View style={nof.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={nof.smallLabel}>{bn ? 'পরিমাণ' : 'Qty'}</Text>
                <TextInput value={l.quantity} onChangeText={v => setLines(prev => prev.map((x, j) => j === i ? { ...x, quantity: v } : x))} keyboardType="numeric" placeholder="1" style={nof.smallInput} placeholderTextColor={palette.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={nof.smallLabel}>{bn ? 'দাম (BDT)' : 'Price (BDT)'}</Text>
                <TextInput value={l.unitPrice} onChangeText={v => setLines(prev => prev.map((x, j) => j === i ? { ...x, unitPrice: v } : x))} keyboardType="numeric" placeholder="0" style={nof.smallInput} placeholderTextColor={palette.textMuted} />
              </View>
              {lines.length > 1 && (
                <Pressable onPress={() => setLines(prev => prev.filter((_, j) => j !== i))} style={nof.removeBtn}><Text style={{ color: palette.rose, fontSize: 16 }}>✕</Text></Pressable>
              )}
            </View>
            {Number(l.quantity) > 0 && Number(l.unitPrice) > 0 && (
              <Text style={{ color: palette.emerald, fontSize: 12, fontWeight: '800', marginTop: 6, textAlign: 'right' }}>
                = {money.format(Number(l.quantity) * Number(l.unitPrice))}
              </Text>
            )}
          </View>
        ))}
        <Pressable onPress={() => setLines(prev => [...prev, newLine()])} style={nof.addLineBtn}>
          <Text style={nof.addLineBtnText}>+ {bn ? 'পণ্য যোগ করুন' : 'Add item'}</Text>
        </Pressable>

        {liveTotal > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, padding: 12, backgroundColor: palette.cardBgElevated, borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorder }}>
            <Text style={{ color: palette.textMuted, fontSize: 13, fontWeight: '800' }}>{bn ? 'মোট' : 'Order Total'}</Text>
            <Text style={{ color: palette.emerald, fontSize: 15, fontWeight: '900' }}>{money.format(liveTotal)}</Text>
          </View>
        )}

        <Pressable onPress={save} disabled={busy} style={({ pressed }) => [nof.submitBtn, pressed && { opacity: 0.85 }, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={nof.submitBtnText}>{bn ? 'সংরক্ষণ করুন' : 'Save Changes'}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

type Filter = 'active' | 'delivered' | 'cancelled';

export function OrdersScreen() {
  const dispatch = useAppDispatch();
  const locale = useAppSelector(s => s.ui.locale);
  const token = useAppSelector(s => s.auth.token);
  const userId = useAppSelector(s => s.auth.user?.id ?? '');
  const role = useAppSelector(s => s.auth.user?.role);
  const isAdmin = role === 'admin';
  const { orders, orderItems, orderPayments, status } = useAppSelector(s => s.orders);
  const { products, currencies } = useAppSelector(s => s.salesData);
  const stockRows = useAppSelector(s => s.inventory.stockRows);

  // Aggregate available stock per product across all warehouses
  const stockByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of stockRows) {
      map.set(r.productId, (map.get(r.productId) ?? 0) + Number(r.quantityOnHand));
    }
    return map;
  }, [stockRows]);
  const tabPad = useTabScreenBottomPadding();
  const [filter, setFilter] = useState<Filter>('active');
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentAmt, setPaymentAmt] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const bn = locale === 'bn';

  const money = useMemo(() => new Intl.NumberFormat(bn ? 'bn-BD' : 'en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }), [bn]);

  useFocusEffect(useCallback(() => { dispatch(fetchOrders()); }, [dispatch]));

  const filtered = useMemo(() => {
    return orders.filter(o =>
      filter === 'active' ? !['delivered', 'cancelled'].includes(o.status) :
      filter === 'delivered' ? o.status === 'delivered' :
      o.status === 'cancelled',
    ).sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  }, [orders, filter]);

  const counts = useMemo(() => ({
    active: orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }), [orders]);

  async function advance(order: Order) {
    if (!token) return;
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      const updated = await ordersApi.updateOrderStatus(order.id, next, undefined, token);
      dispatch(upsertOrder(updated));
      dispatch(showToast({ title: bn ? 'স্ট্যাটাস পরিবর্তন' : 'Status Updated', message: statusLabel(next, locale), type: 'success' }));
    } catch (e: any) { Alert.alert('Error', e?.message); }
  }

  function cancelOrder(order: Order) {
    Alert.prompt(
      bn ? 'বাতিলের কারণ' : 'Cancel Reason',
      bn ? 'কারণ লিখুন (ঐচ্ছিক)' : 'Enter reason (optional)',
      async (reason) => {
        if (!token) return;
        try {
          const updated = await ordersApi.updateOrderStatus(order.id, 'cancelled', reason || undefined, token);
          dispatch(upsertOrder(updated));
        } catch (e: any) { Alert.alert('Error', e?.message); }
      },
      'plain-text',
    );
  }

  function deleteOrder(order: Order) {
    Alert.alert(bn ? 'মুছবেন?' : 'Delete?', order.orderNumber, [
      { text: bn ? 'বাতিল' : 'Cancel', style: 'cancel' },
      { text: bn ? 'মুছুন' : 'Delete', style: 'destructive', onPress: async () => {
        if (!token) return;
        try { await ordersApi.deleteOrder(order.id, token); dispatch(removeOrder(order.id)); }
        catch (e: any) { Alert.alert('Error', e?.message); }
      }},
    ]);
  }

  async function submitPayment() {
    if (!token || !paymentOrder) return;
    const amt = Number(paymentAmt);
    if (!amt || amt <= 0) { Alert.alert(bn ? 'ত্রুটি' : 'Error', bn ? 'সঠিক পরিমাণ দিন' : 'Enter valid amount'); return; }
    setPaymentBusy(true);
    try {
      const payment = await ordersApi.addOrderPayment({ orderId: paymentOrder.id, amount: amt, notes: paymentNote.trim() || undefined }, token);
      dispatch(addPayment(payment));
      setPaymentOrder(null); setPaymentAmt(''); setPaymentNote('');
      dispatch(showToast({ title: bn ? 'পেমেন্ট রেকর্ড হয়েছে' : 'Payment Recorded', message: `${money.format(amt)}`, type: 'success' }));
    } catch (e: any) { Alert.alert('Error', e?.message); }
    finally { setPaymentBusy(false); }
  }

  const FilterTab = ({ tab, label, count }: { tab: Filter; label: string; count: number }) => (
    <Pressable onPress={() => setFilter(tab)} style={[styles.filterTab, filter === tab && styles.filterTabActive]}>
      <Text style={[styles.filterLabel, filter === tab && styles.filterLabelActive]}>{label}</Text>
      {count > 0 && (
        <View style={[styles.filterBadge, filter === tab && styles.filterBadgeActive]}>
          <Text style={styles.filterBadgeText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <MeshBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{bn ? 'অর্ডার' : 'Orders'}</Text>
          <Pressable onPress={() => setShowForm(true)} style={styles.newBtn}>
            <Text style={styles.newBtnText}>+ {bn ? 'নতুন' : 'New'}</Text>
          </Pressable>
        </View>

        {/* Filter tabs */}
        <View style={styles.filterBar}>
          <FilterTab tab="active" label={bn ? 'চলমান' : 'Active'} count={counts.active} />
          <FilterTab tab="delivered" label={bn ? 'সম্পন্ন' : 'Delivered'} count={counts.delivered} />
          <FilterTab tab="cancelled" label={bn ? 'বাতিল' : 'Cancelled'} count={counts.cancelled} />
        </View>

        {/* List */}
        {status === 'loading' && orders.length === 0 ? (
          <View style={styles.center}><ActivityIndicator color={palette.emerald} size="large" /></View>
        ) : (
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabPad + 24 }]} showsVerticalScrollIndicator={false}>
            {filtered.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>{bn ? 'কোনো অর্ডার নেই' : 'No orders'}</Text>
                <Text style={styles.emptyBody}>{bn ? 'নতুন অর্ডার নিতে + চাপুন' : 'Tap + to create a new order'}</Text>
              </View>
            ) : (
              filtered.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  items={orderItems.filter(oi => oi.orderId === order.id)}
                  payments={orderPayments.filter(p => p.orderId === order.id)}
                  locale={locale}
                  money={money}
                  products={products}
                  isAdmin={isAdmin}
                  isOwner={order.createdBy === userId}
                  onAdvance={() => advance(order)}
                  onCancel={() => cancelOrder(order)}
                  onDelete={() => deleteOrder(order)}
                  onEdit={() => setEditingOrder(order)}
                  onRecordPayment={() => setPaymentOrder(order)}
                />
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* New order bottom sheet */}
      {showForm && (
        <View style={styles.overlay}>
          <Pressable style={styles.overlayBg} onPress={() => setShowForm(false)} />
          <NewOrderForm
            products={products}
            currencies={currencies}
            stockByProduct={stockByProduct}
            locale={locale}
            onClose={() => setShowForm(false)}
            onCreated={order => { dispatch(upsertOrder(order)); setShowForm(false); dispatch(showToast({ title: bn ? 'অর্ডার তৈরি হয়েছে' : 'Order Created', message: order.orderNumber, type: 'success' })); }}
          />
        </View>
      )}

      {/* Edit order bottom sheet */}
      {editingOrder && (
        <View style={styles.overlay}>
          <Pressable style={styles.overlayBg} onPress={() => setEditingOrder(null)} />
          <EditOrderForm
            order={editingOrder}
            existingItems={orderItems.filter(oi => oi.orderId === editingOrder.id)}
            products={products}
            currencies={currencies}
            locale={locale}
            onClose={() => setEditingOrder(null)}
            onUpdated={(updated, updatedItems) => {
              dispatch(upsertOrder(updated));
              // Refresh orders to get updated items from server
              dispatch(fetchOrders());
              setEditingOrder(null);
              dispatch(showToast({ title: bn ? 'আপডেট হয়েছে' : 'Updated', message: updated.orderNumber, type: 'success' }));
            }}
          />
        </View>
      )}

      {/* Record Payment dialog */}
      {paymentOrder && (
        <View style={styles.overlayTop}>
          <Pressable style={styles.overlayBg} onPress={() => { setPaymentOrder(null); setPaymentAmt(''); setPaymentNote(''); }} />
          <View style={styles.payDialog}>
            <Text style={styles.payDialogTitle}>{bn ? '💳 পেমেন্ট রেকর্ড' : '💳 Record Payment'}</Text>
            <Text style={styles.payDialogSub}>{paymentOrder.orderNumber} · {paymentOrder.customerName}</Text>
            <Text style={styles.payDialogLabel}>{bn ? 'পরিমাণ (BDT) *' : 'Amount (BDT) *'}</Text>
            <TextInput
              value={paymentAmt}
              onChangeText={setPaymentAmt}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={palette.textMuted}
              style={styles.payDialogInput}
              autoFocus
            />
            <Text style={styles.payDialogLabel}>{bn ? 'নোট (ঐচ্ছিক)' : 'Note (optional)'}</Text>
            <TextInput
              value={paymentNote}
              onChangeText={setPaymentNote}
              placeholder={bn ? 'যেমন: বকেয়া পেমেন্ট' : 'e.g. partial payment'}
              placeholderTextColor={palette.textMuted}
              style={styles.payDialogInput}
            />
            <View style={styles.payDialogActions}>
              <Pressable onPress={() => { setPaymentOrder(null); setPaymentAmt(''); setPaymentNote(''); }} style={styles.payDialogCancel}>
                <Text style={{ color: palette.textMuted, fontWeight: '800' }}>{bn ? 'বাতিল' : 'Cancel'}</Text>
              </Pressable>
              <Pressable onPress={submitPayment} disabled={paymentBusy} style={[styles.payDialogConfirm, paymentBusy && { opacity: 0.5 }]}>
                {paymentBusy ? <ActivityIndicator color={palette.onAccent} size="small" /> : <Text style={{ color: palette.onAccent, fontWeight: '900' }}>{bn ? 'সংরক্ষণ' : 'Save'}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  title: { color: palette.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  newBtn: { backgroundColor: palette.emerald, borderRadius: radii.md, paddingHorizontal: 16, paddingVertical: 9, shadowColor: palette.emerald, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  newBtnText: { color: palette.onAccent, fontSize: 14, fontWeight: '900' },
  filterBar: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 10, backgroundColor: palette.cardBgElevated, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.cardBorder, padding: 4, gap: 4 },
  filterTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radii.md, gap: 6 },
  filterTabActive: { backgroundColor: palette.night, shadowColor: palette.emerald, shadowOpacity: 0.20, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  filterLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  filterLabelActive: { color: palette.emerald, fontWeight: '900' },
  filterBadge: { backgroundColor: palette.cardBgPrimary, borderRadius: 999, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  filterBadgeActive: { backgroundColor: palette.emeraldLight },
  filterBadgeText: { color: palette.text, fontSize: 10, fontWeight: '900' },
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  emptyBody: { color: palette.textMuted, fontSize: 14, fontWeight: '600' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 99999, elevation: 99 },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-start', zIndex: 99999, elevation: 99 },
  overlayBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.60)' },
  payDialog: { backgroundColor: palette.cardBgPrimary, borderBottomLeftRadius: radii.xl, borderBottomRightRadius: radii.xl, padding: 24, paddingTop: 56, gap: 10 },
  payDialogTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  payDialogSub: { color: palette.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  payDialogLabel: { color: palette.textLabel, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  payDialogInput: { borderWidth: 1, borderColor: palette.stroke, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, color: palette.text, backgroundColor: palette.inputInset, fontSize: 16, fontWeight: '700' },
  payDialogActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  payDialogCancel: { flex: 1, paddingVertical: 13, borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorder, alignItems: 'center' },
  payDialogConfirm: { flex: 1, paddingVertical: 13, borderRadius: radii.md, backgroundColor: palette.success, alignItems: 'center', shadowColor: palette.success, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});
