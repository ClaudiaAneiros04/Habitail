import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Alert, Animated, SafeAreaView } from 'react-native';
import { Colors } from '../../constants/colors';
import { useHabitStore } from '../../store/useHabitStore';
import { Habit } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/empty-states/EmptyState';

// Helper for UI
const HabitItem = ({ habit, onArchive, onDelete }: { habit: Habit, onArchive: () => void, onDelete: () => void }) => {
  const { t } = useTranslation();
  const router = useRouter();

  // Swipe to archive with confirmation
  const archiveWithConfirmation = () => {
    Alert.alert(
      t('habits.archive.title', { defaultValue: 'Archivar Hábito' }),
      t('habits.archive.confirm', { name: habit.nombre, defaultValue: '¿Estás seguro de que quieres archivar "{{name}}"?' }),
      [
        { text: t('common.cancelar', { defaultValue: 'Cancelar' }), style: "cancel" },
        { text: t('habits.archive.action', { defaultValue: 'Archivar' }), style: "destructive", onPress: onArchive }
      ]
    );
  };

  const deleteWithConfirmation = () => {
    Alert.alert(
      t('habits.delete.title', { defaultValue: 'Eliminar Hábito' }),
      t('habits.delete.confirm', { name: habit.nombre, defaultValue: '¿Estás seguro de que quieres eliminar permanentemente "{{name}}"? Esto borrará de forma irreversible todo su historial, logs y estadísticas de racha.' }),
      [
        { text: t('common.cancelar', { defaultValue: 'Cancelar' }), style: "cancel" },
        { text: t('common.eliminar', { defaultValue: 'Eliminar' }), style: "destructive", onPress: onDelete }
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
          <Text style={styles.actionText}>{t('habits.archive.action', { defaultValue: 'Archivar' })}</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const onLongPress = () => {
    Alert.alert(
      t('habits.options.title', { defaultValue: 'Opciones de Hábito' }),
      t('habits.options.message', { name: habit.nombre, defaultValue: 'Elige una acción para "{{name}}"' }),
      [
        { text: t('common.editar', { defaultValue: 'Editar' }), onPress: () => router.push({ pathname: '/add-habit/basic-info', params: { habitId: habit.id } }) },
        { text: t('habits.archive.action', { defaultValue: 'Archivar' }), onPress: archiveWithConfirmation },
        { text: t('common.eliminar', { defaultValue: 'Eliminar' }), style: "destructive", onPress: deleteWithConfirmation },
        { text: t('common.cancelar', { defaultValue: 'Cancelar' }), style: "cancel" }
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
          <Text style={styles.habitStreak}>🔥 {t('habits.streak', { count: streak })}</Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};
export default function HabitsScreen() {
  const habits = useHabitStore((state) => state.habits);
  const archiveHabit = useHabitStore((state) => state.archiveHabit);
  const router = useRouter();
  const { t } = useTranslation();

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
    <SafeAreaView style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HabitItem
            habit={item}
            onArchive={() => archiveHabit(item.id)}
            onDelete={() => useHabitStore.getState().removeHabit(item.id)}
          />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('categories.' + title.toLowerCase(), { defaultValue: title })}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title={habits.length === 0 ? t('habits.empty.titulo') : t('habits.empty.active_title')}
            description={habits.length === 0 ? t('habits.empty.subtitulo') : t('habits.empty.active_subtitle')}
            icon="leaf-outline"
            actionLabel={t('habits.empty.cta', { defaultValue: 'Explorar biblioteca' })}
            onAction={() => router.push('/habit-library')}
          />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Grupo de Botones Flotantes (FABs) */}
      <View style={styles.fabContainer}>
        {/* FAB Secundario: Biblioteca */}
        <TouchableOpacity
          style={styles.fabSecondary}
          onPress={() => router.push('/habit-library')}
          activeOpacity={0.8}
        >
          <Ionicons name="library" size={24} color={Colors.primary} />
        </TouchableOpacity>
        
        {/* FAB Principal: Crear Hábito (Wizard) */}
        <TouchableOpacity
          style={styles.fabMain}
          onPress={() => router.push('/add-habit/basic-info')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={32} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 120, // padding for FAB
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
  fabContainer: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    alignItems: 'center',
    gap: 16,
  },
  fabMain: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 32,
    elevation: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    elevation: 4,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
});
