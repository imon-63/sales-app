import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { MarkedDates } from 'react-native-calendars/src/types';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { SelectMenu } from '../../components/ui/SelectMenu';
import { useT } from '../../i18n/useT';
import { useAppSelector } from '../../store/hooks';
import { palette, radii } from '../../theme/designSystem';
import { sumRevenueForSales } from '../../utils/sales';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';

const adminCalendarTheme = {
  backgroundColor: palette.paper,
  calendarBackground: palette.paper,
  monthTextColor: palette.text,
  textMonthFontWeight: '800' as const,
  dayTextColor: palette.text,
  textDisabledColor: 'rgba(13,27,17,0.35)',
  selectedDayBackgroundColor: palette.emerald,
  selectedDayTextColor: palette.onAccent,
  todayTextColor: palette.emerald,
  arrowColor: palette.text,
  dotColor: palette.emeraldDeep,
  selectedDotColor: palette.onAccent,
};

export function AdminDashboardScreen() {
  const t = useT();
  const locale = useAppSelector((s) => s.ui.locale);
  const user = useAppSelector((s) => s.auth.user);
  const { sales, salesItems, warehouses, salesItemAllocations, users, status, error } =
    useAppSelector((s) => s.salesData);

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
        style: 'currency',
        currency: 'BDT',
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  /** `'ALL'` = every salesperson; otherwise a sales user's id (`Sale.createdBy`). */
  const [salesPersonFilter, setSalesPersonFilter] = useState<string>('ALL');

  const salesPersonOptions = useMemo(() => {
    const salesOnly = users
      .filter((u) => u.role === 'sales')
      .slice()
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, undefined, { sensitivity: 'base' }));
    return [
      { value: 'ALL', label: t('dashboard.admin.allSalesPeople') },
      ...salesOnly.map((u) => ({
        value: u.id,
        label: u.name?.trim() ? u.name : u.email,
      })),
    ];
  }, [users, t]);

  const markedDates: MarkedDates = useMemo(() => {
    const m: MarkedDates = {};
    const relevantSales =
      salesPersonFilter === 'ALL'
        ? sales
        : sales.filter((s) => s.createdBy === salesPersonFilter);
    for (const s of relevantSales) {
      const d = s.saleDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const prev = m[d];
      m[d] = {
        ...(typeof prev === 'object' && prev ? prev : {}),
        marked: true,
        dotColor: palette.emeraldDeep,
      };
    }
    const sel = m[selectedDate];
    m[selectedDate] = {
      ...(typeof sel === 'object' && sel ? sel : {}),
      selected: true,
      selectedColor: palette.emerald,
      selectedTextColor: palette.onAccent,
    };
    return m;
  }, [sales, selectedDate, salesPersonFilter]);

  const dailySales = useMemo(() => {
    let list = sales.filter((s) => s.saleDate === selectedDate);
    if (salesPersonFilter !== 'ALL') {
      list = list.filter((s) => s.createdBy === salesPersonFilter);
    }
    return list;
  }, [sales, selectedDate, salesPersonFilter]);

  const dailySaleIds = useMemo(() => new Set(dailySales.map((s) => s.id)), [dailySales]);

  const revenue = useMemo(
    () => sumRevenueForSales(dailySaleIds, salesItems),
    [dailySaleIds, salesItems],
  );

  const totalCost = useMemo(() => {
    let cost = 0;
    for (const item of salesItems) {
      if (!dailySaleIds.has(item.saleId)) continue;
      const itemAllocations = salesItemAllocations.filter(a => a.salesItemId === item.id);
      for (const alloc of itemAllocations) {
        cost += (alloc.quantityAllocated * alloc.unitCostAtTime);
      }
    }
    return cost;
  }, [dailySaleIds, salesItems, salesItemAllocations]);

  const profit = revenue - totalCost;
  const marginPercentage = revenue > 0 ? (profit / revenue) * 100 : 0;

  const tabBottomPad = useTabScreenBottomPadding();

  return (
    <MeshBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.profileCard}>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name || 'A').charAt(0)}</Text>
            </View>
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>
                  {user?.name || t('dashboard.admin.fallbackName')}
                </Text>
                <View style={styles.dateTreeBadge}>
                  <Text style={styles.dateTreeIcon} accessibilityElementsHidden>
                    🌴
                  </Text>
                </View>
              </View>
              <Text style={styles.welcomeBack}>Welcome Back!</Text>
            </View>
          </View>

          <View style={styles.greetingRow}>
            <View style={styles.greetingText}>
              <Text style={styles.hello}>{t('dashboard.admin.overview')}</Text>
              <Text style={styles.todaySummary}>
                {t('dashboard.admin.ordersDate', { n: dailySales.length, date: selectedDate })}
              </Text>
            </View>
            <View style={styles.dateControl}>
              <Text style={styles.dateLabel}>{t('dashboard.admin.date')}</Text>
              <Pressable
                onPress={() => setCalendarOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.admin.date')}
                style={({ pressed }) => [
                  styles.dateInputWrap,
                  pressed && styles.dateInputWrapPressed,
                ]}>
                <Text style={styles.dateInputText}>{selectedDate}</Text>
                <View style={styles.dateIconBadge}>
                  <Text style={styles.dateInputIcon} accessibilityElementsHidden>
                    🗓
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          <View style={styles.salesPersonRow}>
            <SelectMenu
              label={t('dashboard.admin.salesPerson')}
              value={salesPersonFilter}
              options={salesPersonOptions}
              onChange={setSalesPersonFilter}
              disabled={status === 'loading'}
            />
          </View>
        </View>

        <Modal
          visible={calendarOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setCalendarOpen(false)}>
          <View style={styles.modalRoot}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setCalendarOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            />
            <View style={styles.modalCenter} pointerEvents="box-none">
              <View style={styles.modalCard}>
                <Calendar
                  style={styles.modalCalendar}
                  current={selectedDate}
                  markedDates={markedDates}
                  onDayPress={(day) => {
                    setSelectedDate(day.dateString);
                    setCalendarOpen(false);
                  }}
                  enableSwipeMonths
                  theme={adminCalendarTheme}
                />
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => setCalendarOpen(false)}
                    style={({ pressed }) => [
                      styles.modalCancel,
                      pressed && styles.modalCancelPressed,
                    ]}>
                    <Text style={styles.modalCancelText}>{t('common.close')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setCalendarOpen(false)}
                    style={({ pressed }) => [
                      styles.modalDone,
                      pressed && styles.modalDonePressed,
                    ]}>
                    <Text style={styles.modalDoneText}>{t('common.done')}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {status === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.emerald} />
            <Text style={styles.hint}>{t('common.loading')}</Text>
          </View>
        ) : status === 'failed' ? (
          <View style={styles.center}>
            <Text style={styles.err}>{error}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: tabBottomPad + 40 }]}
            showsVerticalScrollIndicator={false}>
            
            <View style={styles.mainKpi}>
              <GlassCard style={styles.profitCard}>
                <View style={styles.kpiHead}>
                  <View style={styles.kpiIcon}>
                    <Text style={styles.kpiIconText}>💰</Text>
                  </View>
                  <Text style={styles.kpiLabel}>{t('dashboard.admin.netProfit')}</Text>
                  <View style={[styles.marginBadge, profit >= 0 ? styles.marginPositive : styles.marginNegative]}>
                    <Text style={styles.marginText}>
                      {t('dashboard.admin.marginPct', { n: marginPercentage.toFixed(1) })}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.profitVal, profit < 0 && { color: palette.rose }]}>
                  {money.format(profit)}
                </Text>
                <View style={styles.pnlVisual}>
                  <View style={[styles.pnlBar, { flex: Math.max(totalCost, 1) / Math.max(revenue, 1), backgroundColor: 'rgba(180, 220, 190, 0.3)' }]} />
                  <View style={[styles.pnlBar, { flex: Math.max(profit, 0) / Math.max(revenue, 1), backgroundColor: palette.emeraldDeep }]} />
                </View>
                <View style={styles.pnlLegend}>
                  <Text style={styles.legendText}>
                    {t('dashboard.admin.cost', { v: money.format(totalCost) })}
                  </Text>
                  <Text style={styles.legendText}>
                    {t('dashboard.admin.revenue', { v: money.format(revenue) })}
                  </Text>
                </View>
              </GlassCard>
            </View>

            <View style={styles.dailyLog}>
              <Text style={styles.sectionTitle}>{t('dashboard.admin.activity')}</Text>
              {dailySales.length > 0 ? (
                dailySales.map((s) => {
                  const sRevenue = sumRevenueForSales(new Set([s.id]), salesItems);
                  let sCost = 0;
                  const sItems = salesItems.filter(si => si.saleId === s.id);
                  for (const si of sItems) {
                    const allocs = salesItemAllocations.filter(a => a.salesItemId === si.id);
                    for (const a of allocs) sCost += (a.quantityAllocated * a.unitCostAtTime);
                  }
                  const sProfit = sRevenue - sCost;
                  const wh =
                    warehouses.find((w) => w.id === s.warehouseId)?.name ||
                    t('dashboard.admin.warehouse');
                  
                  return (
                    <GlassCard key={s.id} style={styles.saleCard}>
                      <View style={styles.saleHeader}>
                        <View style={styles.whBadge}>
                          <Text style={styles.whIcon}>🏠</Text>
                          <Text style={styles.whName}>{wh}</Text>
                        </View>
                        <Text style={[styles.saleProfit, sProfit < 0 && { color: palette.rose }]}>
                          {sProfit >= 0 ? '+' : ''}{money.format(sProfit)}
                        </Text>
                      </View>
                      
                      <View style={styles.saleDetails}>
                        <Text style={styles.saleNote} numberOfLines={1}>
                          {s.notes || '—'}
                        </Text>
                        <Text style={styles.saleRevenue}>
                          {t('dashboard.admin.saleTotal', { v: money.format(sRevenue) })}
                        </Text>
                      </View>

                      <View style={styles.miniPnl}>
                        <View style={[styles.miniBar, { width: (sCost / Math.max(sRevenue, 1)) * 100 + '%', backgroundColor: 'rgba(180, 220, 190, 0.15)' }]} />
                        <View style={[styles.miniBar, { width: (Math.max(sProfit, 0) / Math.max(sRevenue, 1)) * 100 + '%', backgroundColor: palette.emerald }]} />
                      </View>
                    </GlassCard>
                  );
                })
              ) : (
                <GlassCard style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>{t('dashboard.admin.noSales')}</Text>
                  <Text style={styles.emptyBody}>{t('dashboard.admin.noSalesBody')}</Text>
                </GlassCard>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingBottom: 16 },
  greetingRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    marginTop: -8,
  },
  profileCard: {
    marginLeft: 24,
    marginRight: 72,
    marginBottom: 16,
    marginTop: 16,
    padding: 16,
    position: 'relative',
    borderRadius: radii.xl,
    backgroundColor: 'rgba(0, 230, 118, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  adminBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderTopRightRadius: radii.xl,
    borderBottomLeftRadius: radii.sm,
    backgroundColor: palette.emeraldDeep,
  },
  adminBadgeText: {
    color: palette.onAccent,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.onAccent,
    fontSize: 20,
    fontWeight: '900',
  },
  userInfo: { flex: 1, gap: 2 },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif-medium',
      default: undefined,
    }),
  },
  dateTreeBadge: {
    marginTop: -1,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTreeIcon: {
    fontSize: 24,
    lineHeight: 24,
    color: '#1E8E3E',
  },
  welcomeBack: {
    marginTop: 4,
    color: '#FFD60A',
    fontSize: 14,
    fontWeight: '900',
    textShadowColor: 'rgba(255, 214, 10, 0.98)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  greetingText: { flex: 1, paddingRight: 20 },
  hello: { 
    color: palette.emerald, 
    fontSize: 24, 
    fontWeight: '900', 
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 230, 118, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  todaySummary: { color: palette.textMuted, fontSize: 13, fontWeight: '600', marginTop: 4 },
  dateControl: { alignItems: 'flex-end' },
  dateLabel: { color: palette.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  dateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: palette.inputInset,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.stroke,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 108,
  },
  dateInputWrapPressed: { opacity: 0.88 },
  dateInputText: { color: palette.text, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  dateIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(157,255,117,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(191,255,159,0.28)',
    marginLeft: 2,
  },
  dateInputIcon: { fontSize: 12, opacity: 0.95 },
  salesPersonRow: {
    marginTop: 14,
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  modalRoot: { flex: 1 },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 54,
  },
  modalCard: {
    overflow: 'hidden',
    alignSelf: 'center',
    width: '86%',
    maxWidth: 330,
    borderRadius: radii.lg,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
  modalCalendar: {
    transform: [{ scaleY: 0.9 }],
    marginVertical: -10,
  },
  modalActions: {
    marginTop: 10,
    marginBottom: 8,
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(191,255,159,0.28)',
    backgroundColor: 'rgba(8,62,29,0.92)',
    alignItems: 'center',
  },
  modalCancelPressed: { opacity: 0.85 },
  modalCancelText: { color: palette.textMuted, fontWeight: '900', fontSize: 14 },
  modalDone: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: palette.emerald,
    alignItems: 'center',
  },
  modalDonePressed: { backgroundColor: palette.emeraldDeep },
  modalDoneText: { color: palette.onAccent, fontWeight: '900', fontSize: 15 },
  scroll: { paddingHorizontal: 20, paddingTop: 10, gap: 20 },
  mainKpi: { gap: 14 },
  profitCard: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(157, 255, 117, 0.28)',
    backgroundColor: 'rgba(14, 79, 39, 0.92)',
    shadowColor: '#A6FF8A',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  kpiIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(157, 255, 117, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(209, 255, 194, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIconText: { fontSize: 16 },
  kpiLabel: { color: palette.textMuted, fontSize: 14, fontWeight: '800', flex: 1 },
  marginBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  marginPositive: { backgroundColor: 'rgba(0, 230, 118, 0.15)' },
  marginNegative: { backgroundColor: 'rgba(255, 82, 82, 0.12)' },
  marginText: { color: palette.text, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  profitVal: {
    color: '#D8FFD0',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    textShadowColor: 'rgba(141, 255, 122, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 9,
  },
  pnlVisual: {
    height: 10,
    flexDirection: 'row',
    gap: 3,
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(209,255,194,0.16)',
  },
  pnlBar: { height: '100%' },
  pnlLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  legendText: { color: palette.textMuted, fontSize: 11, fontWeight: '700' },
  dailyLog: { gap: 12 },
  sectionTitle: { color: palette.text, fontSize: 17, fontWeight: '900', marginLeft: 4, marginBottom: 4 },
  saleCard: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(191, 255, 159, 0.14)',
    backgroundColor: 'rgba(8, 63, 30, 0.90)',
  },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  whBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(157, 255, 117, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(157, 255, 117, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  whIcon: { fontSize: 12 },
  whName: { color: palette.text, fontSize: 12, fontWeight: '800' },
  saleProfit: {
    color: palette.emerald,
    fontSize: 17,
    fontWeight: '900',
    textShadowColor: 'rgba(157,255,117,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  saleDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  saleNote: { color: palette.textMuted, fontSize: 13, fontWeight: '600', flex: 1, paddingRight: 10 },
  saleRevenue: { color: palette.text, fontSize: 12, fontWeight: '800' },
  miniPnl: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(191,255,159,0.14)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  miniBar: { height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  hint: { marginTop: 12, color: palette.textMuted, fontWeight: '600' },
  err: { color: palette.rose, fontWeight: '800', textAlign: 'center' },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  emptyBody: { marginTop: 8, color: palette.textMuted, fontSize: 14, textAlign: 'center', fontWeight: '600' },
});
