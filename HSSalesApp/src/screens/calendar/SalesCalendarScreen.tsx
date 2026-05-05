import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type SectionListRenderItemInfo,
  type ViewStyle,
} from 'react-native';
import {
  AgendaList,
  CalendarProvider,
  ExpandableCalendar,
} from 'react-native-calendars';
import type { MarkedDates } from 'react-native-calendars/src/types';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useT } from '../../i18n/useT';
import { useAppSelector } from '../../store/hooks';
import { palette, radii } from '../../theme/designSystem';
import {
  buildAgendaSections,
  filterSalesByRole,
  type SaleAgendaItem,
} from '../../utils/sales';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/mainStackTypes';

const calendarTheme = {
  backgroundColor: 'transparent',
  calendarBackground: palette.paper,
  monthTextColor: palette.text,
  textMonthFontWeight: '800' as const,
  dayTextColor: palette.text,
  textSectionTitleColor: palette.textMuted,
  textDisabledColor: 'rgba(13,27,17,0.22)',
  selectedDayBackgroundColor: palette.emerald,
  selectedDayTextColor: palette.onAccent,
  todayTextColor: palette.amber,
  dotColor: palette.calendarDotDeep,
  selectedDotColor: palette.calendarDotDeep,
  arrowColor: palette.text,
  /** Tighter rows so collapsed height matches the library’s fixed week strip. */
  weekVerticalMargin: 4,
  agendaDayTextColor: palette.textMuted,
  agendaDayNumColor: palette.text,
  agendaTodayColor: palette.amber,
  reservationsBackgroundColor: 'transparent',
  stylesheet: {
    expandable: {
      main: {
        weekContainer: {
          backgroundColor: palette.paper,
          zIndex: 2,
          elevation: 6,
        },
        week: {
          marginTop: 4,
          marginBottom: 4,
          backgroundColor: palette.paper,
        },
      },
    },
  },
};

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Prefer today if it has agenda rows; else the nearest future sale day; else the latest past sale day. */
function pickInitialAgendaDate(sectionTitles: string[]): string {
  const todayStr = ymd(new Date());
  if (sectionTitles.length === 0) return todayStr;

  const sorted = [...sectionTitles].sort();
  if (sorted.includes(todayStr)) return todayStr;

  const nearestFuture = sorted.find((t) => t > todayStr);
  if (nearestFuture) return nearestFuture;

  const beforeToday = sorted.filter((t) => t < todayStr);
  if (beforeToday.length > 0) {
    return beforeToday[beforeToday.length - 1]!;
  }
  return sorted[sorted.length - 1]!;
}

function formatAgendaSectionTitle(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const formatted = date
    .toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase();
  if (iso === ymd(new Date())) {
    return `TODAY, ${formatted}`;
  }
  return formatted;
}

function buildMarkedDates(sales: { saleDate: string }[]): MarkedDates {
  const days = new Set<string>();
  for (const s of sales) {
    days.add(s.saleDate);
  }

  const marked: MarkedDates = {};
  for (const date of days) {
    marked[date] = {
      dots: [{ color: palette.calendarDotDeep }],
    };
  }
  return marked;
}

export function SalesCalendarScreen() {
  const t = useT();
  const tabBottomPad = useTabScreenBottomPadding();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const user = useAppSelector((s) => s.auth.user);
  const { sales, salesItems, products, warehouses, users, status, error } =
    useAppSelector((s) => s.salesData);

  const visibleSales = useMemo(() => {
    if (!user) return [];
    return filterSalesByRole(sales, user.role, user.id);
  }, [sales, user]);

  const sections = useMemo(
    () =>
      buildAgendaSections(visibleSales, salesItems, products, warehouses),
    [visibleSales, salesItems, products, warehouses],
  );

  const markedDates = useMemo(
    () => buildMarkedDates(visibleSales),
    [visibleSales],
  );  // Capture the anchor date ONLY once when data succeeds.
  // This prevents parent re-renders from resetting the calendar's swipe position.
  const todayStr = useMemo(() => ymd(new Date()), []);
  const initialDate = useMemo(() => {
    const titles = sections.map((s) => s.title);
    return pickInitialAgendaDate(titles);
  }, [sections]);

  // Use a local state that defaults to Today immediately, then updates on data success.
  const [selectedDate, setSelectedDate] = useState(todayStr);

  useEffect(() => {
    if (status === 'succeeded') {
      setSelectedDate(initialDate);
    }
  }, [status, initialDate]);

  const onCalendarDateChanged = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const renderItem = ({
    item,
    index,
    section,
  }: SectionListRenderItemInfo<SaleAgendaItem>) => {
    const isAdmin = user?.role === 'admin';
    const seller = isAdmin ? users.find((u) => u.id === item.createdBy) : null;

    const isLastInDay = index === section.data.length - 1;
    const cardStyle: ViewStyle = {
      ...styles.card,
      ...(index > 0 ? styles.cardStacked : {}),
      ...(isLastInDay ? styles.cardLastInDay : {}),
    };

    return (
      <Pressable
        onPress={() => navigation.navigate('SaleDetails', { saleId: item.id })}
        style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
        <GlassCard
          style={cardStyle}
          accentColor={isAdmin ? palette.emeraldDeep : palette.emerald}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {seller && (
            <View style={styles.sellerRow}>
              <Text style={styles.sellerName}>{seller.name}</Text>
              {!!seller.phone && <Text style={styles.sellerPhone}> • {seller.phone}</Text>}
            </View>
          )}
          <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
          <Text style={styles.cardMeta}>{item.meta}</Text>
        </GlassCard>
      </Pressable>
    );
  };

  const renderSectionHeader = useCallback((title: string) => {
    return (
      <View style={styles.sectionHeaderWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel} numberOfLines={1}>
            {formatAgendaSectionTitle(title)}
          </Text>
          <View style={styles.sectionRule} />
        </View>
      </View>
    );
  }, []);

  return (
    <MeshBackground>
      <SafeAreaView
        style={styles.safe}
        edges={['top']}>
        <ScreenHeader title={t('calendar.tagAll')} />

        {status === 'loading' && sales.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.emerald} />
            <Text style={styles.centerText}>{t('common.loading')}</Text>
          </View>
        ) : status === 'failed' ? (
          <View style={styles.center}>
            <GlassCard
              style={{ marginHorizontal: 20 }}
              accentColor={user?.role === 'admin' ? palette.emeraldDeep : palette.emerald}>
              <Text style={styles.error}>{error}</Text>
            </GlassCard>
            <Text style={styles.centerText}>{t('common.apiHint')}</Text>
          </View>
        ) : (
          <View style={styles.calendarShell}>
            <CalendarProvider
              style={styles.calendarProvider}
              date={selectedDate}
              onDateChanged={onCalendarDateChanged}
              disabledOpacity={0.35}>
              <View style={styles.expandableWrap}>
                <ExpandableCalendar
                  horizontal
                  markedDates={markedDates}
                  markingType="multi-dot"
                  theme={calendarTheme}
                  firstDay={1}
                  allowShadow={false}
                  hideArrows={false}
                  hideExtraDays={false}
                  pastScrollRange={50}
                  futureScrollRange={50}
                  openThreshold={25}
                  closeThreshold={-40}
                closeOnDayPress={false}
                  calendarStyle={{ backgroundColor: palette.paper }}
                  initialPosition={ExpandableCalendar.positions.OPEN}
                />
              </View>
              <AgendaList
                sections={sections}
                renderItem={renderItem}
                renderSectionHeader={
                  renderSectionHeader as unknown as React.ComponentProps<
                    typeof AgendaList
                  >['renderSectionHeader']
                }
                stickySectionHeadersEnabled={false}
                scrollToNextEvent={false}
                avoidDateUpdates={false}
                viewOffset={8}
                keyExtractor={(item) => item.id}
                theme={calendarTheme}
                style={styles.listWrap}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: tabBottomPad + 28 },
                ]}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No sales yet</Text>
                    <Text style={styles.emptyBody}>
                      Add rows to `sales` / `salesItems` in `backend-json-server/db.json`
                      and reload.
                    </Text>
                  </View>
                }
              />
            </CalendarProvider>
          </View>
        )}
      </SafeAreaView>
    </MeshBackground>
  );
}

const money = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  maximumFractionDigits: 0,
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  calendarShell: {
    flex: 1,
    minHeight: 0,
    paddingTop: 8,
  },
  calendarProvider: {
    flex: 1,
  },
  expandableWrap: {
    zIndex: 8,
    elevation: 8,
  },
  listWrap: { flex: 1 },
  listContent: {
    paddingBottom: 120,
    paddingTop: 12,
  },
  sectionHeaderWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionLabel: {
    flexShrink: 1,
    color: palette.textMuted,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 12,
    backgroundColor: 'transparent',
  },
  /** Hairline continues from the end of the date text (same row). */
  sectionRule: {
    flex: 1,
    minWidth: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.stroke,
  },
  card: {
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: radii.lg,
  },
  /** Same calendar day — sit closer to the card above. */
  cardStacked: {
    marginTop: 2,
  },
  /** Last sale of the day — keep room before the next date header. */
  cardLastInDay: {
    marginBottom: 14,
  },
  cardTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  sellerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  sellerName: { color: palette.text, fontSize: 13, fontWeight: '900' },
  sellerPhone: { color: palette.emeraldDeep, fontSize: 12, fontWeight: '800' },
  cardSubtitle: {
    marginTop: 6,
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  cardMeta: {
    marginTop: 10,
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  center: { paddingHorizontal: 20, paddingTop: 26, gap: 10 },
  centerText: { color: palette.textMuted, fontWeight: '600' },
  error: { color: palette.danger, fontWeight: '900' },
  empty: { paddingHorizontal: 26, paddingTop: 26 },
  emptyTitle: { color: palette.text, fontSize: 16, fontWeight: '900' },
  emptyBody: { marginTop: 8, color: palette.textMuted, lineHeight: 20 },
});
