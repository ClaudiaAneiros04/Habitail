import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Habit } from '../types';
import { Colors } from '../constants/colors';

/**
 * Propiedades del componente HabitItem.
 * @property {Habit} habit - Objeto con toda la información del hábito a renderizar.
 * @property {boolean} completed - Indica si el hábito está marcado como completado o no.
 * @property {() => void} onToggle - Callback que se ejecuta cuando el usuario toca la fila del hábito.
 */
interface HabitItemProps {
  habit: Habit;
  completed: boolean;
  onToggle: () => void;
}

/**
 * Renderiza la tarjeta individual para un hábito.
 * Si el hábito está completado, se oscurece y se muestra un checkmark.
 * Se decidió gestionar el estado fuera (y pasarlo por prop 'completed') para 
 * mantener el componente de UI puramente presentacional.
 *
 * @param {HabitItemProps} props - Propiedades del componente.
 * @returns {JSX.Element} Componente TouchableOpacity que envuelve el ítem.
 */
export default function HabitItem({ habit, completed, onToggle }: HabitItemProps) {
  return (
    <TouchableOpacity 
      style={[styles.container, completed && styles.containerCompleted]} 
      onPress={onToggle}
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
          {habit.horaRecordatorio && (
            <Text style={styles.timeText}>
              <Ionicons name="time-outline" size={14} color={Colors.text} style={{ opacity: 0.6 }} />{' '}
              {habit.horaRecordatorio}
            </Text>
          )}
        </View>
      </View>
      
      <View style={[styles.checkbox, completed && styles.checkboxCompleted]}>
        {completed && <Ionicons name="checkmark" size={20} color="#FFF" />}
      </View>
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
  timeText: {
    fontSize: 14,
    color: Colors.text,
    opacity: 0.6,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.inactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
});
