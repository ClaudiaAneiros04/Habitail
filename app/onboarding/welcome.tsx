import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useTranslation } from 'react-i18next';
import { Theme } from '../../constants/theme';
import { Colors } from '../../constants/colors';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [petName, setPetName] = useState('');

  const isValid = petName.trim().length >= 2;

  const handleNext = () => {
    if (isValid) {
      router.push({ pathname: '/onboarding/interests', params: { petName: petName.trim() } });
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <MotiView 
        from={{ opacity: 0, translateY: 50 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 800 }}
        style={styles.content}
      >
        <Text style={styles.title}>{t('onboarding.welcome.title')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('onboarding.welcome.petNamePlaceholder')}
          placeholderTextColor={Theme.colors.textSecondary}
          value={petName}
          onChangeText={setPetName}
          autoFocus
        />
      </MotiView>
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
