import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useTranslation } from 'react-i18next';
import { Theme } from '../../constants/theme';
import { Colors } from '../../constants/colors';
import { useOnboardingFlow } from './_layout';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { petName, setPetName } = useOnboardingFlow();

  const isValid = petName.trim().length >= 2;

  const handleNext = () => {
    if (isValid) {
      setPetName(petName.trim());
      router.push('/onboarding/interests');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        {/*
          Decisión de animación: 
          Se usa type: 'spring' en lugar de 'timing' porque el efecto de rebote sutil (bounciness) 
          refuerza el tono lúdico y amigable de la aplicación (una mascota virtual).
          El escalonamiento de 150ms dirige la atención del usuario en el orden lógico de lectura:
          primero la mascota, luego el saludo/instrucción y por último el control interactivo.
        */}
        <MotiView 
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 100 }}
          style={styles.imageContainer}
        >
          {/* El fallback es un emoji de 120px que se acerca visualmente a 200x200 */}
          <Text style={styles.emojiFallback}>🐶</Text>
        </MotiView>
        
        <MotiView 
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 250 }}
        >
          <Text style={styles.title}>{t('onboarding.welcome.title')}</Text>
        </MotiView>

        <MotiView 
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 400 }}
        >
          <TextInput
            style={styles.input}
            placeholder={t('onboarding.welcome.placeholder')}
            placeholderTextColor={Theme.colors.textSecondary}
            value={petName}
            onChangeText={setPetName}
            autoFocus
          />
        </MotiView>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, !isValid && styles.buttonDisabled]} 
          onPress={handleNext}
          disabled={!isValid}
        >
          <Text style={styles.buttonText}>{t('onboarding.welcome.nextButton')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  emojiFallback: {
    fontSize: 120, 
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: 16,
    padding: Theme.spacing.lg,
    fontSize: 18,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...Theme.shadows.soft,
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
