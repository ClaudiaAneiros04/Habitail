import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useHabitStore } from '../../store/useHabitStore';
import { Colors } from '../../constants/colors';
import { useHabitStats } from '../../components/useHabitStats';

/**
 * Pantalla que muestra el detalle de un hábito en específico.
 * Se centra en visualizar la información histórica del usuario: su racha actual resaltada (Gamificación), 
 * su mejor puntuación histórica y su persistencia general (ratio de terminación).
 * Utiliza el router de Expo (basado en file-system) para extraer el ID de URL.
 * 
 * @returns {JSX.Element} Screen container con scrollview y tarjetas visuales.
 */
export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const allHabits = useHabitStore((state) => state.habits);
  const habit = allHabits.find(h => h.id === id);

  if (!habit) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Obtenemos los stats calculados en base a logic/
  const { currentStreak, maxStreak, completionRate, isLoading } = useHabitStats(habit);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalles del Hábito</Text>
        <View style={{ width: 24 }} /> {/* Spacer */}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Habit Card Header */}
        <View style={styles.card}>
          <View style={[styles.iconContainer, { backgroundColor: habit.colorHex || Colors.primary }]}>
            <Ionicons name={(habit.icono as any) || 'star'} size={48} color="#FFF" />
          </View>
          <Text style={styles.habitName}>{habit.nombre}</Text>
          {habit.descripcion && <Text style={styles.habitDesc}>{habit.descripcion}</Text>}
        </View>

        {/* Stats Section */}
        <Text style={styles.sectionTitle}>Estadísticas</Text>

        <View style={styles.statsContainer}>
          {/* Main Streak Tile */}
          <View style={styles.statTilePrimary}>
            <Text style={styles.statTileLabelPrimary}>Racha Actual</Text>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFF" style={{ marginTop: 8 }} />
            ) : (
              <View style={styles.streakRow}>
                <Text style={styles.statTileValuePrimary}>🔥 {currentStreak}</Text>
                <Text style={styles.statTileSubPrimary}>
                  {currentStreak === 1 ? 'día' : 'días'} consecutivos
                </Text>
              </View>
            )}
          </View>

          <View style={styles.secondaryStatsRow}>
            {/* Max Streak */}
            <View style={styles.statTileSmall}>
              <Text style={styles.statTileLabel}>Mejor Racha</Text>
              <Text style={styles.statTileValue}>{maxStreak}</Text>
            </View>

            {/* Completion Rate */}
            <View style={styles.statTileSmall}>
              <Text style={styles.statTileLabel}>Índice de Éxito</Text>
              <Text style={styles.statTileValue}>{completionRate}%</Text>
            </View>
          </View>
        </View>

        {/* Metadata Details */}
        <Text style={styles.sectionTitle}>Información</Text>
        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Frecuencia:</Text>
            <Text style={styles.infoValue}>{habit.frecuencia}</Text>
          </View>
          {habit.horaRecordatorio && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Hora Récordatorio:</Text>
              <Text style={styles.infoValue}>{habit.horaRecordatorio}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Prioridad:</Text>
            <Text style={styles.infoValue}>{habit.nivelPrioridad}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Creado:</Text>
            <Text style={styles.infoValue}>
              {format(new Date(habit.fechaInicio), 'dd MMM yyyy', { locale: es })}
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: { padding: 8, backgroundColor: Colors.surface, borderRadius: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  iconContainer: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  habitName: { fontSize: 24, fontWeight: 'bold', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  habitDesc: { fontSize: 16, color: Colors.text, opacity: 0.6, textAlign: 'center' },
  
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 12, marginTop: 8 },
  statsContainer: { marginBottom: 24 },
  
  statTilePrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 20, padding: 24, marginBottom: 16,
    alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  statTileLabelPrimary: { fontSize: 16, color: '#FFF', opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  streakRow: { alignItems: 'center' },
  statTileValuePrimary: { fontSize: 48, fontWeight: 'bold', color: '#FFF' },
  statTileSubPrimary: { fontSize: 16, color: '#FFF', opacity: 0.9, marginTop: 4 },
  
  secondaryStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statTileSmall: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 20, padding: 20, marginHorizontal: 6,
    alignItems: 'center', shadowColor: Colors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statTileLabel: { fontSize: 12, color: Colors.text, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  statTileValue: { fontSize: 24, fontWeight: 'bold', color: Colors.text },
  
  infoBox: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20,
    shadowColor: Colors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.inactive + '40' },
  infoLabel: { fontSize: 16, color: Colors.text, opacity: 0.7 },
  infoValue: { fontSize: 16, fontWeight: '600', color: Colors.text },
});
