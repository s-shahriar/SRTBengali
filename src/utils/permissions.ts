import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { StorageAccessFramework } = FileSystem;
const SAF_DIR_URI_KEY = 'saf_directory_uri';

/**
 * Request directory access via SAF (Storage Access Framework).
 * On modern Android (11+), this is the only way to access user files.
 * Returns the granted directory URI, or null if denied.
 */
export async function requestDirectoryAccess(
  initialUri?: string
): Promise<string | null> {
  if (Platform.OS !== 'android') {
    return FileSystem.documentDirectory;
  }

  try {
    const permissions =
      await StorageAccessFramework.requestDirectoryPermissionsAsync(
        initialUri ?? null
      );

    if (permissions.granted) {
      const uri = permissions.directoryUri;
      // Persist the granted URI so we can reuse it across app restarts
      await AsyncStorage.setItem(SAF_DIR_URI_KEY, uri);
      return uri;
    }

    return null;
  } catch (err) {
    console.warn('SAF permission request failed:', err);
    return null;
  }
}

/**
 * Get the previously granted SAF directory URI, if any.
 */
export async function getSavedDirectoryUri(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    return FileSystem.documentDirectory;
  }

  try {
    return await AsyncStorage.getItem(SAF_DIR_URI_KEY);
  } catch {
    return null;
  }
}

