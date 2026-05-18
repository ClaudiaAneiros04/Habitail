import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
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

  /**
   * Pre-selección automática: cuando `suggestedHabits` cambia (ej. al entrar
   * por primera vez o al volver de InterestsScreen con categorías distintas),
   * se marcan todos como seleccionados.
   *
   * Se usa un ref para evitar que un re-render sobreescriba las deselecciones
   * manuales del usuario. Solo se pre-selecciona si la referencia anterior de
   * suggestedHabits es distinta (shallow), lo que ocurre cuando el hook
   * recalcula la lista.
   */
  const prevSuggestedRef = useRef<Habit[]>([]);
  useEffect(() => {
    if (suggestedHabits.length > 0 && suggestedHabits !== prevSuggestedRef.current) {
      setSelectedHabits([...suggestedHabits]);
      prevSuggestedRef.current = suggestedHabits;
    }
  }, [suggestedHabits, setSelectedHabits]);

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
     * Se usa router.replace en lugar de router.push para que el stack de
     * onboarding no sea alcanzable con el botón atrás del sistema.
     * En expo-router, `replace` reemplaza la entrada actual del historial,
     * impidiendo que el usuario vuelva al onboarding pulsando atrás.
     */
    router.replace('/(tabs)');
  };

  const renderHabit = ({ item, index }: { item: Habit; index: number }) => {
    const isSelected = selectedHabits.some(h => h.id === item.id);
    return (
      /*
       * Animación por item: cada tarjeta entra con un fade-in + slide sutil.
       * Se usa `timing` en lugar de `spring` porque la lista puede tener muchos
       * elementos y las animaciones spring acumuladas con delays largos producen
       * una sensación de "gelatina" poco profesional. Timing con easing lineal
       * es más predecible y rápido para listas.
       * Delay de 60ms por item (máximo 300ms para el 5º) para que el
       * escalonamiento sea perceptible pero la lista sea usable rápidamente.
       */
      <MotiView
        from={{ opacity: 0, translateX: 20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 300, delay: Math.min(index * 60, 300) }}
      >
        <TouchableOpacity
          style={[styles.habitItem, isSelected && styles.habitItemSelected]}
          onPress={() => toggleHabit(item)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
          accessibilityLabel={item.nombre}
        >
          {/* Indicador de color de categoría + icono del hábito */}
          <View style={[styles.iconContainer, { backgroundColor: `${item.colorHex}15` }]}>
            <Ionicons
              name={(item.icono as keyof typeof Ionicons.glyphMap) || 'ellipse-outline'}
              size={22}
              color={item.colorHex}
            />
          </View>

          <Text
            style={[styles.habitTitle, isSelected && styles.habitTitleSelected]}
            numberOfLines={2}
          >
            {item.nombre}
          </Text>

          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={26}
            color={isSelected ? Colors.primary : Theme.colors.inactive}
          />
        </TouchableOpacity>
      </MotiView>
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
      </View>

      {/*
        Título y subtítulo con animación escalonada coherente con las pantallas
        1 y 2 del flujo (spring, mismos delays base).
      */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 100 }}
        style={styles.titleContainer}
      >
        <Text style={styles.title}>{t('onboarding.habits.title')}</Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 200 }}
        style={styles.subtitleContainer}
      >
        <Text style={styles.subtitle}>{t('onboarding.habits.subtitle')}</Text>
      </MotiView>

      <FlatList
        data={suggestedHabits}
        keyExtractor={item => item.id}
        renderItem={renderHabit}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 300 }}
            style={styles.emptyContainer}
          >
            <View style={styles.emptyIconCircle}>
              <Ionicons name="search-outline" size={48} color={Theme.colors.inactive} />
            </View>
            <Text style={styles.emptyText}>{t('onboarding.habits.emptyState')}</Text>
            <TouchableOpacity
              style={styles.changeInterestsButton}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={16} color={Colors.primary} style={styles.changeInterestsIcon} />
              <Text style={styles.changeInterestsText}>{t('onboarding.habits.changeInterests')}</Text>
            </TouchableOpacity>
          </MotiView>
        )}
      />

      <View style={styles.footer}>
        {/* Contador visual de hábitos seleccionados */}
        {suggestedHabits.length > 0 && (
          <Text style={styles.selectionCount}>
            {t('onboarding.habits.selectedCount', {
              count: selectedHabits.length,
              total: suggestedHabits.length,
            })}
          </Text>
        )}
        <TouchableOpacity
          style={styles.button}
          onPress={handleStart}
          accessibilityRole="button"
        >
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
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.soft,
  },
  titleContainer: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Theme.colors.text,
    textAlign: 'center',
  },
  subtitleContainer: {
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.md,
  },
  subtitle: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
  },
  listContent: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
    flexGrow: 1,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    padding: Theme.spacing.md,
    borderRadius: 14,
    marginBottom: Theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    ...Theme.shadows.soft,
  },
  habitItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}08`,
  },
  /**
   * Contenedor circular con tinte del color de categoría del hábito.
   * El fondo usa opacidad al 15% (hex `15` ≈ 8% opacity) para que el icono
   * destaque sin saturar la fila, manteniendo coherencia con los chips
   * de InterestsScreen.
   */
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  habitTitle: {
    fontSize: 15,
    color: Theme.colors.text,
    fontWeight: '500',
    flex: 1,
    marginRight: Theme.spacing.sm,
  },
  habitTitleSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${Theme.colors.inactive}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  emptyText: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  changeInterestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}10`,
  },
  changeInterestsIcon: {
    marginRight: Theme.spacing.xs,
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
  selectionCount: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
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
