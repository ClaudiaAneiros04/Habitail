import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChipSelector } from '../../components/ChipSelector';
import { Theme } from '../../constants/theme';
import { Colors } from '../../constants/colors';

const CATEGORIES = ['Salud', 'Deporte', 'Productividad', 'Bienestar', 'Finanzas', 'Aprendizaje'];

export default function InterestsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { petName } = useLocalSearchParams();
  const [selected, setSelected] = useState<string[]>([]);

  const toggleCategory = (cat: string) => {
    setSelected(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleNext = () => {
    if (selected.length > 0) {
      router.push({ 
        pathname: '/onboarding/habits', 
        params: { petName: petName as string, categories: selected.join(',') } 
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.interests.title')}</Text>
        <View style={styles.chipContainer}>
          {CATEGORIES.map(cat => (
            <ChipSelector 
              key={cat}
              label={cat}
              selected={selected.includes(cat)}
              onPress={() => toggleCategory(cat)}
            />
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, selected.length === 0 && styles.buttonDisabled]} 
          onPress={handleNext}
          disabled={selected.length === 0}
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
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
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
  buttonDisabled: {
    backgroundColor: Theme.colors.inactive,
  },
  buttonText: {
    color: Colors.surface,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
