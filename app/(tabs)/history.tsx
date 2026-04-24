import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useHabitStore } from '../../store/useHabitStore';
import { useLogStore } from '../../store/useLogStore';
import { Colors } from '../../constants/colors';
import { HabitLog } from '../../types';
import { getHabitsForToday } from '../../utils/frequencyEngine';

// Helpers de fecha duplicados mínimamente para aislar UI o usar los globales
/**
 * Determina si una fecha dada es estrictamente posterior al día de hoy (futuro).
 * Sirve para bloquear la navegación hacia fechas inexistentes en el calendario de check-ins.
 * @param {Date} date - La fecha a evaluar.
 * @returns {boolean} True si la fecha es en el futuro.
 */
const isFutureDate = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(date);
  check.setHours(0, 0, 0, 0);
  return check.getTime() > today.getTime();
};

/**
 * Normaliza una fecha eliminando la información de horas, minutos y segundos.
 * Fundamental para comparar fechas absolutas ("hoy es igual a hoy") sin importar la hora del tap.
 * @param {Date} date - La fecha sucia.
 * @returns {Date} Instancia de fecha apuntando estrictamente a las 00:00:00.
 */
const startOfDayDate = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Formatea una fecha en formato local y amigable en español (ej. "lunes, 12 de abril").
 * No se utiliza Date-fns aquí intencionadamente para evitar sobrecargar los bundles de locales
 * y asegurar robustez nativa.
 * @param {Date} date - Fecha a formatear.
 * @returns {string} String formateada y en minúsculas.
 */
const formatDateLocally = (date: Date) => {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`;
};

/**
 * Convierte un objeto Date a un string de formato YYYY-MM-DD.
 * Es el contrato vital exigido por `LogRepository` y la persistencia del Store para 
 * almacenar y recuperar logs diarios.
 * @param {Date} date - Fecha a formatear.
 * @returns {string} Cadena en molde YYYY-MM-DD.
 */
const formatDateDB = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Pantalla del Historial (HistoryScreen) para revisar retrospectivamente los registros.
 * 
 * Interfaz de Solo Lectura (Read Only) que evalúa si un hábito fue 'Completado', 'Incumplido'
 * o simplemente marcado como 'Sin registro' en una fecha anterior determinada.
 * Se alimenta de data real consumiendo store/useHabitStore y store/useLogStore.
 * 
 * @returns {JSX.Element} Screen principal del historial, listando cada hábito para un día en específico.
 */
export default function HistoryScreen() {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDayDate(new Date()));
  const [logsObj, setLogsObj] = useState<Record<string, HabitLog>>({});
  const [isLoading, setIsLoading] = useState(false);

  const allHabits = useHabitStore((state) => state.habits);
  const getLogsForDay = useLogStore((state) => state.getLogsForDay);

  // Cada que cambia la fecha recuperamos los logs históricos
  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const dateStr = formatDateDB(selectedDate);
        const logs = await getLogsForDay(dateStr);
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

  // Hábitos que aplican para ese histórico en base a la fecha solicitada
  const habitsForDate = useMemo(() => {
    return getHabitsForToday(allHabits, selectedDate);
  }, [allHabits, selectedDate]);

  // Cambiar entre días
  /**
   * Avanza o retrocede la fecha seleccionada interactuando con el calendario superior.
   * Modifica el estado global de componente disparando un re-fetech asíncrono.
   * Evita el desbordamiento si se trata de viajar al día de "mañana" o subsecuentes.
   * @param {number} offset - Cantidad de días (+1 adelante, -1 atrás).
   */
  const changeDateBy = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + offset);
    if (!isFutureDate(newDate)) {
      setSelectedDate(startOfDayDate(newDate));
    }
  };

  const isToday = selectedDate.getTime() === startOfDayDate(new Date()).getTime();
  // Una fecha es "pasada o hoy" si NO es futura. En ese caso, los hábitos
  // no completados deben mostrarse como incumplidos (X roja suave).
  const isPastOrToday = !isFutureDate(selectedDate);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Actividad Histórica</Text>
      </View>

      {/* Rownav de fecha */}
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={() => changeDateBy(-1)} style={styles.dateNavBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        
        <View style={styles.dateCenter}>
          <Text style={styles.dateCenterText}>
            {isToday ? 'Hoy' : formatDateLocally(selectedDate)}
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
            data={habitsForDate}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.flatListContent}
            renderItem={({ item }) => {
              const log = logsObj[item.id];
              // Resolución del estado de cada hábito en la fecha seleccionada:
              // - Día futuro          → NONE (el hábito aún no tiene fecha de expiración)
              // - Día pasado/hoy + log completado=true → COMPLETED (✓ verde)
              // - Día pasado/hoy + sin log o log no completado → FAILED (✗ roja suave)
              let statusType: 'COMPLETED' | 'FAILED' | 'NONE' = 'NONE';

              if (!isPastOrToday) {
                statusType = 'NONE';              // fecha futura: sin juzgar
              } else if (log && log.completado) {
                statusType = 'COMPLETED';         // completado explícitamente
              } else {
                statusType = 'FAILED';            // pasado o hoy sin completar
              }

              return (
                <View style={[
                  styles.historyItem,
                  statusType === 'FAILED' && styles.historyItemFailed,
                ]}>
                  <View style={styles.leftPill}>
                    <View style={[styles.iconBox, { backgroundColor: item.colorHex || Colors.primary }]}>
                      <Ionicons name={(item.icono as any) || 'star'} size={20} color="#FFF" />
                    </View>
                    <View>
                      <Text style={[
                        styles.itemName,
                        statusType === 'FAILED' && styles.itemNameFailed,
                      ]}>{item.nombre}</Text>
                      {item.horaRecordatorio && (
                        <Text style={styles.itemTime}>{item.horaRecordatorio}</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.statusBox}>
                    {statusType === 'COMPLETED' && (
                      <View style={[styles.statusIcon, styles.completedIcon]}>
                        <Ionicons name="checkmark-sharp" size={18} color="#FFF" />
                      </View>
                    )}
                    {statusType === 'FAILED' && (
                      <View style={[styles.statusIcon, styles.failedIcon]}>
                        <Ionicons name="close-sharp" size={18} color="#FFF" />
                      </View>
                    )}
                    {statusType === 'NONE' && (
                      <View style={styles.statusNone} />
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="documents-outline" size={48} color={Colors.inactive} />
                <Text style={styles.emptyText}>No hay datos para esta fecha de búsqueda.</Text>
              </View>
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
  // Tinte rojizo sutil para ítems incumplidos: no punitivo, solo informativo.
  historyItemFailed: {
    backgroundColor: 'rgba(251, 113, 133, 0.07)', // #FB7185 al 7% de opacidad
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.20)',
  },
  leftPill: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  itemName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  // Nombre ligeramente atenuado para hábitos incumplidos.
  itemNameFailed: { opacity: 0.6 },
  itemTime: { fontSize: 12, color: Colors.text, opacity: 0.5, marginTop: 2 },
  
  statusBox: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  statusIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  completedIcon: { backgroundColor: '#10B981' }, // Verde esmeralda exitoso
  failedIcon: { backgroundColor: '#FB7185' },     // Rojo rosa pastel (no punitivo)
  statusNone: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: Colors.inactive, opacity: 0.3, borderStyle: 'dashed' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { marginTop: 16, fontSize: 16, color: Colors.text, opacity: 0.5, textAlign: 'center' },
});
