import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback } from 'react';
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
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchNotifications,
  markNotificationReadThunk,
} from '../../store/slices/notificationsSlice';
import type { AdminNotification } from '../../types/models';
import { palette } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';

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
  const dispatch = useAppDispatch();
  const { items, status, error } = useAppSelector((s) => s.notifications);
  const tabBottomPad = useTabScreenBottomPadding();

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchNotifications());
    }, [dispatch]),
  );

  const onOpen = useCallback(
    (n: AdminNotification) => {
      if (n.unread) {
        dispatch(markNotificationReadThunk(n.id));
      }
    },
    [dispatch],
  );

  const renderItem = useCallback(
    ({ item }: { item: AdminNotification }) => {
      const cardStyle: ViewStyle = item.unread
        ? { ...styles.card, ...styles.cardUnread }
        : styles.card;
      return (
      <Pressable onPress={() => onOpen(item)} style={({ pressed }) => [pressed && styles.rowPressed]}>
        <GlassCard style={cardStyle}>
          <View style={styles.cardTop}>
            <Text style={styles.title}>{item.title}</Text>
            {item.unread ? <View style={styles.dot} /> : null}
          </View>
          <Text style={styles.meta}>{formatWhen(item.createdAt)}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.footer}>Sale ID · {item.saleId.slice(0, 8)}…</Text>
        </GlassCard>
      </Pressable>
      );
    },
    [onOpen],
  );

  return (
    <MeshBackground>
      <SafeAreaView
        style={[styles.safe, { paddingBottom: tabBottomPad }]}
        edges={['top']}>
        <ScreenHeader
          title="Signals"
          subtitle="When a sales rep logs a sale, you see it here. Tap a row to mark it read."
          tag="Admin"
        />

        {status === 'loading' && items.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.emerald} />
            <Text style={styles.hint}>Loading alerts…</Text>
          </View>
        ) : status === 'failed' ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListEmptyComponent={
              <GlassCard>
                <Text style={styles.emptyTitle}>All quiet</Text>
                <Text style={styles.emptyBody}>
                  No notifications yet. When sales logs an order, the details land here.
                </Text>
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
