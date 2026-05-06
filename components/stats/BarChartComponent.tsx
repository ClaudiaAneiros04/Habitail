import React from 'react';
import { View, Text, StyleSheet, Dimensions, Alert, TouchableOpacity } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Theme } from '../../constants/theme';

/**
 * Props para el componente BarChartComponent
 */
interface BarChartComponentProps {
  /** Modo de visualización: semanal (7 días) o mensual (agrupado por semanas) */
  mode: 'weekly' | 'monthly';
  /** 
   * Datos de completitud. 
   * Para 'weekly': se esperan exactamente 7 valores (0-100) representando Lu-Do.
   * Para 'monthly': se esperan datos diarios (28-31 valores) que se agruparán automáticamente,
   * o datos ya agrupados (4-5 valores).
   */
  data: number[];
}

/**
 * Componente que muestra un gráfico de barras de estadísticas.
 * Utiliza react-native-chart-kit para la visualización.
 */
export const BarChartComponent: React.FC<BarChartComponentProps> = ({ mode, data }) => {
  // Obtenemos el ancho de la pantalla para que el gráfico sea responsivo
  const screenWidth = Dimensions.get('window').width - (Theme.spacing.md * 2) - 16;

  /**
   * Lógica de procesamiento de datos:
   * Si es mensual y recibimos datos diarios, los agrupamos por semanas (7 días cada una).
   */
  const processedData = React.useMemo(() => {
    if (mode === 'monthly' && data.length > 7) {
      const weeks: number[] = [];
      for (let i = 0; i < data.length; i += 7) {
        const weekSlice = data.slice(i, i + 7);
        const average = weekSlice.reduce((acc, val) => acc + val, 0) / weekSlice.length;
        weeks.push(Math.round(average));
      }
      return weeks;
    }
    return data;
  }, [mode, data]);

  /**
   * Genera las etiquetas del eje X según el modo y los datos procesados
   */
  const labels = React.useMemo(() => {
    if (mode === 'weekly') {
      return ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
    }
    return processedData.map((_, index) => `Sem ${index + 1}`);
  }, [mode, processedData]);

  /**
   * Maneja el evento de presionar una barra emulando un tooltip.
   */
  const handleBarPress = (index: number) => {
    const value = processedData[index] || 0;
    const label = mode === 'weekly' ? labels[index] : `Semana ${index + 1}`;
    
    Alert.alert(
      'Estadísticas de Hábito',
      `${label}: ${value}% de completitud`,
      [{ text: 'Entendido', style: 'default' }]
    );
  };

  /**
   * Configuración visual del gráfico siguiendo el tema de la aplicación
   */
  const chartConfig = {
    backgroundColor: Theme.colors.cardBackground,
    backgroundGradientFrom: Theme.colors.cardBackground,
    backgroundGradientTo: Theme.colors.cardBackground,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`, // Theme.colors.primary
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`, // Theme.colors.textSecondary
    style: {
      borderRadius: 16,
    },
    barPercentage: 0.6,
    propsForBackgroundLines: {
      strokeDasharray: '0', 
      stroke: '#f1f5f9', // Slate 100
    },
  };

  const chartData = {
    labels: labels,
    datasets: [{ data: processedData }],
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {mode === 'weekly' ? 'Progreso Semanal' : 'Progreso Mensual'}
        </Text>
      </View>

      <View style={styles.chartWrapper}>
        <BarChart
          data={chartData}
          width={screenWidth}
          height={240}
          yAxisLabel=""
          yAxisSuffix="%"
          chartConfig={chartConfig}
          verticalLabelRotation={0}
          fromZero={true}
          showBarTops={false}
          withInnerLines={true}
          segments={5}
          style={styles.chart}
        />
        
        {/* Capa táctil overlay para interactividad */}
        <View style={styles.overlayContainer}>
          {processedData.map((_, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              style={[
                styles.touchArea,
                { width: (screenWidth - 60) / processedData.length }
              ]}
              onPress={() => handleBarPress(index)}
            />
          ))}
        </View>
      </View>
      
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: Theme.colors.primary }]} />
        <Text style={styles.legendText}>Completitud media</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: 24,
    padding: Theme.spacing.md,
    alignItems: 'center',
    ...Theme.shadows.medium,
    marginVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  header: {
    width: '100%',
    marginBottom: Theme.spacing.sm,
    paddingLeft: Theme.spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  chartWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    paddingRight: 40, // Espacio para el sufijo %
  },
  overlayContainer: {
    position: 'absolute',
    left: 45, // Ajuste para el eje Y
    right: 15,
    top: 10,
    bottom: 40, // Ajuste para las etiquetas del eje X
    flexDirection: 'row',
  },
  touchArea: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
});
