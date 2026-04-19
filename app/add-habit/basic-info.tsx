/**
 * @file basic-info.tsx
 * @description Pantalla del Paso 1 del Wizard de creación de Hábitos.
 * Maneja la entrada fundamental del hábito: el Nombre (con validación de longitud)
 * y la selección de la Categoría temática desde un grid visual interactivo.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Colors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Category } from '../../types';

// Opciones de categoría predefinidas con colores e iconos curados
const CATEGORY_DATA = [
  { id: Category.SALUD, label: 'Salud', icon: 'medical', color: '#10b981' }, // Esmeralda
  { id: Category.DEPORTE, label: 'Deporte', icon: 'barbell', color: '#3b82f6' }, // Azul
  { id: Category.PRODUCTIVIDAD, label: 'Productividad', icon: 'briefcase', color: '#8b5cf6' }, // Violeta
  { id: Category.BIENESTAR, label: 'Bienestar', icon: 'leaf', color: '#f59e0b' }, // Ámbar
  { id: Category.FINANZAS, label: 'Finanzas', icon: 'wallet', color: '#ef4444' }, // Rojo
  { id: Category.APRENDIZAJE, label: 'Aprendizaje', icon: 'book', color: '#ec4899' }, // Rosa
];

export default function BasicInfoScreen() {
  const router = useRouter();
  
  // Estado local para los campos de este paso
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState<Category | null>(null);

  // Validación robusta: El nombre debe tener significado (longitud >= 2 sin contar espacios)
  // y debe haberse seleccionado obligatoriamente un bloque de categoría.
  const isValid = nombre.trim().length >= 2 && categoria !== null;

  // Ejecuta la transición al Step 2 (appearance) arrastrando los datos locales hacia la URL de React Navigation
  const handleNext = () => {
    if (isValid) {
      router.push({ 
        pathname: '/add-habit/appearance', 
        params: { nombre, categoria: categoria! } 
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nuevo Hábito (1/3)</Text>
          <View style={{ width: 32 }} /> {/* Espaciador invisible para centrar título correctamente frente a la flacha */}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Componente visual del progreso del Wizard */}
          <ProgressBar step={1} total={3} />

          {/* Sección Nombre del Hábito */}
          <Text style={styles.label}>¿Qué hábito quieres construir?</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Beber agua, Leer 10 min..."
            placeholderTextColor={Colors.inactive}
            value={nombre}
            onChangeText={setNombre}
            maxLength={50}
          />
          {/* Mensaje de error dinámico e inline si la longitud está a medias (entre 0 y 1 char tras trim) */}
          {nombre.length > 0 && nombre.trim().length < 2 && (
            <Text style={styles.errorText}>El nombre debe tener al menos 2 caracteres.</Text>
          )}

          {/* Sección Category Picker (Grid Selector) */}
          <Text style={[styles.label, { marginTop: 32 }]}>Selecciona una categoría</Text>
          <View style={styles.grid}>
            {CATEGORY_DATA.map((cat) => {
              const isSelected = categoria === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryCard,
                    // Si el elemento está activo, renderiza un borde y opacidad sutil en el fondo usando la variante del color
                    isSelected && { borderColor: cat.color, backgroundColor: cat.color + '1A' } 
                  ]}
                  onPress={() => setCategoria(cat.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: cat.color }]}>
                    <Ionicons name={cat.icon as any} size={24} color="#FFF" />
                  </View>
                  <Text style={[
                     styles.categoryLabel,
                     isSelected && { color: cat.color, fontWeight: 'bold' } // Colorea el label en estado activo también
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Zona inferior de navegación "Next" */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.nextButton, !isValid && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={!isValid}
          >
            <Text style={styles.nextText}>Siguiente</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Subcomponente: Barra de Progreso Lineal
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
    paddingHorizontal: 16, paddingVertical: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  scrollContent: { padding: 24 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 32, gap: 8 },
  progressDot: { height: 6, flex: 1, borderRadius: 3 },
  progressActive: { backgroundColor: Colors.primary },
  progressInactive: { backgroundColor: Colors.inactive },
  label: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 16, padding: 16, fontSize: 16, color: Colors.text,
  },
  errorText: { color: Colors.accent || 'red', fontSize: 12, marginTop: 6, marginLeft: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  categoryCard: {
    width: '48%', backgroundColor: Colors.surface, borderRadius: 20, padding: 16,
    alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
    elevation: 2, shadowColor: Colors.text, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8,
  },
  iconContainer: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  categoryLabel: { fontSize: 14, color: Colors.text, fontWeight: '600', textAlign: 'center' },
  footer: { padding: 24, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  nextButton: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, gap: 8 },
  nextButtonDisabled: { backgroundColor: Colors.inactive },
  nextText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
