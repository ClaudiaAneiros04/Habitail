import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useUserStore } from '../../store/useUserStore';
import { usePetStore } from '../../store/usePetStore';
import { SHOP_ITEMS, ShopItem, ShopItemType } from '../../data/shopItems';

/**
 * Pantalla de Tienda (ShopScreen)
 * Permite a los usuarios gastar puntos para comprar skins y accesorios para su mascota.
 */
export default function ShopScreen() {
  const { user, updateUser } = useUserStore();
  const { pet, updatePet } = usePetStore();
  
  // Estado local para la pestaña seleccionada ('skin' o 'accessory')
  const [activeTab, setActiveTab] = useState<ShopItemType>('skin');
  
  // Estado para la previsualización antes de comprar/equipar
  const [previewSkin, setPreviewSkin] = useState<string | null>(null);
  const [previewAccessory, setPreviewAccessory] = useState<string | null>(null);

  // Obtener puntos e inventario del usuario (o valores por defecto)
  const puntos = user?.puntos || 0;
  const inventario = user?.inventario || [];

  // Filtrar items por la pestaña activa
  const displayedItems = useMemo(() => {
    return SHOP_ITEMS.filter(item => item.type === activeTab);
  }, [activeTab]);

  // Skin o accesorio actualmente equipado en la mascota
  const skinEquipada = pet?.skinEquipada || 'skin_default';
  const accesoriosEquipados = pet?.accesorios || [];

  /**
   * Maneja el clic en un ítem (para previsualizar o interactuar)
   */
  const handleItemPress = (item: ShopItem) => {
    if (item.type === 'skin') {
      setPreviewSkin(item.id);
    } else {
      setPreviewAccessory(item.id);
    }
  };

  /**
   * Maneja la compra de un ítem
   */
  const handleBuy = async (item: ShopItem) => {
    if (puntos < item.price) {
      Alert.alert('Puntos insuficientes', 'Sigue completando hábitos para ganar más puntos.');
      return;
    }
    
    // Descontar puntos y añadir al inventario
    const nuevoInventario = [...inventario, item.id];
    await updateUser({ 
      puntos: puntos - item.price,
      inventario: nuevoInventario
    });
    
    Alert.alert('¡Compra exitosa!', `Has comprado ${item.name}.`);
  };

  /**
   * Maneja el equipamiento de un ítem (cambio en el store de la mascota)
   */
  const handleEquip = async (item: ShopItem) => {
    if (!pet) return;

    if (item.type === 'skin') {
      await updatePet({ skinEquipada: item.id });
    } else {
      // Si es un accesorio, podríamos reemplazar el actual o agregarlo.
      // Por simplicidad en este modelo, asumimos 1 accesorio equipado a la vez.
      await updatePet({ accesorios: [item.id] });
    }
    Alert.alert('Equipado', `Has equipado ${item.name}.`);
  };

  /**
   * Renderiza la tarjeta de un producto (ShopItem)
   */
  const renderItem = ({ item }: { item: ShopItem }) => {
    // Determinar estados del ítem
    const isOwned = item.price === 0 || inventario.includes(item.id);
    const isEquipped = item.type === 'skin' 
      ? skinEquipada === item.id 
      : accesoriosEquipados.includes(item.id);
    const canAfford = puntos >= item.price;
    const isLocked = !isOwned && !canAfford;

    return (
      <TouchableOpacity 
        style={[styles.itemCard, isLocked && styles.itemCardLocked]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.itemImageContainer}>
          {item.image ? (
            <Image source={item.image} style={styles.itemImage} resizeMode="contain" />
          ) : (
            <Ionicons name={item.iconFallback as any || 'help'} size={40} color={isLocked ? Colors.inactive : Colors.primary} />
          )}
          {isLocked && (
            <View style={styles.lockedOverlay}>
              <Ionicons name="lock-closed" size={24} color={Colors.surface} />
            </View>
          )}
        </View>

        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        
        {!isOwned && (
          <Text style={[styles.itemPrice, isLocked && styles.itemPriceLocked]}>
            <Ionicons name="star" size={12} color={isLocked ? Colors.error : Colors.warning} /> {item.price} pts
          </Text>
        )}

        <View style={styles.actionButtonContainer}>
          {isEquipped ? (
            <View style={styles.equippedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.equippedText}>Equipado</Text>
            </View>
          ) : isOwned ? (
            <TouchableOpacity 
              style={styles.equipButton} 
              onPress={() => handleEquip(item)}
            >
              <Text style={styles.equipButtonText}>Equipar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.buyButton, isLocked && styles.buyButtonDisabled]} 
              onPress={() => handleBuy(item)}
              disabled={isLocked}
            >
              <Text style={styles.buyButtonText}>Comprar</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Nombres para mostrar en la previsualización
  const getPreviewName = (id: string | null, type: ShopItemType) => {
    if (!id) {
      if (type === 'skin') return SHOP_ITEMS.find(i => i.id === skinEquipada)?.name || 'Default';
      if (type === 'accessory' && accesoriosEquipados.length > 0) return SHOP_ITEMS.find(i => i.id === accesoriosEquipados[0])?.name || 'Ninguno';
      return 'Ninguno';
    }
    return SHOP_ITEMS.find(i => i.id === id)?.name || '';
  };

  return (
    <View style={styles.container}>
      {/* Cabecera: Saldo de Puntos */}
      <View style={styles.header}>
        <View style={styles.pointsBadge}>
          <Ionicons name="star" size={24} color={Colors.warning} />
          <Text style={styles.pointsText}>{puntos} pts</Text>
        </View>
      </View>

      {/* Preview en tiempo real (Miniatura Central) */}
      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>Previsualización</Text>
        <View style={styles.previewBox}>
          {/* Aquí iría la composición real de la mascota con Image. */}
          {/* Como no tenemos assets reales ahora, mostramos texto con lo que se vería */}
          <Ionicons name="paw" size={60} color={Colors.primary} />
          <View style={styles.previewDetails}>
            <Text style={styles.previewDetailText}>Skin: {getPreviewName(previewSkin, 'skin')}</Text>
            <Text style={styles.previewDetailText}>Accesorios: {getPreviewName(previewAccessory, 'accessory')}</Text>
          </View>
        </View>
      </View>

      {/* Pestañas (Tabs) */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'skin' && styles.activeTab]}
          onPress={() => setActiveTab('skin')}
        >
          <Text style={[styles.tabText, activeTab === 'skin' && styles.activeTabText]}>Pelajes</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'accessory' && styles.activeTab]}
          onPress={() => setActiveTab('accessory')}
        >
          <Text style={[styles.tabText, activeTab === 'accessory' && styles.activeTabText]}>Accesorios</Text>
        </TouchableOpacity>
      </View>

      {/* Grid de Ítems */}
      <FlatList
        data={displayedItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  pointsText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginLeft: 8,
  },
  previewContainer: {
    padding: 16,
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  previewBox: {
    width: 200,
    height: 150,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  previewDetails: {
    marginTop: 10,
    alignItems: 'center',
  },
  previewDetailText: {
    fontSize: 12,
    color: Colors.secondaryText,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.inactive,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 8,
  },
  itemCard: {
    flex: 1,
    margin: 8,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemCardLocked: {
    opacity: 0.7,
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    backgroundColor: Colors.background,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  itemImage: {
    width: 60,
    height: 60,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.warning,
    marginBottom: 12,
  },
  itemPriceLocked: {
    color: Colors.error,
  },
  actionButtonContainer: {
    width: '100%',
    height: 36,
    justifyContent: 'center',
  },
  buyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  buyButtonDisabled: {
    backgroundColor: Colors.inactive,
  },
  buyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  equipButton: {
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  equipButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  equippedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  equippedText: {
    color: Colors.success,
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
  },
});
