import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { requestStoragePermissions } from './permissions';

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
 * Extracts the directory path from a file URI
 */
function getDirectoryFromUri(uri: string): string {
  const lastSlash = uri.lastIndexOf('/');
  return lastSlash >= 0 ? uri.substring(0, lastSlash) : '';
}

/**
 * Saves a file to the same directory as the source file
 * Falls back to share dialog if direct save fails
 */
export async function saveFile(
  filename: string,
  content: string,
  sourceUri?: string
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

  // Request permissions first
  const hasPermission = await requestStoragePermissions();
  if (!hasPermission) {
    Alert.alert(
      'Permission Denied',
      'Storage permission is required to save files. Using share dialog instead.'
    );
    // Fall back to share dialog
    await saveViaShareDialog(filename, content);
    return;
  }

  try {
    // Try to save to the source directory
    if (sourceUri) {
      const sourceDir = getDirectoryFromUri(sourceUri);
      if (sourceDir) {
        const outputUri = `${sourceDir}/${filename}`;

        try {
          // Attempt to write to the same directory
          await FileSystem.writeAsStringAsync(outputUri, content, {
            encoding: FileSystem.EncodingType.UTF8,
          });

          Alert.alert(
            'Success',
            `File saved successfully:\n${filename}`,
            [{ text: 'OK' }]
          );
          return;
        } catch (writeError: any) {
          // If direct write fails (common on Android 10+), use SAF
          console.log('Direct write failed, trying alternative method:', writeError.message);
        }
      }
    }

    // Fallback: Save to app's document directory and offer share
    const documentsDir = FileSystem.documentDirectory;
    if (!documentsDir) {
      throw new Error('Document directory not available');
    }

    const outputUri = `${documentsDir}${filename}`;
    await FileSystem.writeAsStringAsync(outputUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Show success and ask user if they want to move/share the file
    Alert.alert(
      'File Saved',
      `File saved to app directory. Would you like to move it to the source folder?`,
      [
        {
          text: 'Keep Here',
          style: 'cancel',
          onPress: () => {
            Alert.alert('Saved', `File saved at:\n${documentsDir}${filename}`);
          },
        },
        {
          text: 'Move to Source',
          onPress: async () => {
            await Sharing.shareAsync(outputUri, {
              mimeType: 'text/plain',
              dialogTitle: `Save ${filename} to source folder`,
              UTI: 'public.plain-text',
            });
          },
        },
      ]
    );
  } catch (error: any) {
    console.error('Save error:', error);
    Alert.alert(
      'Save Failed',
      `Could not save file: ${error.message}. Using share dialog instead.`
    );
    await saveViaShareDialog(filename, content);
  }
}

/**
 * Helper function to save file via share dialog
 */
async function saveViaShareDialog(filename: string, content: string): Promise<void> {
  const outputUri = (FileSystem.cacheDirectory ?? '') + filename;
  await FileSystem.writeAsStringAsync(outputUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(outputUri, {
    mimeType: 'text/plain',
    dialogTitle: `Save ${filename}`,
    UTI: 'public.plain-text',
  });
}
