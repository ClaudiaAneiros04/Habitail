import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useHabitLibrary } from '../../hooks/useHabitLibrary';
import { useOnboarding } from '../../hooks/useOnboarding';
import { Theme } from '../../constants/theme';
import { Colors } from '../../constants/colors';
import { Habit } from '../../types';
import { useOnboardingFlow } from './_layout';

export default function HabitsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { petName, selectedCategories, selectedHabits, setSelectedHabits } = useOnboardingFlow();

  const { suggestedHabits } = useHabitLibrary(selectedCategories);
  const { completeOnboarding } = useOnboarding();

  const toggleHabit = (habit: Habit) => {
    setSelectedHabits(
      selectedHabits.some(h => h.id === habit.id)
        ? selectedHabits.filter(h => h.id !== habit.id)
        : [...selectedHabits, habit]
    );
  };

  const handleStart = async () => {
    await completeOnboarding(selectedHabits, petName);
    /**
     * Se usa router.replace en lugar de router.push para que
     * el stack de onboarding no sea alcanzable con el botón atrás del sistema.
     * Esto reemplaza el historial completo de navegación.
     */
    router.replace('/(tabs)');
  };

  const renderHabit = ({ item }: { item: Habit }) => {
    const isSelected = selectedHabits.some(h => h.id === item.id);
    return (
      <TouchableOpacity 
        style={[styles.habitItem, isSelected && styles.habitItemSelected]} 
        onPress={() => toggleHabit(item)}
      >
        <Text style={[styles.habitTitle, isSelected && styles.habitTitleSelected]}>{item.nombre}</Text>
        <Ionicons 
          name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
          size={24} 
          color={isSelected ? Colors.primary : Theme.colors.inactive} 
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header con botón atrás */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('onboarding.habits.title')}</Text>
      </View>
      
      <FlatList
        data={suggestedHabits}
        keyExtractor={item => item.id}
        renderItem={renderHabit}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="leaf-outline" size={64} color={Theme.colors.inactive} />
            <Text style={styles.emptyText}>{t('onboarding.habits.emptyState')}</Text>
            <TouchableOpacity 
              style={styles.changeInterestsButton} 
              onPress={() => router.back()}
            >
              <Text style={styles.changeInterestsText}>{t('onboarding.habits.changeInterests')}</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleStart}>
          <Text style={styles.buttonText}>{t('onboarding.habits.startButton')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    ...Theme.shadows.soft,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Theme.colors.text,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: Theme.spacing.lg,
    flexGrow: 1,
  },
  habitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    padding: Theme.spacing.md,
    borderRadius: 12,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...Theme.shadows.soft,
  },
  habitItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`, // Light tint
  },
  habitTitle: {
    fontSize: 16,
    color: Theme.colors.text,
    flex: 1,
  },
  habitTitleSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: Theme.spacing.md,
    fontSize: 16,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },
  changeInterestsButton: {
    marginTop: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: 8,
    backgroundColor: `${Colors.primary}10`,
  },
  changeInterestsText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    padding: Theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : Theme.spacing.lg,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: Theme.spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  buttonText: {
    color: Colors.surface,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
