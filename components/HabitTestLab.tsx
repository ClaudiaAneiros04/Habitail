import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Colors } from '../constants/colors';
import { useHabitStore, loadHabitsFromStorage } from '../store/useHabitStore';
import { Habit, HabitFrequency, VerificationType, PriorityLevel } from '../db/schema';

/**
 * Componente: HabitTestLab
 * 
 * Separamos la lógica de pruebas en este componente para mantener 
 * las pantallas principales limpias y modulares.
 */
export const HabitTestLab = () => {
  const [hasHydrated, setHasHydrated] = React.useState(false);
  
  // Acciones y estado del store de hábitos
  const habits = useHabitStore((state) => state.habits);
  const addHabit = useHabitStore((state) => state.addHabit);
  const removeHabit = useHabitStore((state) => state.removeHabit);

  /**
   * Proceso de Hidratación:
   * Al montar este laboratorio, nos aseguramos de que los datos estén cargados.
   */
  React.useEffect(() => {
    const hydrate = async () => {
      console.log('[TestLab] Iniciando hidratación...');
      try {
        await loadHabitsFromStorage();
        console.log('[TestLab] Hidratado.');
      } catch (e) {
        console.error('[TestLab] Error:', e);
      } finally {
        setHasHydrated(true);
      }
    };
    hydrate();
  }, []);

  /**
   * testStorage: Añade un hábito, lee (log) y ofrece feedback visual.
   */
  const testStorage = () => {
    const testId = `habit-${Date.now().toString(36)}`;
    const newHabit: Habit = {
      id: testId,
      userId: 'test-user',
      nombre: `Hábito Test ${habits.length + 1}`,
      categoria: 'Testing',
      icono: 'flask-outline',
      color: '#4285F4',
      frecuencia: HabitFrequency.DAILY,
      diasSemana: [],
      tipVerificacion: VerificationType.BOOLEAN,
      nivelPrioridad: PriorityLevel.MEDIUM,
      fechaInicio: new Date().toISOString(),
      activo: true,
    };

    addHabit(newHabit);
    console.log('[TestLab] Añadido y Listado. Total:', habits.length + 1);
  };

  /**
   * Operación de eliminación para cerrar el ciclo CRUD.
   */
  const removeLast = () => {
    if (habits.length > 0) {
      const lastId = habits[habits.length - 1].id;
      removeHabit(lastId);
      console.log('[TestLab] Eliminado:', lastId);
    } else {
      Alert.alert('Info', 'No hay nada que eliminar.');
    }
  };

  if (!hasHydrated) return <Text style={styles.loadingText}>Cargando store...</Text>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧪 Lab Experimental</Text>
        <Text style={styles.subtitle}>Consola de Estado y Persistencia</Text>
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={testStorage}>
          <Text style={styles.btnText}>Añadir Hábito</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnRed]} onPress={removeLast}>
          <Text style={styles.btnText}>Borrar Último</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.jsonBox}>
        <Text style={styles.jsonHeader}>DB LOCAL SNAPSHOT ({habits.length})</Text>
        <ScrollView style={styles.scrollView} nestedScrollEnabled={true}>
          <Text style={styles.code}>
            {habits.length > 0 
              ? JSON.stringify(habits, null, 2) 
              : '// Store vacío'}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  loadingText: {
    padding: 40,
    textAlign: 'center',
    color: '#999',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text || '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBlue: { backgroundColor: '#4285F4' },
  btnRed: { backgroundColor: '#EA4335' },
  btnText: { color: '#FFF', fontWeight: 'bold' },
  jsonBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    height: 300,
  },
  jsonHeader: {
    color: '#6366F1',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  code: {
    color: '#CFD8DC',
    fontFamily: 'monospace',
    fontSize: 11,
  },
});
