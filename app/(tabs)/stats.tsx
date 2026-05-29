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
import { EmptyState } from '../../components/empty-states/EmptyState';
import { StatCardSkeleton } from '../../components/skeletons/StatCardSkeleton';
import { SkeletonItem } from '../../components/skeletons/SkeletonItem';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Lógica e integración
import { useHabitStore } from '../../store/useHabitStore';
import { useUserStore } from '../../store/useUserStore';
import { useHabitStats } from '../../hooks/useHabitStats';
import { aggregateChartData } from '../../utils/chartAggregator';
import { LogRepository } from '../../storage/LogRepository';
import { HabitLog } from '../../types';
import { useLogStore } from '../../store/useLogStore';

const logRepo = new LogRepository();

const ACHIEVEMENTS_DATA = [
  {
    id: 'first_week',
    icon: 'calendar-outline',
    color: '#3b82f6', // Blue
    titleKey: 'stats.achievements.first_week.title',
    defaultTitle: 'Primera Semana',
    descKey: 'stats.achievements.first_week.desc',
    defaultDesc: 'Completa 7 días desde tu registro y realiza al menos 1 check-in.',
  },
  {
    id: 'streak_7',
    icon: 'flame-outline',
    color: '#f97316', // Orange
    titleKey: 'stats.achievements.streak_7.title',
    defaultTitle: 'Racha de 7 días',
    descKey: 'stats.achievements.streak_7.desc',
    defaultDesc: 'Consigue una racha de 7 días consecutivos en cualquier hábito.',
  },
  {
    id: 'streak_30',
    icon: 'trophy-outline',
    color: '#eab308', // Gold
    titleKey: 'stats.achievements.streak_30.title',
    defaultTitle: 'Racha de 30 días',
    descKey: 'stats.achievements.streak_30.desc',
    defaultDesc: 'Consigue una racha de 30 días consecutivos en cualquier hábito.',
  },
  {
    id: 'perfect_week',
    icon: 'ribbon-outline',
    color: '#a855f7', // Purple
    titleKey: 'stats.achievements.perfect_week.title',
    defaultTitle: '100% Semanal',
    descKey: 'stats.achievements.perfect_week.desc',
    defaultDesc: 'Completa todos tus hábitos activos todos los días de una semana natural (Lu–Do).',
  },
  {
    id: 'one_month_active',
    icon: 'star-outline',
    color: '#ec4899', // Pink
    titleKey: 'stats.achievements.one_month_active.title',
    defaultTitle: '1 Mes Activo',
    descKey: 'stats.achievements.one_month_active.desc',
    defaultDesc: 'Realiza al menos 1 check-in en 28 de los últimos 30 días calendario.',
  },
];

const AchievementsList = ({ userBadges }: { userBadges: string[] }) => {
  const { t } = useTranslation();
  const unlockedSet = new Set(userBadges);

  return (
    <View style={styles.achievementsContainer}>
      {ACHIEVEMENTS_DATA.map((item) => {
        const isUnlocked = unlockedSet.has(item.id);
        return (
          <View 
            key={item.id} 
            style={[
              styles.achievementCard, 
              isUnlocked ? styles.achievementUnlocked : styles.achievementLocked
            ]}
          >
            <View 
              style={[
                styles.badgeIconContainer, 
                { backgroundColor: isUnlocked ? item.color + '15' : '#f1f5f9' }
              ]}
            >
              <Ionicons 
                name={item.icon as any} 
                size={26} 
                color={isUnlocked ? item.color : '#94a3b8'} 
              />
              {!isUnlocked && (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={10} color="#FFF" />
                </View>
              )}
            </View>

            <View style={styles.achievementInfo}>
              <View style={styles.achievementHeader}>
                <Text style={[
                  styles.achievementTitle, 
                  { color: isUnlocked ? Theme.colors.text : '#64748b' }
                ]}>
                  {t(item.titleKey, { defaultValue: item.defaultTitle })}
                </Text>
                {isUnlocked && (
                  <View style={[styles.unlockedLabel, { backgroundColor: item.color + '15' }]}>
                    <Text style={[styles.unlockedLabelText, { color: item.color }]}>
                      {t('stats.achievements.unlocked', { defaultValue: 'Desbloqueado' })}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.achievementDesc}>
                {t(item.descKey, { defaultValue: item.defaultDesc })}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

/**
 * StatsScreen - Pantalla principal de estadísticas integrada.
 */
export default function StatsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useUserStore();
  const { habits } = useHabitStore();
  const { lastUpdate } = useLogStore();

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
  }, [selectedHabitId, user?.id, lastUpdate]);

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

        {habits.length === 0 ? (
          <EmptyState
            icon="stats-chart-outline"
            title={t('stats.empty.title', { defaultValue: 'Aún no hay datos suficientes' })}
            description={t('stats.empty.description', { defaultValue: 'Empieza a completar hábitos para ver tus estadísticas.' })}
            actionLabel={t('stats.empty.cta', { defaultValue: 'Ver hábitos' })}
            onAction={() => router.push('/(tabs)/habits')}
          />
        ) : (
          <>
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
                  <SkeletonItem width="100%" height={240} borderRadius={24} />
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
                  {isStatsLoading ? (
                    <>
                      <StatCardSkeleton />
                      <StatCardSkeleton />
                    </>
                  ) : (
                    <>
                      <StatCard 
                        title={t('stats.metrics.currentStreak')} 
                        value={`${t('stats.metrics.days', { count: currentStreak })} 🔥`} 
                      />
                      <StatCard 
                        title={t('stats.metrics.maxStreak')} 
                        value={`${t('stats.metrics.days', { count: maxStreak })} 🏆`} 
                      />
                    </>
                  )}
                </View>
                <View style={styles.row}>
                  {isStatsLoading ? (
                    <>
                      <StatCardSkeleton />
                      <StatCardSkeleton />
                    </>
                  ) : (
                    <>
                      <StatCard 
                        title={period === 'total' ? t('stats.metrics.totalRate') : t('stats.metrics.periodRate')} 
                        value={`${completionRate.toFixed(1)}%`} 
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
                    </>
                  )}
                </View>
              </View>
            </View>

            {/* Heatmap Anual */}
            <View style={styles.section}>
              <HabitHeatmap habitId={selectedHabitId} />
            </View>

            {/* Sección de Logros / Insignias */}
            <View style={[styles.section, { marginTop: Theme.spacing.lg }]}>
              <Text style={styles.sectionTitle}>
                {t('stats.achievements.title', { defaultValue: 'Logros Obtenidos' })}
              </Text>
              <AchievementsList userBadges={user?.badges || []} />
            </View>
          </>
        )}

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
  },
  achievementsContainer: {
    gap: 12,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  achievementUnlocked: {
    borderColor: '#e2e8f0',
  },
  achievementLocked: {
    borderColor: '#f1f5f9',
    opacity: 0.55,
  },
  badgeIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  lockOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#64748b',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  achievementInfo: {
    flex: 1,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  achievementTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  achievementDesc: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    lineHeight: 16,
  },
  unlockedLabel: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  unlockedLabelText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});



