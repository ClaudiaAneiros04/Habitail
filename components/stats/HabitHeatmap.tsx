import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ContributionGraph } from 'react-native-chart-kit';
import { Theme } from '../../constants/theme';
import { useHeatmapData } from '../../hooks/useHeatmapData';
import { useUserStore } from '../../store/useUserStore';

/**
 * Props para HabitHeatmap
 */
interface HabitHeatmapProps {
  /** UUID del hábito para filtrar. Si es undefined, muestra vista global. */
  habitId?: string;
}

/**
 * HabitHeatmap - Visualización de 52 semanas de actividad real.
 * 
 * Consume el hook useHeatmapData para obtener la persistencia desde SQLite.
 */
export const HabitHeatmap: React.FC<HabitHeatmapProps> = ({ habitId }) => {
  const { user } = useUserStore();
  const currentYear = new Date().getFullYear();
  
  // Obtenemos los datos reales usando el hook de lógica
  const { data, isLoading, error } = useHeatmapData({
    habitId,
    userId: user?.id
  });

  /**
   * Configuración estética del gráfico basada en el sistema de diseño.
   */
  const chartConfig = {
    backgroundGradientFrom: Theme.colors.cardBackground,
    backgroundGradientTo: Theme.colors.cardBackground,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    labelColor: (opacity = 1) => Theme.colors.textSecondary,
    strokeWidth: 2,
    propsForLabels: {
      fontSize: 10,
      fontWeight: '600',
    }
  };

  const getMonthLabel = (monthIndex: number): string => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return months[monthIndex];
  };

  if (isLoading && data.length === 0) {
    return (
      <View style={[styles.card, styles.loadingContainer]}>
        <ActivityIndicator color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Cargando actividad...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.card, styles.errorContainer]}>
        <Text style={styles.errorText}>Error al cargar datos de actividad</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Actividad Anual</Text>

      <View style={styles.card}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ContributionGraph
            values={data}
            endDate={new Date(currentYear, 11, 31)}
            numDays={((currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0) ? 366 : 365}
            width={980}
            height={220}
            chartConfig={chartConfig}
            accessor="count"
            getMonthLabel={getMonthLabel}
            tooltipDataAttrs={() => ({})}
            style={styles.chart}
          />
        </ScrollView>

        <View style={styles.legendContainer}>
          <Text style={styles.legendLabel}>Menos</Text>
          <View style={[styles.legendSquare, { backgroundColor: '#f1f5f9' }]} />
          <View style={[styles.legendSquare, { backgroundColor: 'rgba(99, 102, 241, 0.3)' }]} />
          <View style={[styles.legendSquare, { backgroundColor: 'rgba(99, 102, 241, 0.6)' }]} />
          <View style={[styles.legendSquare, { backgroundColor: 'rgba(99, 102, 241, 1)' }]} />
          <Text style={styles.legendLabel}>Más</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.md,
    marginLeft: Theme.spacing.xs,
  },
  card: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: 24,
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    ...Theme.shadows.soft,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    minHeight: 150,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: Theme.colors.textSecondary,
    fontSize: 14,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2', // Añadimos un fondo rojizo muy tenue para armonizar
    borderWidth: 1,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContent: {
    paddingRight: Theme.spacing.md,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    marginLeft: -16,
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: Theme.spacing.xs,
    paddingRight: Theme.spacing.xs,
  },
  legendLabel: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginHorizontal: 6,
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginHorizontal: 2,
  },
});

