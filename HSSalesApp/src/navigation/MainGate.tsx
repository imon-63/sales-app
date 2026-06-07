import React, { useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchNotifications } from '../store/slices/notificationsSlice';
import { fetchOrders } from '../store/slices/ordersSlice';
import { fetchSalesDataset } from '../store/slices/salesDataSlice';
import { liveClient } from '../utils/liveClient';

import { MainAppStack } from './MainAppStack';

export function MainGate() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    dispatch(fetchSalesDataset());
  }, [dispatch]);

  useEffect(() => {
    if (user) {
      liveClient.connect(user);
    }
    return () => {
      liveClient.disconnect();
    };
  }, [user]);

  // Initial data load — notifications come via live WebSocket push after this
  useEffect(() => {
    if (!user) return;
    dispatch(fetchNotifications());
    dispatch(fetchOrders());
    // Orders still poll (status changes happen server-side; no WS push for order status yet)
    const ordersId = setInterval(() => dispatch(fetchOrders()), 60_000);
    return () => clearInterval(ordersId);
  }, [dispatch, user]);

  return <MainAppStack />;
}
