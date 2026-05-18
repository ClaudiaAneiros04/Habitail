import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Habit } from '../types';
import { Colors } from '../constants/colors';
import { useHabitStats } from '../hooks/useHabitStats';

/**
 * Propiedades del componente HabitItem.
 */
interface HabitItemProps {
  habit: Habit;
  completed: boolean;
  onToggle: (habitId: string) => void;
  streak?: number;
  snoozedUntil?: Date | null;
}

/**
 * Renderiza la tarjeta individual para un hábito.
 */
export default function HabitItem({ habit, completed, onToggle, streak, snoozedUntil }: HabitItemProps) {
  const { t } = useTranslation();
  const checkScale = useRef(new Animated.Value(completed ? 1 : 0)).current;
  const isFirstRender = useRef(true);

  const [isSnoozedVisible, setIsSnoozedVisible] = useState(false);

  useEffect(() => {
    if (snoozedUntil && !completed) {
      const now = new Date();
      const timeDiff = new Date(snoozedUntil).getTime() - now.getTime();
      if (timeDiff > 0) {
        setIsSnoozedVisible(true);
        const timer = setTimeout(() => {
          setIsSnoozedVisible(false);
        }, timeDiff);
        return () => clearTimeout(timer);
      } else {
        setIsSnoozedVisible(false);
      }
    } else {
      setIsSnoozedVisible(false);
    }
  }, [snoozedUntil, completed]);

  // Usamos el nuevo hook centralizado
  const { currentStreak, refresh } = useHabitStats({ 
    habitId: habit.id,
    period: 'total' // Queremos la racha total para el badge
  });
  
  const displayStreak = streak !== undefined ? streak : currentStreak;
  const router = useRouter();

  useEffect(() => {
    Animated.spring(checkScale, {
      toValue: completed ? 1 : 0,
      useNativeDriver: true,
      bounciness: 12,
      speed: 16,
    }).start();
    
    // Si completamos/descompletamos, invalidamos caché y recalculamos
    // Saltamos el primer render para evitar queries duplicadas al cargar la lista
    if (!isFirstRender.current) {
      refresh();
    } else {
      isFirstRender.current = false;
    }
  }, [completed, checkScale, refresh]);

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
            
            {displayStreak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>{`🔥 ${displayStreak} ${displayStreak === 1 ? 'día' : 'días'}`}</Text>
              </View>
            )}
            
            {isSnoozedVisible && !completed && (
              <View style={styles.snoozedBadge}>
                <Ionicons name="alarm-outline" size={12} color={Colors.accent} />
                <Text style={styles.snoozedText}>{t('home.badge.snoozed')}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      <Pressable 
        style={({ pressed }) => [
          styles.checkbox, 
          completed && styles.checkboxCompleted,
          pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }
        ]}
        onPress={(e) => {
          // En Web, detenemos la propagación para que no se dispare el goToDetail del padre
          if (Platform.OS === 'web') {
            e.stopPropagation();
          }
          onToggle(habit.id);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Animated.View style={{ transform: [{ scale: checkScale }], opacity: checkScale }}>
          <Ionicons name="checkmark" size={20} color="#FFF" />
        </Animated.View>
      </Pressable>
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
  snoozedBadge: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)', // Accent color with opacity
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  snoozedText: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
    marginLeft: 4,
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
