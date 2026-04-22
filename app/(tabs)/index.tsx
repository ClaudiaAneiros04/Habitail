import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { useHabitStore, loadHabitsFromStorage } from '../../store/useHabitStore';
import { useLogStore } from '../../store/useLogStore';
import { Habit, HabitLog, Priority } from '../../types';
import { getHabitsForToday } from '../../utils/frequencyEngine';

import HabitItem from '../../components/HabitItem';
import ProgressBar from '../../components/ProgressBar';

// Native Date Helpers
/**
 * Convierte un objeto Date nativo al string esperado por la DB (Formato: YYYY-MM-DD).
 * @param {Date} date - Fecha local a formatear.
 * @returns {string} Fecha en formato YYYY-MM-DD.
 */
const formatDateDB = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

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
 * Formatea la fecha de manera amigable (ej: Lunes, 24 de Abril).
 */
const formatDateLocally = (date: Date) => {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`;
};

/**
 * Formato corto de fecha (ej: 24 Abril) para el selector de en medio.
 */
const formatShortDate = (date: Date) => {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]}`;
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

  const allHabits = useHabitStore((state) => state.habits);
  const addLog = useLogStore((state) => state.addLog);
  const getLogsForDay = useLogStore((state) => state.getLogsForDay);

  // Inicialización de la app
  useEffect(() => {
    const hydrate = async () => {
      await loadHabitsFromStorage();
      setHasHydrated(true);
    };
    hydrate();
  }, []);

  // Cargar los logs cada vez que cambia la fecha seleccionada
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
        setCompletedHabitsObj(logsMap);
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        if (isMounted) setIsLoadingLogs(false);
      }
    };
    fetchLogs();
    
    return () => { isMounted = false; };
  }, [selectedDate, getLogsForDay]);

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
    const isCurrentlyCompleted = currentLog?.completado || false;
    const newCompletedStatus = !isCurrentlyCompleted;
    
    const dateStr = formatDateDB(selectedDate);
    const logId = `${habit.id}_${dateStr}`;
    
    const newLog: HabitLog = {
      id: logId,
      habitId: habit.id,
      userId: habit.userId || 'local-user', // fallback
      fecha: dateStr,
      completado: newCompletedStatus,
      timestampRegistro: new Date().toISOString(),
    };

    // Actualización optimista
    setCompletedHabitsObj(prev => ({
      ...prev,
      [habit.id]: newLog
    }));

    try {
      await addLog(newLog);
    } catch (error) {
      console.error('Failed to save log', error);
      // Revertir optimismo si falla
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
  }, [completedHabitsObj, selectedDate, addLog]);

  /**
   * Genera el saludo de la cabecera en base a si es mañana, tarde o noche 
   * (independiente de la fecha consultada, esto corresponde al tiempo cronométrico de hoy).
   */
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
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
      {/* Cabecera */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.dateText}>
            {formatDateLocally(selectedDate)}
          </Text>
        </View>
      </View>

      {/* Selector de Fecha */}
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={() => changeDateBy(-1)} style={styles.dateNavBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        
        <View style={styles.dateCenter}>
          <Text style={styles.dateCenterText}>
            {isToday ? 'Hoy' : formatShortDate(selectedDate)}
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
          label={`Hábitos completados (${completedCount}/${totalHabits})`} 
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
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="leaf-outline" size={48} color={Colors.inactive} />
                <Text style={styles.emptyText}>No hay hábitos programados para este día.</Text>
              </View>
            }
          />
        )}
      </View>
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
    paddingTop: 20,
    paddingBottom: 10,
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
