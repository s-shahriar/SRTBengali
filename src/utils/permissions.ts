import { Platform, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { StorageAccessFramework } = FileSystem;
const SAF_DIR_URI_KEY = 'saf_directory_uri';

// ── Storage Permission Handler (first-boot prompt) ──────────

export class PermissionHandler {
  private static instance: PermissionHandler;
  private storagePermissionGranted: boolean = false;

  static getInstance(): PermissionHandler {
    if (!PermissionHandler.instance) {
      PermissionHandler.instance = new PermissionHandler();
    }
    return PermissionHandler.instance;
  }

  async requestStoragePermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status === 'granted') {
        this.storagePermissionGranted = true;
        return true;
      } else if (status === 'denied') {
        return false;
      }
    }

    return true;
  }

  async checkStoragePermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const { status } = await MediaLibrary.getPermissionsAsync();
    return status === 'granted';
  }

  async ensureStoragePermission(): Promise<boolean> {
    const hasPermission = await this.checkStoragePermission();
    if (!hasPermission) {
      return await this.requestStoragePermission();
    }
    this.storagePermissionGranted = true;
    return true;
  }

  isStoragePermissionGranted(): boolean {
    return this.storagePermissionGranted;
  }
}

export const permissionHandler = PermissionHandler.getInstance();

// ── SAF Directory Access ────────────────────────────────────

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
