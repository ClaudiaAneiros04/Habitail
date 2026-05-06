import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ContributionGraph } from 'react-native-chart-kit';
import { Theme } from '../../constants/theme';
import { format, subDays, eachDayOfInterval } from 'date-fns';

/**
 * Interface para los datos de cada entrada del heatmap
 */
interface ContributionValue {
  date: string;
  count: number;
}

/**
 * HabitHeatmap - Visualización de 52 semanas de actividad.
 * 
 * Este componente utiliza ContributionGraph de react-native-chart-kit para
 * mostrar la frecuencia y consistencia de los hábitos del usuario en el último año.
 */
export const HabitHeatmap: React.FC = () => {
  /**
   * Genera datos de prueba (Mock Data) para los últimos 365 días.
   * Asigna valores del 0 al 3 para representar los 4 niveles de completitud.
   */
  const generateMockData = (): ContributionValue[] => {
    const today = new Date();
    const startDate = subDays(today, 364);
    const days = eachDayOfInterval({ start: startDate, end: today });

    return days.map(day => {
      const randomValue = Math.random();
      let count = 0;

      // Mapeo de probabilidad para los niveles requeridos:
      // 0: Sin datos, 1: <25%, 2: <75%, 3: 100%
      if (randomValue > 0.8) count = 3;      // 20% probabilidad de 100%
      else if (randomValue > 0.4) count = 2; // 40% probabilidad de <75%
      else if (randomValue > 0.2) count = 1; // 20% probabilidad de <25%
      // 20% probabilidad de 0 (Sin datos)

      return {
        date: format(day, 'yyyy-MM-dd'),
        count: count
      };
    });
  };

  /**
   * API CONNECTION POINT: En una implementación real, esta función se reemplazaría
   * por una llamada al backend (ej: GET /stats/heatmap/:habitId).
   * Los datos deberían venir formateados como un array de objetos { date: 'YYYY-MM-DD', count: number }.
   */
  const chartData = generateMockData();

  /**
   * Configuración estética del gráfico basada en el sistema de diseño.
   */
  const chartConfig = {
    backgroundGradientFrom: Theme.colors.cardBackground,
    backgroundGradientTo: Theme.colors.cardBackground,
    // El color base es el primario del tema (Indigo 500)
    // El gráfico aplicará opacidad automáticamente según el valor del 'count'
    color: (opacity = 1) => {
      // Aseguramos que el color se vea bien incluso con opacidad baja
      return `rgba(99, 102, 241, ${opacity})`;
    },
    labelColor: (opacity = 1) => Theme.colors.textSecondary,
    strokeWidth: 2,
    // Estilo de los cuadros (opcional si la librería lo soporta en este componente)
    propsForLabels: {
      fontSize: 10,
      fontWeight: '600',
    }
  };

  /**
   * Manejador para las etiquetas de los meses en español abreviado.
   */
  const getMonthLabel = (monthIndex: number): string => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return months[monthIndex];
  };

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
            values={chartData}
            endDate={new Date()}
            numDays={365}
            width={980} // Ancho calculado para ~52 semanas + márgenes
            height={220}
            chartConfig={chartConfig}
            accessor="count"
            getMonthLabel={getMonthLabel}
            tooltipDataAttrs={() => ({})}
            style={styles.chart}
          />
        </ScrollView>

        {/* Leyenda explicativa de los 4 niveles de color */}
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
  },
  scrollContent: {
    paddingRight: Theme.spacing.md,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    marginLeft: -16, // Ajuste para alinear con el borde izquierdo
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
