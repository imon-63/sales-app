import React, { useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchNotifications } from '../store/slices/notificationsSlice';
import { fetchSalesDataset } from '../store/slices/salesDataSlice';

import { MainAppStack } from './MainAppStack';

export function MainGate() {
  const dispatch = useAppDispatch();
  const role = useAppSelector((s) => s.auth.user?.role);

  useEffect(() => {
    dispatch(fetchSalesDataset());
  }, [dispatch]);

  useEffect(() => {
    if (role !== 'admin') return;
    dispatch(fetchNotifications());
    const id = setInterval(() => {
      dispatch(fetchNotifications());
    }, 30000);
    return () => clearInterval(id);
  }, [dispatch, role]);

  return <MainAppStack />;
}
