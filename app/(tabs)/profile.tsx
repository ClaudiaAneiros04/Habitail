import React from 'react';
import { View, StyleSheet, SafeAreaView, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import PetDisplay from '../../components/Pet/PetDisplay';
import { usePetStore } from '../../store/usePetStore';
import { useTranslation } from 'react-i18next';

export default function ProfileScreen() {
  const { pet } = usePetStore();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Renderizamos el componente principal de la mascota */}
        <PetDisplay pet={pet} />
        
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
