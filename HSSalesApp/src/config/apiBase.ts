import { Platform } from 'react-native';

export function getJsonServerBaseUrl() {
  return Platform.select({
    ios: 'http://localhost:3001',
    android: 'http://10.0.2.2:3001',
    default: 'http://localhost:3001',
  })!;
}
