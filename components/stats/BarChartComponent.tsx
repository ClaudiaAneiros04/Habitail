import React from 'react';
import { View, Text, StyleSheet, Dimensions, Alert, TouchableOpacity } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Theme } from '../../constants/theme';
import { ChartData } from '../../utils/chartAggregator';

/**
 * Props para el componente BarChartComponent
 */
interface BarChartComponentProps {
  /** Modo de visualización: semanal, mensual o total */
  mode: 'weekly' | 'monthly' | 'total';
  /** 
   * Datos estructurados obtenidos de aggregateChartData.
   */
  data: ChartData[];
}

/**
 * Componente que muestra un gráfico de barras de estadísticas.
 * Utiliza react-native-chart-kit para la visualización.
 */
export const BarChartComponent: React.FC<BarChartComponentProps> = ({ mode, data }) => {
  // Calculamos el ancho exacto: 
  // ScrollView (2 * md) + Contenedor (2 * md) = 4 * md. Le restamos 15px extra para poder desplazarlo a la derecha.
  const screenWidth = Dimensions.get('window').width - (Theme.spacing.md * 4) - 15;

  // Extraemos labels y valores para el gráfico
  const chartLabels = data.map(d => d.label);
  const chartValues = data.map(d => d.value);

  /**
   * Maneja el evento de presionar una barra mostrando detalles precisos.
   */
  const handleBarPress = (index: number) => {
    const item = data[index];
    if (!item) return;
    
    const detailText = item.total > 0 
      ? `${item.completed}/${item.total} días completados`
      : 'Sin hábitos programados';

    Alert.alert(
      'Detalle de Cumplimiento',
      `${item.label}: ${item.value}% \n(${detailText})`,
      [{ text: 'Entendido', style: 'default' }]
    );
  };

  const chartConfig = {
    backgroundColor: Theme.colors.cardBackground,
    backgroundGradientFrom: Theme.colors.cardBackground,
    backgroundGradientTo: Theme.colors.cardBackground,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    barPercentage: 0.6,
    propsForBackgroundLines: {
      strokeDasharray: '0', 
      stroke: '#f1f5f9',
    },
  };

  const barChartData = {
    labels: chartLabels,
    datasets: [{ 
      data: chartValues.length > 0 ? chartValues : [0],
      colors: chartValues.length > 0 
        ? chartValues.map(val => (opacity = 1) => val >= 100 ? `rgba(34, 197, 94, ${opacity})` : `rgba(99, 102, 241, ${opacity})`)
        : [(opacity = 1) => `rgba(99, 102, 241, ${opacity})`]
    }],
  };

  const getTitle = () => {
    switch (mode) {
      case 'weekly': return 'Progreso Semanal';
      case 'monthly': return 'Progreso Mensual';
      case 'total': return 'Progreso Histórico';
      default: return 'Progreso';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{getTitle()}</Text>
      </View>

      <View style={styles.chartWrapper}>
        <BarChart
          data={barChartData}
          width={screenWidth}
          height={240}
          yAxisLabel=""
          yAxisSuffix="%"
          chartConfig={chartConfig}
          verticalLabelRotation={0}
          fromZero={true}
          showBarTops={false}
          withInnerLines={true}
          withCustomBarColorFromData={true}
          segments={5}
          style={styles.chart}
        />
        
        <View style={styles.overlayContainer}>
          {data.map((_, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              style={[
                styles.touchArea,
                { width: (screenWidth - 60) / (data.length || 1) }
              ]}
              onPress={() => handleBarPress(index)}
            />
          ))}
        </View>
      </View>
      
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: Theme.colors.primary }]} />
        <Text style={styles.legendText}>Tasa de éxito (%)</Text>
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
    paddingRight: 40,
    marginLeft: 15, // Desplaza todo el bloque del gráfico 15px a la derecha para dar aire a los números
  },
  overlayContainer: {
    position: 'absolute',
    left: 45,
    right: 15,
    top: 10,
    bottom: 40,
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

