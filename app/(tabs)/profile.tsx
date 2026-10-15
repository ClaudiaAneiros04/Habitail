import React from 'react';
import { View, StyleSheet, SafeAreaView, Text, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import PetDisplay from '../../components/Pet/PetDisplay';
import { usePetStore } from '../../store/usePetStore';
import { useHabitStore } from '../../store/useHabitStore';
import { useTranslation } from 'react-i18next';

export default function ProfileScreen() {
  const { pet } = usePetStore();
  const notificationsEnabled = useHabitStore((state) => state.notificationsEnabled);
  const setNotificationsEnabled = useHabitStore((state) => state.setNotificationsEnabled);
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Renderizamos el componente principal de la mascota con el sprite animado */}
        <PetDisplay pet={pet} />

        {/* Control de preferencia personal de notificaciones de Habitail */}
        <View style={styles.settingCard}>
          <View style={styles.settingIconContainer}>
            <Ionicons 
              name={notificationsEnabled ? "notifications-outline" : "notifications-off-outline"} 
              size={22} 
              color={Colors.primary} 
            />
          </View>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>
              {t('notifications.settings.title', { defaultValue: 'Notificaciones de recordatorios' })}
            </Text>
            <Text style={styles.settingSubtitle}>
              {t('notifications.settings.subtitle', { defaultValue: 'Activa o desactiva los avisos de Habitail' })}
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={(val) => setNotificationsEnabled(val)}
            trackColor={{ false: Colors.inactive + '50', true: Colors.primary + '80' }}
            thumbColor={notificationsEnabled ? Colors.primary : '#f4f3f4'}
          />
        </View>
        
        {/* Espacio para futuras interacciones (Tienda, Inventario, etc.) */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            {t('profile.info_text')}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  settingCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '15',
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  settingSubtitle: {
    fontSize: 12,
    color: Colors.text,
    opacity: 0.6,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '10',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: Colors.text,
    opacity: 0.8,
    lineHeight: 20,
  },
});
