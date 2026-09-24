import * as SecureStore from 'expo-secure-store';

/** Almacenamiento seguro (Keychain/Keystore nativo) para tokens de sesión. */
export const storage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  del: (key: string) => SecureStore.deleteItemAsync(key),
};

export const StorageKeys = {
  accessToken: 'mape.accessToken',
  refreshToken: 'mape.refreshToken',
  user: 'mape.user',
} as const;
