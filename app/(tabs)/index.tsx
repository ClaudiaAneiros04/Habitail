import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { useHabitStore } from '../../store/useHabitStore';
import { useLogStore } from '../../store/useLogStore';
import { Habit, HabitLog, Priority } from '../../types';
import { getHabitsForToday } from '../../utils/frequencyEngine';

import HabitItem from '../../components/HabitItem';
import ProgressBar from '../../components/ProgressBar';
import { MiniPet } from '../../components/Pet/MiniPet';
import { PermissionBanner } from '../../components/PermissionBanner';
import { usePetStore } from '../../store/usePetStore';
import { useHabitCheckIn } from '../../hooks/useHabitCheckIn';
import { formatDateDB, generateLogId, formatDateLocally, formatShortDate } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { ToastConfirmation } from '../../components/ToastConfirmation';
import { useAppStateRefresh } from '../../hooks/useAppStateRefresh';

// Native Date Helpers (Moved to utils/dateUtils.ts)

/**
 * Compara dos fechas verificando que el año, mes y día coincidan, 
 * sin importar horas/minutos/segundos.
 */
const isSameDayDate = (d1: Date, d2: Date) => 
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

/**
 * Verifica si la fecha proporcionada representa un día estrictamente
 * posterior al día de hoy. Considera solo la fecha (día exacto).
 */
const isFutureDate = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(date);
  check.setHours(0, 0, 0, 0);
  return check.getTime() > today.getTime();
};

/**
 * Devuelve un clon de la fecha configurada a medianoche (00:00:00).
 */
const startOfDayDate = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Pantalla principal (Home Screen) que enseña los hábitos del día.
 * Actúa como orquestador entre el store de hábitos (`useHabitStore`) 
 * y el histórico interacciones (`useLogStore`).
 * 
 * Permite moverse entre días anteriores (no futuros) para auditar 
 * completados, y mutar el estatus 'completado' de de cada hábito.
 */
export default function HomeScreen() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDayDate(new Date()));
  const [completedHabitsObj, setCompletedHabitsObj] = useState<Record<string, HabitLog>>({});
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [snoozedHabits, setSnoozedHabits] = useState<Record<string, Date>>({});
  
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevLogsRef = useRef<Record<string, HabitLog>>({});
  const lastRefreshFromAppState = useRef(false);

  const { t } = useTranslation();

  const allHabits = useHabitStore((state) => state.habits);
  const addLog = useLogStore((state) => state.addLog);
  const deleteLog = useLogStore((state) => state.deleteLog);
  const getLogsForDay = useLogStore((state) => state.getLogsForDay);
  const pet = usePetStore((state) => state.pet);
  const { markComplete, markIncomplete } = useHabitCheckIn();

  // Inicialización de la app
  useEffect(() => {
    const hydrate = async () => {
      await useHabitStore.getState().loadHabits();
      setHasHydrated(true);
    };
    hydrate();
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 2500);
  }, []);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  useAppStateRefresh(() => {
    lastRefreshFromAppState.current = true;
    setRefreshTrigger(prev => prev + 1);
  });

  // Cargar los logs cada vez que cambia la fecha seleccionada o AppState refresh
  useEffect(() => {
    let isMounted = true;
    const fetchLogs = async () => {
      setIsLoadingLogs(true);
      try {
        const dateStr = formatDateDB(selectedDate);
        const logs = await getLogsForDay(dateStr);
        if (!isMounted) return;
        
        const logsMap: Record<string, HabitLog> = {};
        logs.forEach(log => {
          logsMap[log.habitId] = log;
        });

        if (lastRefreshFromAppState.current) {
          const allHabitsList = useHabitStore.getState().habits;
          const newlyCompletedLog = logs.find(log => log.completado && !prevLogsRef.current[log.habitId]?.completado);
          if (newlyCompletedLog) {
            const habitName = allHabitsList.find(h => h.id === newlyCompletedLog.habitId)?.nombre;
            if (habitName) {
              showToast(t('home.toast.habitCompleted', { name: habitName }));
            }
          }
          lastRefreshFromAppState.current = false;
        }

        prevLogsRef.current = logsMap;
        setCompletedHabitsObj(logsMap);
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        if (isMounted) setIsLoadingLogs(false);
      }
    };
    fetchLogs();
    
    return () => { isMounted = false; };
  }, [selectedDate, getLogsForDay, refreshTrigger, showToast, t]);

  // Selección de hábitos correspondientes al día seleccionado
  const habitsForDate = React.useMemo(() => {
    return getHabitsForToday(allHabits, selectedDate);
  }, [allHabits, selectedDate]);

  // Ordenar los hábitos
  const sortedHabits = React.useMemo(() => {
    // Mapa numérico usado para jerarquizar la enumeración Priority (ESSENTIAL = 3, NORMAL = 2, FLEXIBLE = 1)
    const priorityWeight: Record<string, number> = {
      [Priority.ESSENTIAL]: 3,
      [Priority.NORMAL]: 2,
      [Priority.FLEXIBLE]: 1,
    };

    return [...habitsForDate].sort((a, b) => {
      const logA = completedHabitsObj[a.id];
      const logB = completedHabitsObj[b.id];
      const isCompletedA = logA?.completado || false;
      const isCompletedB = logB?.completado || false;

      // 1. Los completados van al final de la lista siempre para no estorbar visually
      if (isCompletedA !== isCompletedB) {
        return isCompletedA ? 1 : -1;
      }

      // 2. Prioridad de forma DESCendente.
      const wA = priorityWeight[a.nivelPrioridad] || 0;
      const wB = priorityWeight[b.nivelPrioridad] || 0;
      if (wA !== wB) {
        return wB - wA; // Sort mayor a menor
      }

      // 3. Hora recordatorio (ej '09:00' vs '14:30') ASCendente
      // String compare sirve dado que el ISO es HH:mm (0-padded) 
      const timeA = a.horaRecordatorio || '23:59';
      const timeB = b.horaRecordatorio || '23:59';
      return timeA.localeCompare(timeB);
    });
  }, [habitsForDate, completedHabitsObj]);

  const totalHabits = habitsForDate.length;
  // Calculamos el valor del progress bar asegurando que medimos solo true flags.
  const completedCount = sortedHabits.filter(h => completedHabitsObj[h.id]?.completado).length;
  const progress = totalHabits > 0 ? completedCount / totalHabits : 0;

  /**
   * Dispara o revierte el estado 'completado' de un hábito para el "selectedDate" actual.
   * Utiliza una política "Optimistic Update" (modificar GUI y después Sync con el Store y de base de datos)
   * lo cual asegura que el toggle checkbox sea super responsivo ("snappy").
   * 
   * @param {Habit} habit - El hábito seleccionado a reconfigurar.
   */
  const handleToggleHabit = useCallback(async (habit: Habit) => {
    const currentLog = completedHabitsObj[habit.id];
    const isCurrentlyCompleted = currentLog?.completado === true;
    const dateStr = formatDateDB(selectedDate);
    const logId = generateLogId(habit.id, selectedDate);

    if (isCurrentlyCompleted) {
      // El usuario DESMARCA: eliminamos el registro de la DB usando el hook de gamificación
      setCompletedHabitsObj(prev => {
        const next = { ...prev };
        delete next[habit.id];
        return next;
      });
      try {
        await markIncomplete(habit.id, selectedDate);
      } catch (error) {
        console.error('Failed to mark incomplete', error);
        if (currentLog) {
          setCompletedHabitsObj(prev => ({ ...prev, [habit.id]: currentLog }));
        }
      }
    } else {
      // El usuario MARCA como completado: guardamos usando el hook de gamificación
      const newLog: HabitLog = {
        id: logId,
        habitId: habit.id,
        userId: habit.userId || 'default-user',
        fecha: dateStr,
        completado: true,
        timestampRegistro: new Date().toISOString(),
      };
      setCompletedHabitsObj(prev => ({ ...prev, [habit.id]: newLog }));
      try {
        await markComplete(habit.id, selectedDate);
      } catch (error) {
        console.error('Failed to mark complete', error);
        setCompletedHabitsObj(prev => {
          const reverted = { ...prev };
          if (currentLog) {
            reverted[habit.id] = currentLog;
          } else {
            delete reverted[habit.id];
          }
          return reverted;
        });
      }
    }
  }, [completedHabitsObj, selectedDate, markComplete, markIncomplete]);

  /**
   * Genera el saludo de la cabecera en base a si es mañana, tarde o noche 
   * (independiente de la fecha consultada, esto corresponde al tiempo cronométrico de hoy).
   */
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.header.buenos_dias');
    if (hour < 20) return t('home.header.buenas_tardes');
    return t('home.header.buenas_noches');
  };

  /**
   * Cambia el estado visual de la fecha y carga (mediante useEffect)
   * todos los logs correspondientes a ese nuevo día seleccionado.
   * Evita intencionalmente avanzar hacia el futuro según las restricciones funcionales.
   * 
   * @param {number} offset - Incremento (+1 para día sig., -1 para día anter.)
   */
  const changeDateBy = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + offset);
    // No permitir navegar hacia el futuro
    if (!isFutureDate(newDate)) {
      setSelectedDate(startOfDayDate(newDate));
    }
  };

  if (!hasHydrated) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const isToday = isSameDayDate(selectedDate, new Date());

  return (
    <SafeAreaView style={styles.safeArea}>
      <PermissionBanner />
      {/* Cabecera */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.dateText}>
              {formatDateLocally(selectedDate)}
            </Text>
          </View>
          
          {/* Avatar de la mascota (MiniPet) */}
          <MiniPet />
        </View>
      </View>


      {/* Selector de Fecha */}
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={() => changeDateBy(-1)} style={styles.dateNavBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        
        <View style={styles.dateCenter}>
          <Text style={styles.dateCenterText}>
            {isToday ? t('tabs.hoy') : formatShortDate(selectedDate)}
          </Text>
        </View>

        <TouchableOpacity 
          onPress={() => changeDateBy(1)} 
          style={styles.dateNavBtn}
          disabled={isToday}
        >
          <Ionicons 
            name="chevron-forward" 
            size={24} 
            color={isToday ? Colors.inactive : Colors.text} 
          />
        </TouchableOpacity>
      </View>

      {/* Progreso */}
      <View style={styles.progressContainer}>
        <ProgressBar 
          progress={progress} 
          label={t('home.progress.label', { completed: completedCount, total: totalHabits })} 
        />
      </View>

      {/* FlatList Hábitos */}
      <View style={styles.listContainer}>
        {isLoadingLogs ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={sortedHabits}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.flatListContent}
            renderItem={({ item }) => (
              <HabitItem 
                habit={item}
                completed={completedHabitsObj[item.id]?.completado || false}
                onToggle={(habitId) => handleToggleHabit(item)}
                // TODO: Logic/Data debe exponer snoozedUntil en el store.
                // Provisionalmente usamos un estado local (se documenta en LEARNING.md)
                snoozedUntil={snoozedHabits[item.id]}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="leaf-outline" size={48} color={Colors.inactive} />
                <Text style={styles.emptyText}>{t('home.empty.no_habits')}</Text>
              </View>
            }
          />
        )}
      </View>
      <ToastConfirmation message={toastMessage} visible={toastVisible} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  dateText: {
    fontSize: 16,
    color: Colors.text,
    opacity: 0.6,
    textTransform: 'capitalize',
    marginTop: 4,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginVertical: 12,
  },
  dateNavBtn: {
    padding: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  dateCenter: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  dateCenterText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  flatListContent: {
    paddingBottom: 40,
    paddingTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text,
    opacity: 0.5,
    textAlign: 'center',
  },
});
