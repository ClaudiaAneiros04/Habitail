import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { useHabitStore, loadHabitsFromStorage } from '../../store/useHabitStore';
/**
 * Pantalla principal que muestra el resumen de actividades del día actual.
 * Utiliza el store useHabitStore para obtener la lista de hábitos.
 */
export default function TodayScreen() {
  const [hasHydrated, setHasHydrated] = React.useState(false);
  const habits = useHabitStore((state) => state.habits);

  React.useEffect(() => {
    const hydrate = async () => {
      await loadHabitsFromStorage();
      setHasHydrated(true);
    };
    hydrate();
  }, []);

  if (!hasHydrated) {
    return (
      <View style={styles.container}>
        <View style={styles.surface}>
          <Text style={styles.title}>Cargando...</Text>
        </View>
      </View>
    );
  }

  const totalHabits = habits?.length || 0;

  return (
    <View style={styles.container}>
      <View style={styles.surface}>
        <Text style={styles.title}>Hoy</Text>
        <Text style={styles.subtitle}>
          Tienes {totalHabits} {totalHabits === 1 ? 'hábito registrado' : 'hábitos registrados'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  surface: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text,
    opacity: 0.6,
  },
});
