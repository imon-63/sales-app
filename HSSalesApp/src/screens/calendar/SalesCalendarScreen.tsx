import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useAppSelector } from '../../store/hooks';
import { palette, radii } from '../../theme/designSystem';
import {
  buildAgendaSections,
  filterSalesByRole,
  type SaleAgendaItem,
} from '../../utils/sales';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';

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
  const tabBottomPad = useTabScreenBottomPadding();
  const user = useAppSelector((s) => s.auth.user);
  const { sales, salesItems, products, warehouses, status, error } =
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
  );

  const initialDate = useMemo(() => {
    const titles = sections.map((s) => s.title);
    return pickInitialAgendaDate(titles);
  }, [sections]);

  /**
   * Keep `CalendarProvider`’s `date` prop aligned with internal context (via `onDateChanged`).
   * If the prop stays fixed while the agenda calls `setDate`, `useDidUpdate` in the provider can
   * reset the context to the stale prop — collapsed `Week` then shows the wrong row (e.g. first
   * week of the month).
   */
  const [providerDate, setProviderDate] = useState(initialDate);
  useEffect(() => {
    setProviderDate(initialDate);
  }, [initialDate]);

  const onCalendarDateChanged = useCallback((d: string) => {
    setProviderDate(d);
  }, []);

  const subtitle =
    user?.role === 'admin'
      ? 'Org-wide ledger — a dot marks any day with sales. Scroll the list — the calendar follows. Tap a day — the agenda jumps.'
      : 'Your deals only — same sync, scoped to your footprint.';

  const renderItem = ({
    item,
    index,
    section,
  }: SectionListRenderItemInfo<SaleAgendaItem>) => {
    const isLastInDay = index === section.data.length - 1;
    const cardStyle: ViewStyle = {
      ...styles.card,
      ...(index > 0 ? styles.cardStacked : {}),
      ...(isLastInDay ? styles.cardLastInDay : {}),
    };
    return (
      <GlassCard style={cardStyle}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
        <Text style={styles.cardMeta}>{item.meta}</Text>
      </GlassCard>
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
        style={[styles.safe, { paddingBottom: tabBottomPad }]}
        edges={['top']}>
        <ScreenHeader
          title="Pulse"
          subtitle={subtitle}
          tag={user?.role === 'admin' ? 'All sales' : 'My sales'}
        />

        {status === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.emerald} />
            <Text style={styles.centerText}>Loading agenda…</Text>
          </View>
        ) : status === 'failed' ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.centerText}>
              Start JSON Server: `cd backend-json-server && npm run dev`
            </Text>
          </View>
        ) : (
          <CalendarProvider
            key={user?.id ?? 'anon'}
            date={providerDate}
            onDateChanged={onCalendarDateChanged}
            disabledOpacity={0.35}>
            <ExpandableCalendar
              markedDates={markedDates}
              markingType="multi-dot"
              theme={calendarTheme}
              firstDay={1}
              allowShadow={false}
              /** Plain `Week` follows context `date`; avoids RecyclerList week-strip scroll bugs. */
              disableWeekScroll
              pastScrollRange={120}
              futureScrollRange={120}
              openThreshold={25}
              closeThreshold={-40}
              calendarStyle={{ backgroundColor: palette.paper }}
            />
            <View style={styles.listWrap}>
              <AgendaList
                sections={sections}
                renderItem={renderItem}
                // AgendaList calls this with the section date string; props inherit SectionList typings.
                renderSectionHeader={
                  renderSectionHeader as unknown as React.ComponentProps<
                    typeof AgendaList
                  >['renderSectionHeader']
                }
                stickySectionHeadersEnabled={false}
                scrollToNextEvent
                avoidDateUpdates={false}
                viewOffset={8}
                keyExtractor={(item) => item.id}
                theme={calendarTheme}
                contentContainerStyle={styles.listContent}
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
            </View>
          </CalendarProvider>
        )}
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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
  cardSubtitle: {
    marginTop: 8,
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
