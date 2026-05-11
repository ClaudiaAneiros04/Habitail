import { ImageSourcePropType } from 'react-native';

export type ShopItemType = 'skin' | 'accessory';

export interface ShopItem {
  id: string;
  name: string;
  type: ShopItemType;
  price: number;
  // Usamos any para simplificar el require, o icon fallback
  image: any; 
  iconFallback?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'skin_default',
    name: 'Gato Naranja',
    type: 'skin',
    price: 0,
    image: null,
    iconFallback: 'color-palette-outline'
  },
  {
    id: 'skin_siamese',
    name: 'Siamés',
    type: 'skin',
    price: 500,
    image: null,
    iconFallback: 'color-palette-outline'
  },
  {
    id: 'skin_black',
    name: 'Pantera',
    type: 'skin',
    price: 1000,
    image: null,
    iconFallback: 'color-palette-outline'
  },
  {
    id: 'acc_glasses',
    name: 'Gafas de Sol',
    type: 'accessory',
    price: 300,
    image: null,
    iconFallback: 'glasses-outline'
  },
  {
    id: 'acc_hat',
    name: 'Sombrero Mágico',
    type: 'accessory',
    price: 800,
    image: null,
    iconFallback: 'hat-outline'
  },
];
