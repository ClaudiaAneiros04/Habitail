import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_STORAGE_KEY = '@habitail_user';

export interface User {
  id: string;
  name: string;
  email?: string;
  createdAt?: string;
}

export interface IUserRepository {
  get(): Promise<User | null>;
  save(user: User): Promise<void>;
}

export class UserRepository implements IUserRepository {
  async get(): Promise<User | null> {
    try {
      const data = await AsyncStorage.getItem(USER_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[UserRepository] Error in get():', error);
      return null;
    }
  }

  async save(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('[UserRepository] Error in save():', error);
    }
  }
}
