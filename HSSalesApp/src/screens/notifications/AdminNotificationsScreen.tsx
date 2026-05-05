import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../components/ui/GlassCard';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useT } from '../../i18n/useT';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchNotifications,
  markNotificationReadThunk,
} from '../../store/slices/notificationsSlice';
import type { AdminNotification } from '../../types/models';
import { palette } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/mainStackTypes';

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AdminNotificationsScreen() {
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const dispatch = useAppDispatch();
  const { items, status, error, lastFetchedAt } = useAppSelector((s) => s.notifications);
  const { users } = useAppSelector((s) => s.salesData);
  const tabBottomPad = useTabScreenBottomPadding();
  const listRef = useRef<FlatList<AdminNotification>>(null);
  const STALE_MS = 30_000;

  useFocusEffect(
    useCallback(() => {
      // Always open this tab at top.
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });

      // Avoid repeated API calls on quick focus changes.
      const stale = !lastFetchedAt || Date.now() - lastFetchedAt > STALE_MS;
      if (status !== 'loading' && (status === 'idle' || stale)) {
        dispatch(fetchNotifications());
      }
    }, [dispatch, lastFetchedAt, status]),
  );

  const onOpen = useCallback(
    (n: AdminNotification) => {
      if (n.unread) {
        dispatch(markNotificationReadThunk(n.id));
      }
      if (n.type === 'lot_depleted' && n.lotId) {
        navigation.navigate('LotReport', { lotId: n.lotId });
      } else if (n.saleId) {
        navigation.navigate('SaleDetails', { saleId: n.saleId });
      }
    },
    [dispatch, navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: AdminNotification }) => {
      const seller = users.find((u) => u.id === item.actorUserId);
      const cardStyle: ViewStyle = item.unread
        ? { ...styles.card, ...styles.cardUnread }
        : styles.card;

      return (
      <Pressable onPress={() => onOpen(item)} style={({ pressed }) => [pressed && styles.rowPressed]}>
        <GlassCard style={cardStyle} accentColor={palette.emeraldDeep}>
          <View style={styles.cardTop}>
            <Text style={styles.title}>{item.title}</Text>
            {item.unread ? <View style={styles.dot} /> : null}
          </View>
          <Text style={styles.meta}>{formatWhen(item.createdAt)}</Text>
          {seller && (
            <View style={styles.sellerRow}>
              <Text style={styles.sellerName}>{seller.name}</Text>
              {!!seller.phone && <Text style={styles.sellerPhone}> • {seller.phone}</Text>}
            </View>
          )}
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.footer}>
            {item.type === 'lot_depleted' ? `Lot ID · ${item.lotId}` : `Sale ID · ${item.saleId?.slice(0, 8)}…`}
          </Text>
        </GlassCard>
      </Pressable>
      );
    },
    [onOpen, users],
  );

  return (
    <MeshBackground>
      <SafeAreaView
        style={styles.safe}
        edges={['top']}>
        <ScreenHeader title={t('notifications.title')} />

        {status === 'loading' && items.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.emerald} />
            <Text style={styles.hint}>{t('common.loading')}</Text>
          </View>
        ) : status === 'failed' ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.list, { paddingBottom: tabBottomPad }]}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListEmptyComponent={
              <GlassCard>
                <Text style={styles.emptyTitle}>{t('notifications.noAlerts')}</Text>
              </GlassCard>
            }
            refreshing={status === 'loading' && items.length > 0}
            onRefresh={() => {
              dispatch(fetchNotifications());
            }}
          />
        )}
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { marginTop: 10, color: palette.textMuted, fontWeight: '600' },
  error: { color: palette.danger, fontWeight: '700', textAlign: 'center' },
  card: { paddingVertical: 4 },
  cardUnread: {
    borderColor: palette.chipSelectedBorder,
    backgroundColor: 'rgba(200, 222, 140, 0.22)',
  },
  rowPressed: { opacity: 0.92 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: palette.text, fontSize: 16, fontWeight: '900', flex: 1, paddingRight: 8 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.emerald,
  },
  meta: { marginTop: 6, color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  sellerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  sellerName: { color: palette.text, fontSize: 13, fontWeight: '900' },
  sellerPhone: { color: palette.emeraldDeep, fontSize: 12, fontWeight: '800' },
  body: {
    marginTop: 10,
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  footer: {
    marginTop: 12,
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyTitle: { color: palette.text, fontSize: 16, fontWeight: '900' },
  emptyBody: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
