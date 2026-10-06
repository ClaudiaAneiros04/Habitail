import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useHabitStore } from '../../store/useHabitStore';
import { useLogStore } from '../../store/useLogStore';
import { Colors } from '../../constants/colors';
import { HabitLog, LogicalDate } from '../../types';
import { getHabitHistoryForDate, EvaluatedHabitHistoryItem } from '../../utils/frequencyEngine';
import { 
  getLogicalToday, 
  addLogicalDays, 
  compareLogicalDates, 
  formatDateLocally 
} from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/empty-states/EmptyState';

/**
 * Pantalla del Historial (HistoryScreen) para revisar retrospectivamente los registros.
 * 
 * Interfaz de Consulta / Solo Lectura (Read Only) que evalúa el estado canónico de cada
 * hábito programado para la fecha seleccionada ('COMPLETED', 'FAILED', 'PENDING').
 * Consume useHabitStore y useLogStore preguntando exclusivamente al motor de dominio.
 * 
 * @returns {JSX.Element} Screen principal del historial.
 */
export default function HistoryScreen() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<LogicalDate>(getLogicalToday());
  const [logsObj, setLogsObj] = useState<Record<string, HabitLog>>({});
  const [isLoading, setIsLoading] = useState(false);

  const allHabits = useHabitStore((state) => state.habits);
  const getLogsForDay = useLogStore((state) => state.getLogsForDay);

  // Cada vez que cambia la fecha recuperamos los logs históricos de ese día
  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const logs = await getLogsForDay(selectedDate);
        if (!isMounted) return;
        
        const map: Record<string, HabitLog> = {};
        logs.forEach(log => {
          map[log.habitId] = log;
        });
        setLogsObj(map);
      } catch (error) {
        console.error('Error fetching history logs:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHistory();
    return () => { isMounted = false; };
  }, [selectedDate, getLogsForDay]);

  // Consulta canónica de dominio: evalúa qué hábitos correspondían y su estado exacto
  const historyItems = useMemo(() => {
    return getHabitHistoryForDate(allHabits, selectedDate, logsObj);
  }, [allHabits, selectedDate, logsObj]);

  // Navegación pura con LogicalDate: no permite avanzar más allá de hoy
  const changeDateBy = (offset: number) => {
    const newDate = addLogicalDays(selectedDate, offset);
    if (compareLogicalDates(newDate, getLogicalToday()) <= 0) {
      setSelectedDate(newDate);
    }
  };

  const isToday = compareLogicalDates(selectedDate, getLogicalToday()) === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('history.title')}</Text>
      </View>

      {/* Rownav de fecha */}
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={() => changeDateBy(-1)} style={styles.dateNavBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        
        <View style={styles.dateCenter}>
          <Text style={styles.dateCenterText}>
            {isToday ? t('tabs.hoy') : formatDateLocally(selectedDate)}
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

      <View style={styles.listContainer}>
        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={historyItems}
            keyExtractor={({ habit }) => habit.id}
            contentContainerStyle={styles.flatListContent}
            renderItem={({ item }: { item: EvaluatedHabitHistoryItem }) => {
              const { habit, status } = item;
              const isFailed = status === 'FAILED';

              return (
                <View style={[
                  styles.historyItem,
                  isFailed && styles.historyItemFailed,
                ]}>
                  <View style={styles.leftPill}>
                    <View style={[styles.iconBox, { backgroundColor: habit.colorHex || Colors.primary }]}>
                      <Ionicons name={(habit.icono as any) || 'star'} size={20} color="#FFF" />
                    </View>
                    <View>
                      <Text style={[
                        styles.itemName,
                        isFailed && styles.itemNameFailed,
                      ]}>{habit.nombre}</Text>
                      {habit.horaRecordatorio && (
                        <Text style={styles.itemTime}>{habit.horaRecordatorio}</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.statusBox}>
                    {status === 'COMPLETED' && (
                      <View style={[styles.statusIcon, styles.completedIcon]}>
                        <Ionicons name="checkmark-sharp" size={18} color="#FFF" />
                      </View>
                    )}
                    {status === 'FAILED' && (
                      <View style={[styles.statusIcon, styles.failedIcon]}>
                        <Ionicons name="close-sharp" size={18} color="#FFF" />
                      </View>
                    )}
                    {status === 'PENDING' && (
                      <View style={[styles.statusIcon, styles.pendingIcon]}>
                        <Ionicons name="time-outline" size={18} color="#FFF" />
                      </View>
                    )}
                    {status === 'FUTURE' && (
                      <View style={styles.statusNone} />
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <EmptyState
                title={t('history.empty.title', { defaultValue: 'Sin registros' })}
                description={t('history.empty')}
                icon="📜"
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.text },
  
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
    flex: 1,
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  dateCenterText: { fontSize: 16, fontWeight: '600', color: Colors.primary, textTransform: 'capitalize' },
  
  listContainer: { flex: 1, paddingHorizontal: 16 },
  flatListContent: { paddingBottom: 40, paddingTop: 8 },
  
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  // Tinte rojizo sutil para ítems incumplidos: solo informativo
  historyItemFailed: {
    backgroundColor: '#FFF1F2', // Rose 50
    borderWidth: 1,
    borderColor: '#FFE4E6',     // Rose 100
    shadowOpacity: 0.02,
  },
  leftPill: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  itemName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  // Nombre atenuado solo para hábitos incumplidos
  itemNameFailed: { opacity: 0.6 },
  itemTime: { fontSize: 12, color: Colors.text, opacity: 0.5, marginTop: 2 },
  
  statusBox: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  statusIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  completedIcon: { backgroundColor: '#10B981' }, // Verde esmeralda exitoso
  failedIcon: { backgroundColor: '#FB7185' },     // Rojo rosa pastel (no punitivo)
  pendingIcon: { backgroundColor: '#F59E0B' },    // Ámbar indicador de pendiente hoy
  statusNone: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: Colors.inactive, opacity: 0.3, borderStyle: 'dashed' },
});
