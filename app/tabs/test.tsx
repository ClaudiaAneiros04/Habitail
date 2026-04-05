import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../constants/colors';
import { HabitTestLab } from '../../components/HabitTestLab';

/**
 * Pantalla de Pruebas (Laboratorio)
 * 
 * Esta pantalla es temporal y sirve para realizar pruebas de integración
 * con el store de Zustand y el almacenamiento persistente.
 */
export default function TestScreen() {
  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Usamos el componente modularizado que creamos anteriormente */}
        <HabitTestLab />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background || '#F8F9FA',
  },
  contentContainer: {
    paddingVertical: 20,
  },
});
