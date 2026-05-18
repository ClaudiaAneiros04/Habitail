import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ChipSelector } from '../../components/ChipSelector';
import { Theme } from '../../constants/theme';
import { Colors } from '../../constants/colors';
import { Category } from '../../types';
import { useOnboardingFlow } from './_layout';

/**
 * Definición de las 6 categorías del MVP con sus iconos Ionicons asociados.
 * El mapeo icono↔categoría vive aquí (nivel de pantalla), no en ChipSelector,
 * porque ChipSelector es agnóstico al dominio.
 */
const CATEGORY_CONFIG: { id: Category; icon: keyof typeof Ionicons.glyphMap; i18nKey: string }[] = [
  { id: Category.SALUD, icon: 'heart', i18nKey: 'onboarding.interests.categories.salud' },
  { id: Category.DEPORTE, icon: 'fitness', i18nKey: 'onboarding.interests.categories.deporte' },
  { id: Category.PRODUCTIVIDAD, icon: 'briefcase', i18nKey: 'onboarding.interests.categories.productividad' },
  { id: Category.BIENESTAR, icon: 'leaf', i18nKey: 'onboarding.interests.categories.bienestar' },
  { id: Category.FINANZAS, icon: 'wallet', i18nKey: 'onboarding.interests.categories.finanzas' },
  { id: Category.APRENDIZAJE, icon: 'book', i18nKey: 'onboarding.interests.categories.aprendizaje' },
];

export default function InterestsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { selectedCategories, setSelectedCategories } = useOnboardingFlow();

  const isValid = selectedCategories.length > 0;

  /**
   * Ancho de cada chip: se reparte el espacio disponible en 2 columnas
   * descontando los paddings laterales (lg × 2) y los márgenes del chip (xs × 2).
   * Esto garantiza un grid uniforme de 2 columnas tanto en portrait como en landscape.
   */
  const chipWidth = (width - Theme.spacing.lg * 2 - Theme.spacing.xs * 4) / 2;

  const toggleCategory = (cat: Category) => {
    setSelectedCategories(
      selectedCategories.includes(cat)
        ? selectedCategories.filter(c => c !== cat)
        : [...selectedCategories, cat]
    );
  };

  const handleNext = () => {
    if (isValid) {
      router.push('/onboarding/habits');
    }
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

      <View style={styles.content}>
        {/*
          Decisión de animación:
          Se usa `type: 'spring'` con escalonamiento de 100ms entre título y subtítulo
          para mantener coherencia con WelcomeScreen (misma curva y velocidad).
          El delay del grid (300ms) da tiempo al usuario para leer los textos
          antes de que aparezcan los chips con los que interactuar.
        */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 100 }}
        >
          <Text style={styles.title}>{t('onboarding.interests.title')}</Text>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 200 }}
        >
          <Text style={styles.subtitle}>{t('onboarding.interests.subtitle')}</Text>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 300 }}
          style={styles.chipGrid}
        >
          {CATEGORY_CONFIG.map((cat, index) => (
            /*
             * Cada chip tiene un delay individual para crear un efecto cascada
             * que guía la mirada del usuario por el grid de arriba a abajo.
             * Se usa 50ms por chip (no 100ms) para que el escalonamiento sea
             * perceptible pero no lento — el grid completo termina en ~550ms.
             */
            <MotiView
              key={cat.id}
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', delay: 350 + index * 50 }}
              style={{ width: chipWidth }}
            >
              <ChipSelector
                label={t(cat.i18nKey)}
                icon={cat.icon}
                selected={selectedCategories.includes(cat.id)}
                onPress={() => toggleCategory(cat.id)}
              />
            </MotiView>
          ))}
        </MotiView>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, !isValid && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!isValid}
          accessibilityRole="button"
          accessibilityState={{ disabled: !isValid }}
        >
          <Text style={styles.buttonText}>{t('onboarding.interests.nextButton')}</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
    marginBottom: Theme.spacing.xl,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  footer: {
    padding: Theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : Theme.spacing.lg,
  },
  button: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: Theme.spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  buttonDisabled: {
    backgroundColor: Theme.colors.inactive,
  },
  buttonText: {
    color: Colors.surface,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
