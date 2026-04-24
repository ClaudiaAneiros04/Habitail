import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Habit } from '../types';
import { Colors } from '../constants/colors';
import { useHabitStats } from './useHabitStats';

/**
 * Propiedades del componente HabitItem.
 * @property {Habit} habit - Objeto con toda la información del hábito a renderizar.
 * @property {boolean} completed - Indica si el hábito está marcado como completado o no.
 * @property {(habitId: string) => void} onToggle - Callback que se ejecuta cuando el usuario toca la fila del hábito.
 * @property {number} [streak] - (Opcional) Días consecutivos de racha forzado desde arriba.
 */
interface HabitItemProps {
  habit: Habit;
  completed: boolean;
  onToggle: (habitId: string) => void;
  streak?: number;
}

/**
 * Renderiza la tarjeta individual para un hábito.
 * Si el hábito está completado, se oscurece y se muestra un checkmark con animación de escalado.
 * Se decidió gestionar el estado fuera (y pasarlo por prop 'completed') para 
 * mantener el componente de UI puramente presentacional, pero internamente consume 'useHabitStats'
 * para pintar la racha si está disponible.
 *
 * @param {HabitItemProps} props - Propiedades del componente.
 * @returns {JSX.Element} Componente TouchableOpacity que envuelve el ítem.
 */
export default function HabitItem({ habit, completed, onToggle, streak }: HabitItemProps) {
  // Animación del checkbox
  const checkScale = useRef(new Animated.Value(completed ? 1 : 0)).current;

  // Calculamos la racha internamente si el padre no nos la fuerza
  const { currentStreak, refetch } = useHabitStats(habit);
  
  // Racha definitiva a mostrar (forzada por prop o calculada de bbdd)
  const displayStreak = streak !== undefined ? streak : currentStreak;

  const router = useRouter();

  // Reacciona a los cambios en "completed"
  useEffect(() => {
    Animated.spring(checkScale, {
      toValue: completed ? 1 : 0,
      useNativeDriver: true,
      bounciness: 12,
      speed: 16,
    }).start();
    
    // Si completamos/descompletamos, volvemos a calcular la racha
    refetch();
  }, [completed, checkScale, refetch]);

  /**
   * Navega a la pantalla de detalle inmersiva para ese hábito en específico.
   * Decisión de UI: Se separa la pulsación sobre la tarjeta (Navegar) 
   * de la pulsación sobre el checkmark (Completar).
   */
  const goToDetail = () => {
    router.push(`/habit/${habit.id}`);
  };

  return (
    <TouchableOpacity 
      style={[styles.container, completed && styles.containerCompleted]} 
      onPress={goToDetail}
      activeOpacity={0.7}
    >
      <View style={styles.leftContent}>
        <View style={[styles.iconContainer, { backgroundColor: habit.colorHex || Colors.primary }]}>
          <Ionicons name={(habit.icono as any) || 'star'} size={24} color="#FFF" />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.name, completed && styles.textCompleted]}>
            {habit.nombre}
          </Text>
          
          <View style={styles.metadataRow}>
            {habit.horaRecordatorio && (
              <Text style={styles.timeText}>
                <Ionicons name="time-outline" size={14} color={Colors.text} style={styles.iconOp} />{' '}
                {habit.horaRecordatorio}
              </Text>
            )}
            
            {/* Badge de Racha. Lo mostramos siempre que > 0 */}
            {displayStreak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 {displayStreak} {displayStreak === 1 ? 'día' : 'días'}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      <TouchableOpacity 
        style={[styles.checkbox, completed && styles.checkboxCompleted]}
        onPress={() => onToggle(habit.id)}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Área de tap un poco más generosa para el checkbox
      >
        <Animated.View style={{ transform: [{ scale: checkScale }], opacity: checkScale }}>
          <Ionicons name="checkmark" size={20} color="#FFF" />
        </Animated.View>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  containerCompleted: {
    opacity: 0.5,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  textCompleted: {
    textDecorationLine: 'line-through',
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    color: Colors.text,
    opacity: 0.6,
    marginRight: 12,
  },
  iconOp: {
    opacity: 0.6,
  },
  streakBadge: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakText: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.inactive,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxCompleted: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
});
