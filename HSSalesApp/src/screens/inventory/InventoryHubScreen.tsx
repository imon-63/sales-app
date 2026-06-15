import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMenuButton } from '../../components/navigation/AppMenuButton';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchInventoryStock } from '../../store/slices/inventorySlice';
import { useAppSideMenu } from '../../navigation/useAppSideMenu';
import { palette, radii } from '../../theme/designSystem';

import { StockTab, ReceiveTab, MoveTab } from './sharedInventoryTabs';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TabKey = 'stock' | 'receive' | 'move';

const TABS: { key: TabKey; label: string; icon: string; adminOnly?: boolean }[] = [
  { key: 'stock',   label: 'Stock',   icon: '📦' },
  { key: 'receive', label: 'Receive', icon: '↙',  adminOnly: true },
  { key: 'move',    label: 'Move',    icon: '↔',  adminOnly: true },
];

export function InventoryHubScreen() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);
  const insets = useSafeAreaInsets();
  const { menuModal, openMenu } = useAppSideMenu();

  const [activeTab, setActiveTab] = useState<TabKey>('stock');

  const visibleTabs = TABS.filter(t => !t.adminOnly || role === 'admin');

  useFocusEffect(useCallback(() => {
    if (token) dispatch(fetchInventoryStock());
  }, [dispatch, token]));

  function switchTab(key: TabKey) {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setActiveTab(key);
  }

  return (
    <MeshBackground>
      <AppMenuButton onPress={openMenu} />
      {menuModal}
      <SafeAreaView style={hub.safe} edges={['top']}>

        {/* Header */}
        <View style={[hub.header, { paddingTop: insets.top + 10 }]}>
          <View style={hub.headerLeft}>
            <Text style={hub.title}>Inventory</Text>
            <Text style={hub.subtitle}>
              {activeTab === 'stock' ? 'Live stock levels' : activeTab === 'receive' ? 'Record incoming stock' : 'Move between warehouses'}
            </Text>
          </View>
        </View>

        {/* Tab selector */}
        <View style={hub.tabRow}>
          {visibleTabs.map((tab) => {
            const active = activeTab === tab.key;
            const accentColor = tab.key === 'move' ? palette.violet : palette.emerald;
            return (
              <Pressable
                key={tab.key}
                onPress={() => switchTab(tab.key)}
                style={({ pressed }) => [
                  hub.tabBtn,
                  active && { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}45` },
                  pressed && { opacity: 0.82 },
                ]}>
                <Text style={[hub.tabIcon, { opacity: active ? 1 : 0.4 }]}>{tab.icon}</Text>
                <Text style={[hub.tabLabel, { color: active ? accentColor : palette.textMuted }]}>{tab.label}</Text>
                {active && <View style={[hub.tabDot, { backgroundColor: accentColor }]} />}
              </Pressable>
            );
          })}
        </View>

        {/* Tab content — all mounted, hidden with display:none to preserve state */}
        <View style={[hub.panel, activeTab !== 'stock'   && hub.hidden]}><StockTab /></View>
        <View style={[hub.panel, activeTab !== 'receive' && hub.hidden]}><ReceiveTab /></View>
        <View style={[hub.panel, activeTab !== 'move'    && hub.hidden]}><MoveTab /></View>

      </SafeAreaView>
    </MeshBackground>
  );
}

const hub = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingLeft: 66, paddingRight: 20, paddingBottom: 14 },
  headerLeft: { gap: 2 },
  title: { color: palette.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { color: palette.textMuted, fontSize: 13, fontWeight: '600' },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 14,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: radii.lg,
    backgroundColor: palette.cardBgElevated,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    position: 'relative',
  },
  tabIcon: { fontSize: 16 },
  tabLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 0.2 },
  tabDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  panel: { flex: 1 },
  hidden: { display: 'none' },
});
