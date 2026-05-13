/**
 * @file settings.tsx
 * @description Pantalla del Paso 3 del Wizard de creación de Hábitos.
 * Administra la frecuencia, prioridad y recordatorios. Al finalizar guarda el hábito.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Platform, Switch } from 'react-native';
import { Colors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useHabitStore } from '../../store/useHabitStore';
import { Frequency, VerificationType, Priority } from '../../types';

const DAYS_OF_WEEK = [
  { id: 1, label: 'L' },
  { id: 2, label: 'M' },
  { id: 3, label: 'X' },
  { id: 4, label: 'J' },
  { id: 5, label: 'V' },
  { id: 6, label: 'S' },
  { id: 0, label: 'D' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const addHabit = useHabitStore(state => state.addHabit);

  const [frequency, setFrequency] = useState<Frequency>(Frequency.DAILY);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // L-V por defecto
  const [priority, setPriority] = useState<Priority>(Priority.NORMAL);
  const [reminderEnabled, setReminderEnabled] = useState(false);

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      // Evitar que se deseleccionen todos
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter(d => d !== dayId));
      }
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const handleSave = () => {
    // Resolver días de la semana según frecuencia
    let diasSemana = [0, 1, 2, 3, 4, 5, 6];
    if (frequency === Frequency.WEEKLY) {
      diasSemana = selectedDays;
    }

    addHabit({
      userId: 'default-user', // MVP: offline sin cuenta
      nombre: params.nombre as string,
      descripcion: params.descripcion as string,
      categoria: params.categoria as string,
      icono: params.icono as string,
      colorHex: params.colorHex as string,
      frecuencia: frequency,
      diasSemana,
      horaRecordatorio: reminderEnabled ? '09:00' : undefined, // MVP: Mock hour for reminder
      tipoVerificacion: VerificationType.BOOLEAN, // MVP: Only boolean
      nivelPrioridad: priority,
      fechaInicio: new Date().toISOString(),
      activo: true,
    });

    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Configuración (3/3)</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ProgressBar step={3} total={3} />

          {/* Frecuencia */}
          <Text style={styles.label}>Frecuencia</Text>
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={[styles.optionButton, frequency === Frequency.DAILY && styles.optionSelected]}
              onPress={() => setFrequency(Frequency.DAILY)}
            >
              <Text style={[styles.optionText, frequency === Frequency.DAILY && styles.optionTextSelected]}>Diaria</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, frequency === Frequency.WEEKLY && styles.optionSelected]}
              onPress={() => setFrequency(Frequency.WEEKLY)}
            >
              <Text style={[styles.optionText, frequency === Frequency.WEEKLY && styles.optionTextSelected]}>Semanal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, frequency === Frequency.MONTHLY && styles.optionSelected]}
              onPress={() => setFrequency(Frequency.MONTHLY)}
            >
              <Text style={[styles.optionText, frequency === Frequency.MONTHLY && styles.optionTextSelected]}>Mensual</Text>
            </TouchableOpacity>
          </View>

          {/* Selector de días para Semanal */}
          {frequency === Frequency.WEEKLY && (
            <View style={styles.daysContainer}>
              <Text style={styles.subLabel}>¿Qué días quieres realizarlo?</Text>
              <View style={styles.daysRow}>
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = selectedDays.includes(day.id);
                  return (
                    <TouchableOpacity
                      key={day.id}
                      style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}
                      onPress={() => toggleDay(day.id)}
                    >
                      <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Prioridad */}
          <Text style={[styles.label, { marginTop: 32 }]}>Nivel de Prioridad</Text>
          <Text style={styles.descriptionText}>Esto afecta la vida de tu mascota virtual si no cumples el hábito.</Text>
          <View style={styles.priorityGrid}>
            <TouchableOpacity
              style={[styles.priorityCard, priority === Priority.FLEXIBLE && styles.prioritySelected]}
              onPress={() => setPriority(Priority.FLEXIBLE)}
            >
              <Text style={[styles.priorityTitle, priority === Priority.FLEXIBLE && styles.priorityTextSelected]}>Flexible</Text>
              <Text style={[styles.priorityDesc, priority === Priority.FLEXIBLE && styles.priorityTextSelected]}>±5 de vida</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priorityCard, priority === Priority.NORMAL && styles.prioritySelected]}
              onPress={() => setPriority(Priority.NORMAL)}
            >
              <Text style={[styles.priorityTitle, priority === Priority.NORMAL && styles.priorityTextSelected]}>Normal</Text>
              <Text style={[styles.priorityDesc, priority === Priority.NORMAL && styles.priorityTextSelected]}>±10 de vida</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priorityCard, priority === Priority.ESSENTIAL && styles.prioritySelected]}
              onPress={() => setPriority(Priority.ESSENTIAL)}
            >
              <Text style={[styles.priorityTitle, priority === Priority.ESSENTIAL && styles.priorityTextSelected]}>Esencial</Text>
              <Text style={[styles.priorityDesc, priority === Priority.ESSENTIAL && styles.priorityTextSelected]}>±20 de vida</Text>
            </TouchableOpacity>
          </View>

          {/* Recordatorio */}
          <View style={styles.reminderContainer}>
            <View>
              <Text style={styles.label}>Recordatorio</Text>
              <Text style={styles.descriptionText}>Recibe una notificación diaria.</Text>
            </View>
            <Switch
              trackColor={{ false: Colors.inactive, true: Colors.primary }}
              thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (reminderEnabled ? '#FFFFFF' : '#f4f3f4')}
              ios_backgroundColor="#3e3e3e"
              onValueChange={setReminderEnabled}
              value={reminderEnabled}
            />
          </View>
          {reminderEnabled && (
             <Text style={styles.mockReminderText}>
               * Hora de recordatorio por defecto: 09:00 (configurable en futuras versiones).
             </Text>
          )}

        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.nextButton}
            onPress={handleSave}
          >
            <Text style={styles.nextText}>Guardar Hábito</Text>
            <Ionicons name="checkmark" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Subcomponente: Barra de Progreso Lineal compartida
const ProgressBar = ({ step, total }: { step: number, total: number }) => {
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: total }).map((_, idx) => (
        <View 
          key={idx} 
          style={[
            styles.progressDot, 
            idx < step ? styles.progressActive : styles.progressInactive
          ]} 
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  scrollContent: { padding: 24 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 32, gap: 8 },
  progressDot: { height: 6, flex: 1, borderRadius: 3 },
  progressActive: { backgroundColor: Colors.primary },
  progressInactive: { backgroundColor: Colors.inactive },
  label: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  subLabel: { fontSize: 14, fontWeight: '500', color: Colors.text, marginTop: 16, marginBottom: 12 },
  descriptionText: { fontSize: 14, color: Colors.inactive, marginBottom: 16 },
  optionsRow: { flexDirection: 'row', gap: 12 },
  optionButton: {
    flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: Colors.surface, alignItems: 'center',
  },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  optionText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  optionTextSelected: { color: Colors.primary },
  daysContainer: { marginTop: 8, padding: 16, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: Colors.primary },
  dayText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  dayTextSelected: { color: '#FFF' },
  priorityGrid: { flexDirection: 'row', gap: 12 },
  priorityCard: {
    flex: 1, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: Colors.surface, alignItems: 'center',
  },
  prioritySelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  priorityTitle: { fontSize: 14, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  priorityDesc: { fontSize: 12, color: Colors.inactive },
  priorityTextSelected: { color: Colors.primary },
  reminderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 32 },
  mockReminderText: { fontSize: 12, color: Colors.inactive, marginTop: 8, fontStyle: 'italic' },
  footer: { padding: 24, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  nextButton: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, gap: 8 },
  nextText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
