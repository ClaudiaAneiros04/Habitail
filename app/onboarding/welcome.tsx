import React, { useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Theme } from '../../constants/theme';
import { Colors } from '../../constants/colors';
import { useOnboardingFlow } from './_layout';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { petName, setPetName } = useOnboardingFlow();

  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.spring(anim1, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.spring(anim2, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.spring(anim3, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
    ]).start();
  }, [anim1, anim2, anim3]);

  const getAnimatedStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [30, 0],
        }),
      },
    ],
  });

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
          Animación escalonada con rebote sutil que dirige la atención:
          mascota -> saludo -> input interactivo.
        */}
        <Animated.View style={[styles.imageContainer, getAnimatedStyle(anim1)]}>
          {/* El fallback es un emoji de 120px que se acerca visualmente a 200x200 */}
          <Text style={styles.emojiFallback}>🐶</Text>
        </Animated.View>
        
        <Animated.View style={getAnimatedStyle(anim2)}>
          <Text style={styles.title}>{t('onboarding.welcome.title')}</Text>
        </Animated.View>

        <Animated.View style={getAnimatedStyle(anim3)}>
          <TextInput
            style={styles.input}
            placeholder={t('onboarding.welcome.placeholder')}
            placeholderTextColor={Theme.colors.textSecondary}
            value={petName}
            onChangeText={setPetName}
            autoFocus
          />
        </Animated.View>
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
