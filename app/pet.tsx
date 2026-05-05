import React from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import PetDisplay from '../components/Pet/PetDisplay';
import { usePetStore } from '../store/usePetStore';

/**
 * PetScreen
 * Pantalla principal de la mascota virtual.
 * Muestra el estado detallado, animaciones y permite interactuar con ella.
 */
export default function PetScreen() {
  const router = useRouter();
  const { pet } = usePetStore();

  return (
    <SafeAreaView style={styles.container}>
      {/* Configuración de la cabecera del Stack */}
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Mascota',
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.background },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color={Colors.text} />
            </TouchableOpacity>
          ),
        }} 
      />

      <View style={styles.content}>
        {/* Renderizamos el componente principal de la mascota */}
        <PetDisplay pet={pet} />
        
        {/* Espacio para futuras interacciones (Tienda, Inventario, etc.) */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            ¡Completa tus hábitos diarios para mantener a tu mascota feliz y subir de nivel!
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
  backButton: {
    marginLeft: 10,
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
