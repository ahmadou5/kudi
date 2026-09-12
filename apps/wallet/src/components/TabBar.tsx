import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Home, ArrowLeftRight, ArrowDownCircle, Clock, LucideIcon } from 'lucide-react-native';
import { Typography } from '../../constants/typography';

export type TabType = 'home' | 'deposit' | 'spend' | 'history';

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  mode?: 'light' | 'dark';
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange, mode = 'dark' }) => {
  const isLight = mode === 'light';

  const tabs: { key: TabType; label: string; Icon: LucideIcon }[] = [
    { key: 'home', label: 'Home', Icon: Home },
    { key: 'spend', label: 'Spend', Icon: ArrowLeftRight },
    { key: 'deposit', label: 'Deposit', Icon: ArrowDownCircle },
    { key: 'history', label: 'History', Icon: Clock }
  ];

  return (
    <View style={styles.floatingContainer}>
      <View
        style={[
          styles.pillTabBar,
          {
            backgroundColor: isLight ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.12)',
            borderColor: isLight ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.2)'
          }
        ]}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const color = isActive
            ? isLight
              ? '#0F172A'
              : '#FFFFFF'
            : isLight
              ? '#94A3B8'
              : '#CBD5E1';
          const TabIcon = tab.Icon;

          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabItem,
                isActive && {
                  backgroundColor: isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.2)'
                }
              ]}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <TabIcon size={18} color={color} />

            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100
  },
  pillTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 35,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 10
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 25
  }
});
