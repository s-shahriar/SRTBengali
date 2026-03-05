import { Platform, PermissionsAndroid, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Request storage permissions for Android
 */
export async function requestStoragePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true; // iOS doesn't need explicit storage permissions for app directories
  }

  try {
    // For Android 10 (API 29) and below
    if (Platform.Version < 30) {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);

      return (
        granted['android.permission.READ_EXTERNAL_STORAGE'] === 'granted' &&
        granted['android.permission.WRITE_EXTERNAL_STORAGE'] === 'granted'
      );
    }

    // For Android 11+ (API 30+), we use SAF (Storage Access Framework)
    // which is handled by expo-file-system's StorageAccessFramework
    // No explicit permissions needed as SAF handles it
    return true;
  } catch (err) {
    console.warn('Permission request failed:', err);
    Alert.alert(
      'Permission Error',
      'Unable to request storage permissions. Please enable them in settings.'
    );
    return false;
  }
}

/**
 * Check if we have storage permissions
 */
export async function hasStoragePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  if (Platform.Version < 30) {
    const readPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
    );
    const writePermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    );
    return readPermission && writePermission;
  }

  // Android 11+ uses SAF
  return true;
}
