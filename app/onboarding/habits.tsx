import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useHabitLibrary } from '../../hooks/useHabitLibrary';
import { useOnboarding } from '../../hooks/useOnboarding';
import { Theme } from '../../constants/theme';
import { Colors } from '../../constants/colors';
import { Habit } from '../../types';

export default function HabitsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { petName, categories } = useLocalSearchParams();
  const catArray = (categories as string)?.split(',') || [];
  
  const { suggestedHabits } = useHabitLibrary(catArray);
  const { completeOnboarding } = useOnboarding();
  const [selectedHabits, setSelectedHabits] = useState<Habit[]>([]);

  const toggleHabit = (habit: Habit) => {
    setSelectedHabits(prev => 
      prev.some(h => h.id === habit.id) 
        ? prev.filter(h => h.id !== habit.id) 
        : [...prev, habit]
    );
  };

  const handleStart = async () => {
    await completeOnboarding(selectedHabits, petName as string);
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
      <View style={styles.header}>
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
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.md,
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
