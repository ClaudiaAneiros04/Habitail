import React, { useState, useMemo, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView, 
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Theme } from '../../constants/theme';
import { StatCard } from '../../components/stats/StatCard';
import { StatsTabs, TabType } from '../../components/stats/StatsTabs';
import { HabitSelector } from '../../components/stats/HabitSelector';
import { HabitHeatmap } from '../../components/stats/HabitHeatmap';
import { BarChartComponent } from '../../components/stats/BarChartComponent';

// Lógica e integración
import { useHabitStore } from '../../store/useHabitStore';
import { useUserStore } from '../../store/useUserStore';
import { useHabitStats } from '../../hooks/useHabitStats';
import { aggregateChartData } from '../../utils/chartAggregator';
import { LogRepository } from '../../storage/LogRepository';
import { HabitLog } from '../../types';

const logRepo = new LogRepository();

/**
 * StatsScreen - Pantalla principal de estadísticas integrada.
 */
export default function StatsScreen() {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const { habits } = useHabitStore();

  // Estado para el periodo seleccionado
  const [activeTab, setActiveTab] = useState<TabType>('weekly');
  
  // ID del hábito seleccionado. null/undefined significa "Vista Global".
  const [selectedHabitId, setSelectedHabitId] = useState<string | undefined>(undefined);
  
  // Logs cargados para el gráfico de barras (se recargan al cambiar hábito)
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // El periodo coincide directamente con activeTab
  const period = activeTab;

  // 1. Obtener métricas clave (Rachas y Tasas) usando el hook de lógica centralizada
  const { 
    currentStreak, 
    maxStreak, 
    completionRate, 
    loading: isStatsLoading 
  } = useHabitStats({
    habitId: selectedHabitId,
    period,
    userId: user?.id
  });

  // 2. Cargar logs reales para alimentar el agregador del gráfico de barras
  useEffect(() => {
    async function loadLogs() {
      setIsLogsLoading(true);
      try {
        if (selectedHabitId) {
          const fetchedLogs = await logRepo.getByHabit(selectedHabitId);
          setLogs(fetchedLogs);
        } else {
          // Para vista global, cargamos todos los logs del usuario
          if (user?.id) {
            const allLogs = await logRepo.getAll(); // O una consulta más específica
            setLogs(allLogs);
          }
        }
      } catch (error) {
        console.error('Error loading logs for charts:', error);
      } finally {
        setIsLogsLoading(false);
      }
    }
    loadLogs();
  }, [selectedHabitId, user?.id]);

  // 3. Procesar datos para el BarChartComponent
  const chartData = useMemo(() => {
    // Si hay un hábito seleccionado, usamos ese. Si no, usamos todos los hábitos (vista global).
    const targetHabits = selectedHabitId 
      ? habits.find(h => h.id === selectedHabitId) 
      : habits;

    if (!targetHabits || (Array.isArray(targetHabits) && targetHabits.length === 0)) return [];

    // Para el modo 'total', el agregador ahora muestra el desglose por meses
    // de los últimos 6 meses.
    return aggregateChartData(logs, targetHabits, period);
  }, [logs, selectedHabitId, habits, period]);

  // Nombre del hábito para el selector
  const selectedHabitName = selectedHabitId 
    ? habits.find(h => h.id === selectedHabitId)?.nombre || t('stats.habitSelector.habit', { defaultValue: 'Hábito' })
    : t('stats.habitSelector.global');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerTextContainer}>
          <Text style={styles.screenTitle}>{t('stats.title')}</Text>
          <Text style={styles.screenSubtitle}>{t('stats.subtitle')}</Text>
        </View>

        {/* Selector de Hábito Real */}
        <HabitSelector 
          selectedHabit={selectedHabitName} 
          onSelect={() => {
            // Aquí se debería abrir un BottomSheet o Modal con la lista de 'habits'
            // Por simplicidad en este paso, rotamos entre los disponibles o volvemos a global
            if (habits.length > 0) {
              const currentIndex = habits.findIndex(h => h.id === selectedHabitId);
              const nextIndex = (currentIndex + 1);
              if (nextIndex >= habits.length) {
                setSelectedHabitId(undefined); // Volver a Global
              } else {
                setSelectedHabitId(habits[nextIndex].id);
              }
            }
          }} 
        />

        <StatsTabs 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />

        {/* Gráfico de Barras Detallado */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('stats.charts.complianceAnalysis')}</Text>
          {isLogsLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator color={Theme.colors.primary} />
            </View>
          ) : (
            <BarChartComponent 
              mode={period} 
              data={chartData} 
            />
          )}
        </View>

        {/* Métricas clave */}
        <View style={styles.gridSection}>
          <Text style={styles.sectionTitle}>{t('stats.metrics.title')}</Text>
          <View style={styles.grid}>
            <View style={styles.row}>
              <StatCard 
                title={t('stats.metrics.currentStreak')} 
                value={isStatsLoading ? "..." : `${t('stats.metrics.days', { count: currentStreak })} 🔥`} 
              />
              <StatCard 
                title={t('stats.metrics.maxStreak')} 
                value={isStatsLoading ? "..." : `${t('stats.metrics.days', { count: maxStreak })} 🏆`} 
              />
            </View>
            <View style={styles.row}>
              <StatCard 
                title={period === 'total' ? t('stats.metrics.totalRate') : t('stats.metrics.periodRate')} 
                value={isStatsLoading ? "..." : `${completionRate.toFixed(1)}%`} 
              />
              <StatCard 
                title={t('stats.metrics.status')} 
                value={
                  completionRate > 80 
                    ? t('stats.metrics.statusExcellent') 
                    : completionRate > 50 
                      ? t('stats.metrics.statusRegular') 
                      : t('stats.metrics.statusImproveable')
                } 
              />
            </View>
          </View>
        </View>

        {/* Heatmap Anual */}
        <View style={styles.section}>
          <HabitHeatmap habitId={selectedHabitId} />
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
    paddingTop: 48,
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
  loaderContainer: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: 24,
  }
});



