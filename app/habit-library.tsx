/**
 * @file habit-library.tsx
 * @description Pantalla de Biblioteca de Sugerencias.
 * Proporciona un catálogo de hábitos predefinidos que los usuarios
 * pueden añadir rápidamente, organizados por categorías usando "Tabs" simulados.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { Colors } from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Category, SuggestedHabit } from '../types';

// Mock de hábitos sugeridos (En una app real podría venir de una API local/remota)
const SUGGESTED_HABITS: SuggestedHabit[] = [
  { id: '1', nombre: 'Beber Agua', categoria: Category.SALUD, icono: 'water', descripcion: 'Beber al menos 2 litros de agua diarios.', locale: 'es' },
  { id: '2', nombre: 'Caminar 10k pasos', categoria: Category.DEPORTE, icono: 'walk', descripcion: 'Alcanzar el objetivo diario de caminata.', locale: 'es' },
  { id: '3', nombre: 'Leer un libro', categoria: Category.APRENDIZAJE, icono: 'book', descripcion: 'Leer por lo menos 15 minutos en silencio.', locale: 'es' },
  { id: '4', nombre: 'Ahorro semanal', categoria: Category.FINANZAS, icono: 'wallet', descripcion: 'Transferir dinero al fondo de ahorros.', locale: 'es' },
  { id: '5', nombre: 'Planificar el día', categoria: Category.PRODUCTIVIDAD, icono: 'briefcase', descripcion: 'Anotar tareas a primera hora o por la noche.', locale: 'es' },
  { id: '6', nombre: 'Meditar', categoria: Category.BIENESTAR, icono: 'leaf', descripcion: 'Sesión de 5-10 min de respiración profunda.', locale: 'es' },
  { id: '7', nombre: 'Dormir 8 horas', categoria: Category.SALUD, icono: 'moon', descripcion: 'Desconectar temprano y priorizar el sueño.', locale: 'es' },
  { id: '8', nombre: 'Aprender idioma', categoria: Category.APRENDIZAJE, icono: 'language', descripcion: 'Superar 1 lección diaria en una app de idiomas.', locale: 'es' },
];

export default function HabitLibraryScreen() {
  const router = useRouter();
  
  // Extraemos las categorías únicas basadas en nuestras sugerencias
  const tabs = useMemo(() => {
    const categories = new Set(SUGGESTED_HABITS.map(h => h.categoria));
    // Agregamos 'Todos' al principio
    return ['TODOS', ...Array.from(categories)];
  }, []);

  const [activeTab, setActiveTab] = useState<string>('TODOS');

  // Filtra los hábitos mostrados según el tab actual seleccionado
  const filteredHabits = useMemo(() => {
    if (activeTab === 'TODOS') return SUGGESTED_HABITS;
    return SUGGESTED_HABITS.filter(h => h.categoria === activeTab);
  }, [activeTab]);

  // Maneja el botón de añadir rápido
  const handleAddTemplate = (habit: SuggestedHabit) => {
    // Redirige al Wizard de creación enviando los datos default pre-cargados
    router.push({
      pathname: '/add-habit/basic-info',
      params: { 
        nombre: habit.nombre, 
        categoria: habit.categoria,
      }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Librería de Ideas</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Tabs horizontales (Pills) */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={tabs}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const isActive = activeTab === item;
            return (
              <TouchableOpacity
                onPress={() => setActiveTab(item)}
                style={[styles.tabBadge, isActive && styles.tabBadgeActive]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {item === 'TODOS' ? 'Todos' : item}
                </Text>
              </TouchableOpacity>
            )
          }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        />
      </View>

      {/* Lista de sugerencias */}
      <FlatList
        data={filteredHabits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.suggestionCard}>
            <View style={styles.iconContainer}>
              <Ionicons name={item.icono as any} size={28} color={Colors.primary} />
            </View>
            
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{item.nombre}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{item.descripcion}</Text>
            </View>

            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => handleAddTemplate(item)}
            >
              <Text style={styles.addButtonText}>Añadir</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="library-outline" size={48} color={Colors.inactive} />
            <Text style={styles.emptyText}>No hay ideas en esta categoría.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  tabsContainer: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  tabBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabBadgeActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.inactive,
    textTransform: 'capitalize',
  },
  tabTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.inactive,
    lineHeight: 18,
  },
  addButton: {
    backgroundColor: Colors.background,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  addButtonText: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 16,
    color: Colors.inactive,
    fontSize: 16,
  }
});
