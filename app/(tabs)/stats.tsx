import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView, 
  StatusBar 
} from 'react-native';
import { Theme } from '../../constants/theme';
import { StatCard } from '../../components/stats/StatCard';
import { StatsTabs, TabType } from '../../components/stats/StatsTabs';
import { HabitSelector } from '../../components/stats/HabitSelector';
import { HabitHeatmap } from '../../components/stats/HabitHeatmap';
import { BarChartComponent } from '../../components/stats/BarChartComponent';

/**
 * StatsScreen - Pantalla principal de estadísticas.
 * 
 * Esta pantalla permite al usuario visualizar su progreso tanto a nivel global
 * como por hábito individual, filtrando por diferentes periodos de tiempo.
 */
export default function StatsScreen() {
  // Estado para el rango de tiempo seleccionado
  const [activeTab, setActiveTab] = useState<TabType>('Semanal');
  
  // Estado para el hábito seleccionado (por defecto "Vista Global")
  const [selectedHabit, setSelectedHabit] = useState('Vista Global');

  /**
   * MOCK DATA - En el futuro, estos datos se obtendrán de la API.
   * TODO: Conectar con el backend para obtener datos reales del usuario.
   * Se debería implementar un hook 'useStats' que reciba 'selectedHabit' y 'activeTab'.
   */
  const chartData = useMemo(() => {
    // Datos de ejemplo para la vista semanal (7 días: Lu-Do)
    const weeklyMock = [65, 80, 45, 90, 100, 30, 55];
    
    // Datos de ejemplo para la vista mensual (30 días aprox, agrupados por BarChartComponent)
    const monthlyMock = [
      80, 75, 90, 85, 70, 60, 95, // Semana 1
      40, 50, 45, 60, 55, 70, 65, // Semana 2
      90, 95, 100, 85, 90, 80, 85, // Semana 3
      70, 75, 80, 75, 85, 90, 95  // Semana 4
    ];

    if (activeTab === 'Semanal') return weeklyMock;
    return monthlyMock;
  }, [activeTab]);

  /**
   * Determina el modo del gráfico basado en el tab activo.
   * El BarChart maneja 'weekly' o 'monthly'.
   */
  const chartMode = activeTab === 'Semanal' ? 'weekly' : 'monthly';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Título de la sección */}
        <View style={styles.headerTextContainer}>
          <Text style={styles.screenTitle}>Rendimiento</Text>
          <Text style={styles.screenSubtitle}>Analiza tu progreso y mantén la constancia</Text>
        </View>

        {/* Selector de Hábito (Dropdown Skeleton) */}
        <HabitSelector 
          selectedHabit={selectedHabit} 
          onSelect={() => {
            // API CONNECTION POINT: Aquí se abriría un modal para elegir entre hábitos reales
            console.log('Abrir selector de hábitos');
          }} 
        />

        {/* Selector de Rango Temporal */}
        <StatsTabs 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />

        {/* Gráfico de Barras Detallado */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Análisis de cumplimiento</Text>
          <BarChartComponent 
            mode={chartMode} 
            data={chartData} 
          />
        </View>

        {/* Cuadrícula de Estadísticas 2x2 */}
        <View style={styles.gridSection}>
          <Text style={styles.sectionTitle}>Métricas clave</Text>
          <View style={styles.grid}>
            <View style={styles.row}>
              {/* API CONNECTION POINT: Estos valores vendrán calculados del backend */}
              <StatCard title="Racha Actual" value="5 días 🔥" />
              <StatCard title="Racha Máxima" value="12 días 🏆" />
            </View>
            <View style={styles.row}>
              <StatCard title="Tasa 7d" value="85.4%" />
              <StatCard title="Tasa 30d" value="72.1%" />
            </View>
          </View>
        </View>

        {/* Visualización de Actividad Anual (Heatmap) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actividad del año</Text>
          {/* API CONNECTION POINT: El heatmap requiere un array de objetos {date, count} */}
          <HabitHeatmap />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  container: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.xl,
  },
  headerTextContainer: {
    marginBottom: Theme.spacing.lg,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Theme.colors.text,
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  section: {
    marginVertical: Theme.spacing.sm,
  },
  gridSection: {
    marginTop: Theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.md,
    marginLeft: Theme.spacing.xs,
  },
  grid: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.sm,
  },
});


