import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Theme } from '../../constants/theme';

export type TabType = 'Semanal' | 'Mensual' | 'Total';

interface StatsTabsProps {
  /** El tab seleccionado actualmente */
  activeTab: TabType;
  /** Función callback cuando se cambia de tab */
  onTabChange: (tab: TabType) => void;
}

/**
 * Componente de Tabs (conmutador) para filtrar estadísticas por rango de tiempo.
 * Diseñado con una estética moderna de "píldora" o selector segmentado.
 */
export const StatsTabs: React.FC<StatsTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs: TabType[] = ['Semanal', 'Mensual', 'Total'];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            activeOpacity={0.7}
            onPress={() => onTabChange(tab)}
            style={[styles.tab, isActive && styles.activeTab]}
          >
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.border,
    padding: 4,
    borderRadius: 14,
    marginVertical: Theme.spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: Theme.colors.cardBackground,
    ...Theme.shadows.soft,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  activeTabText: {
    color: Theme.colors.primary,
  },
});
