/**
 * @file appearance.tsx
 * @description Pantalla del Paso 2 del Wizard de creación de Hábitos.
 * Administra la apariencia visual (Color Hex e Ícono) mediante selectores visuales 
 * y recolecta una descripción opcional, reflejando todos los cambios en un panel de previsualización en vivo.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Colors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

// 12 tonos HEX para el Selector de Color (ColorPicker)
const PREDEFINED_COLORS = [
  '#ef4444', // Rojo
  '#f97316', // Naranja
  '#f59e0b', // Ámbar
  '#84cc16', // Lima
  '#22c55e', // Verde
  '#10b981', // Esmeralda
  '#0ea5e9', // Cielo
  '#3b82f6', // Azul
  '#6366f1', // Índigo
  '#8b5cf6', // Violeta
  '#d946ef', // Fucsia
  '#ec4899', // Rosa
];

// Lista curada de iconos extraídos de Ionicons especiales para Hábitos (IconPicker)
const ICONS = [
  'fitness', 'bicycle', 'walk', 'water', 'medical', 'heart', 'nutrition', 'restaurant', // Salud
  'briefcase', 'book', 'laptop', 'desktop', 'code', 'calculator', 'document-text', // Productividad
  'alarm', 'bed', 'cafe', 'moon', 'sunny', 'calendar', 'time', 'home', // Rutina diaria
  'airplane', 'car', 'cart', 'cash', 'game-controller', 'musical-notes', 'paw', 'star', // Ocio y Finanzas
  'brush', 'camera', 'color-palette', 'headset', 'leaf', 'flame', 'flash', 'rose' // Extras
];

export default function AppearanceScreen() {
  const router = useRouter();
  
  // Extraemos parámetros (nombre y categoría) enviados desde el Paso 1 (basic-info)
  const params = useLocalSearchParams();
  const nombreHabito = params.nombre as string || 'Hábito';
  
  // Estado local para el Paso 2
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(PREDEFINED_COLORS[7]); // Por defecto: Azul
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]); // Por defecto: 'fitness'

  // Transición hacia el siguiente paso
  const handleNext = () => {
    // Viaja hacia el Paso 3, arrastrando todo el ecosistema de valores recabados
    router.push({
      pathname: '/add-habit/step3', // Modificar a '/add-habit/frequency' en el próximo paso si se requiere renombrar
      params: { 
        ...params, // Hereda 'nombre' y 'categoria'
        descripcion: description,
        colorHex: selectedColor,
        icono: selectedIcon
      }
    });
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
          <Text style={styles.headerTitle}>Apariencia (2/3)</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ProgressBar step={2} total={3} />

          {/* Tarjeta Visual: Previsualización reactiva del Hábito en tiempo real */}
          <Text style={styles.label}>Previsualización</Text>
          <View style={styles.previewCard}>
            <View style={[styles.iconPreviewContainer, { backgroundColor: selectedColor }]}>
              <Ionicons name={selectedIcon as any} size={28} color="#FFF" />
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewName}>{nombreHabito}</Text>
              <Text style={styles.previewSubName}>{description ? description : 'Sin descripción'}</Text>
            </View>
          </View>

          {/* Componente: ColorPicker (Burbujas de 12 tonos) */}
          <Text style={[styles.label, { marginTop: 24 }]}>Color del hábito</Text>
          <View style={styles.colorGrid}>
            {PREDEFINED_COLORS.map(color => {
              const isSelected = selectedColor === color;
              return (
                <TouchableOpacity
                  key={color}
                  onPress={() => setSelectedColor(color)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    isSelected && styles.colorCircleSelected
                  ]}
                  activeOpacity={0.8}
                >
                  {/* Destaca visualmente una marca sobre el color elegido */}
                  {isSelected && <Ionicons name="checkmark" size={18} color="#FFF" />}
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Componente: IconPicker (Grid con Scroll) */}
          <Text style={[styles.label, { marginTop: 24 }]}>Icono representativo</Text>
          <View style={styles.iconGrid}>
            {ICONS.map((iconName) => {
              const isSelected = selectedIcon === iconName;
              return (
                <TouchableOpacity
                  key={iconName}
                  onPress={() => setSelectedIcon(iconName)}
                  style={[
                    styles.iconCircle,
                    isSelected && { backgroundColor: selectedColor }
                  ]}
                >
                  <Ionicons 
                    name={iconName as any} 
                    size={24} 
                    color={isSelected ? '#FFF' : Colors.inactive} 
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Componente: Area de texto opcional para Descripción */}
          <Text style={[styles.label, { marginTop: 24 }]}>Descripción (Opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="¿Por qué quieres cumplir este hábito?"
            placeholderTextColor={Colors.inactive}
            value={description}
            onChangeText={setDescription}
            maxLength={100}
            multiline
            numberOfLines={3}
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.nextButton}
            onPress={handleNext}
          >
            <Text style={styles.nextText}>Siguiente</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 16, paddingVertical: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  scrollContent: { padding: 24 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 32, gap: 8 },
  progressDot: { height: 6, flex: 1, borderRadius: 3 },
  progressActive: { backgroundColor: Colors.primary },
  progressInactive: { backgroundColor: Colors.inactive },
  label: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  previewCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 16,
    borderRadius: 20, elevation: 2, shadowColor: Colors.text, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, borderWidth: 1, borderColor: '#e2e8f0',
  },
  iconPreviewContainer: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  previewInfo: { flex: 1 },
  previewName: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  previewSubName: { fontSize: 14, color: Colors.inactive, marginTop: 4 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  colorCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  colorCircleSelected: { borderWidth: 3, borderColor: Colors.text },
  iconGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center',
    backgroundColor: Colors.surface, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0',
  },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 16,
    padding: 16, fontSize: 16, color: Colors.text, textAlignVertical: 'top',
  },
  footer: { padding: 24, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  nextButton: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, gap: 8 },
  nextText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
