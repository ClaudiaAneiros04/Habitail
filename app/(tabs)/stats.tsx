import React, { useState } from 'react';
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
            // Aquí se implementaría la lógica para abrir un modal con la lista de hábitos
            console.log('Abrir selector de hábitos');
          }} 
        />

        {/* Selector de Rango Temporal */}
        <StatsTabs 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />

        {/* Cuadrícula de Estadísticas 2x2 */}
        <View style={styles.gridSection}>
          <Text style={styles.sectionTitle}>Métricas clave</Text>
          <View style={styles.grid}>
            <View style={styles.row}>
              <StatCard title="Racha Actual" value="5 días 🔥" />
              <StatCard title="Racha Máxima" value="12 días 🏆" />
            </View>
            <View style={styles.row}>
              <StatCard title="Tasa 7d" value="85.4%" />
              <StatCard title="Tasa 30d" value="72.1%" />
            </View>
          </View>
        </View>

        {/* Espacio reservado para gráficos futuros */}
        <View style={styles.chartPlaceholder}>
          <View style={styles.placeholderIcon} />
          <Text style={styles.placeholderTitle}>Visualización de Progreso</Text>
          <Text style={styles.placeholderText}>
            Próximamente: Gráficos de actividad y tendencias de cumplimiento.
          </Text>
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
  chartPlaceholder: {
    marginTop: Theme.spacing.xl,
    padding: Theme.spacing.xl,
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.background,
    marginBottom: Theme.spacing.md,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.xs,
  },
  placeholderText: {
    color: Theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
