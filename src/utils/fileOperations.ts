import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  getSavedDirectoryUri,
  requestDirectoryAccess,
} from './permissions';

const { StorageAccessFramework } = FileSystem;

/**
 * Reads a file from URI (cross-platform: web + native)
 */
export async function readFile(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // On web, expo-document-picker returns a blob:// URL — fetch works fine
    const resp = await fetch(uri);
    return resp.text();
  }
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

/**
 * Save a file using SAF on Android, share dialog as fallback.
 *
 * Flow:
 * 1. If we have a saved SAF directory → create file there via SAF
 * 2. If no SAF dir → ask user to pick one via SAF directory picker
 * 3. If user denies picker → save to app dir + offer share dialog
 */
export async function saveFile(
  filename: string,
  content: string,
  _sourceUri?: string
): Promise<void> {
  if (Platform.OS === 'web') {
    // Trigger a browser download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  try {
    // Try SAF-based save
    let dirUri = await getSavedDirectoryUri();

    if (!dirUri) {
      // No saved directory — ask user to grant access
      dirUri = await requestDirectoryAccess();
    }

    if (dirUri) {
      // We have SAF directory access — create file and write
      const fileUri = await StorageAccessFramework.createFileAsync(
        dirUri,
        filename,
        'text/plain'
      );
      await StorageAccessFramework.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      Alert.alert('Success', `File saved:\n${filename}`);
      return;
    }

    // SAF denied — fall back to app directory + share
    await saveToAppDirAndShare(filename, content);
  } catch (error: any) {
    console.error('SAF save error:', error);
    // If SAF write failed (e.g. stale permission), fall back
    try {
      await saveToAppDirAndShare(filename, content);
    } catch (fallbackError: any) {
      Alert.alert('Save Failed', fallbackError.message);
    }
  }
}

/**
 * Fallback: save to app's document directory and offer share dialog.
 */
async function saveToAppDirAndShare(
  filename: string,
  content: string
): Promise<void> {
  const documentsDir = FileSystem.documentDirectory;
  if (!documentsDir) {
    throw new Error('Document directory not available');
  }

  const outputUri = `${documentsDir}${filename}`;
  await FileSystem.writeAsStringAsync(outputUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  Alert.alert(
    'File Saved',
    `File saved to app storage. Use "Share" to move it to another location.`,
    [
      { text: 'OK', style: 'cancel' },
      {
        text: 'Share',
        onPress: async () => {
          await Sharing.shareAsync(outputUri, {
            mimeType: 'text/plain',
            dialogTitle: `Save ${filename}`,
            UTI: 'public.plain-text',
          });
        },
      },
    ]
  );
}
