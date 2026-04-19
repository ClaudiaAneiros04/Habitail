import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Alert, Animated } from 'react-native';
import { Colors } from '../../constants/colors';
import { useHabitStore } from '../../store/useHabitStore';
import { Habit } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';

// Helper for UI
const HabitItem = ({ habit, onArchive }: { habit: Habit, onArchive: () => void }) => {
  // Swipe to archive with confirmation
  const archiveWithConfirmation = () => {
    Alert.alert(
      "Archivar Hábito",
      `¿Estás seguro que deseas archivar "${habit.nombre}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Archivar", style: "destructive", onPress: onArchive }
      ]
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity onPress={archiveWithConfirmation} style={styles.deleteAction}>
        <Animated.View style={[styles.actionContent, { transform: [{ scale }] }]}>
          <Ionicons name="archive" size={24} color="#FFF" />
          <Text style={styles.actionText}>Archivar</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const onLongPress = () => {
    Alert.alert(
      "Opciones",
      `Gestionar hábito: ${habit.nombre}`,
      [
        { text: "Editar", onPress: () => console.log('Editar', habit.id) },
        { text: "Archivar", style: "destructive", onPress: archiveWithConfirmation },
        { text: "Cancelar", style: "cancel" }
      ]
    );
  };

  // Mock streak (racha) -> In real app, calculate from logs
  const streak = (habit.id?.length || 0) % 5 + 1; // Un pequeño mock temporal

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      <TouchableOpacity
        style={styles.habitItemContainer}
        onLongPress={onLongPress}
        delayLongPress={500}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: habit.colorHex || Colors.primary }]}>
          <Ionicons name={(habit.icono as any) || 'star'} size={24} color="#FFF" />
        </View>

        <View style={styles.habitInfo}>
          <Text style={styles.habitName}>{habit.nombre}</Text>
          <Text style={styles.habitStreak}>🔥 Racha: {streak} días</Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};


export default function HabitsScreen() {
  const habits = useHabitStore((state) => state.habits);
  const archiveHabit = useHabitStore((state) => state.archiveHabit);
  const router = useRouter();

  // Group by Category
  const sections = useMemo(() => {
    // Check if habits exists, because state hydration could be pending
    if (!habits) return [];

    const activeHabits = habits.filter(h => h.activo);

    // Create a map to group by category
    const grouped = activeHabits.reduce((acc, habit) => {
      const category = (habit.categoria as string) || 'Sin categoría';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(habit);
      return acc;
    }, {} as Record<string, Habit[]>);

    // Convert into SectionList format
    return Object.keys(grouped).map(category => ({
      title: category,
      data: grouped[category],
    })).sort((a, b) => a.title.localeCompare(b.title));
  }, [habits]);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HabitItem
            habit={item}
            onArchive={() => archiveHabit(item.id)}
          />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tienes hábitos activos.</Text>
            <Text style={styles.emptySubText}>¡Presiona el botón + para crear uno!</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          router.push('/add-habit');
        }}
      >
        <Ionicons name="add" size={32} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 100, // padding for FAB
    paddingTop: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  habitItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    elevation: 2, // Android shadow
    shadowColor: Colors.text, // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  habitInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  habitName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  habitStreak: {
    fontSize: 14,
    color: Colors.inactive,
    fontWeight: '500',
  },
  deleteAction: {
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: 100,
    height: '100%',
    marginBottom: 12, // match habitItemContainer margin
    marginTop: 0,
    marginRight: 16,
    borderRadius: 16,
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  actionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    right: 24,
    bottom: 24,
    backgroundColor: Colors.primary,
    borderRadius: 28,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: Colors.inactive,
    textAlign: 'center',
  },
});
