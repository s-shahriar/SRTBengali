import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  getSavedDirectoryUri,
  requestDirectoryAccess,
} from './permissions';

const { StorageAccessFramework } = FileSystem;

function getMimeTypeForSubtitle(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'srt') return 'application/x-subrip';
  if (ext === 'ass' || ext === 'ssa') return 'text/x-ssa';
  if (ext === 'vtt') return 'text/vtt';
  return 'text/plain';
}

function isSafUri(uri: string): boolean {
  return uri.startsWith('content://');
}

/**
 * Extract parent directory URI from a SAF document URI.
 * Keeps file creation in the same folder as the source file.
 */
function getParentDirectoryUri(docUri: string): string | null {
  const docIdx = docUri.indexOf('/document/');
  if (docIdx < 0) return null;

  const treeRootUri = docUri.substring(0, docIdx);
  const docIdEncoded = docUri.substring(docIdx + '/document/'.length);
  const docId = decodeURIComponent(docIdEncoded);
  const lastSlash = docId.lastIndexOf('/');

  if (lastSlash < 0) {
    return treeRootUri;
  }

  const parentDocId = docId.substring(0, lastSlash);
  return `${treeRootUri}/document/${encodeURIComponent(parentDocId)}`;
}

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

async function saveToSafDirectory(
  directoryUri: string,
  filename: string,
  content: string
): Promise<void> {
  const fileUri = await StorageAccessFramework.createFileAsync(
    directoryUri,
    filename,
    getMimeTypeForSubtitle(filename)
  );
  await StorageAccessFramework.writeAsStringAsync(fileUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

/**
 * Save a file using source location when possible.
 *
 * Flow:
 * 1. If source is SAF URI -> save in source file's parent folder
 * 2. Else if source is file:// URI -> save in same local folder
 * 3. Else use saved SAF directory / prompt for one
 * 4. If everything fails -> save in app dir + share
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

  try {
    if (sourceUri && isSafUri(sourceUri)) {
      const sourceParentUri = getParentDirectoryUri(sourceUri);
      if (sourceParentUri) {
        await saveToSafDirectory(sourceParentUri, filename, content);
        Alert.alert('Success', `File saved:\n${filename}`);
        return;
      }
    }

    if (sourceUri && sourceUri.startsWith('file://')) {
      const lastSlash = sourceUri.lastIndexOf('/');
      if (lastSlash > 0) {
        const directoryUri = sourceUri.substring(0, lastSlash + 1);
        const outputUri = `${directoryUri}${filename}`;
        await FileSystem.writeAsStringAsync(outputUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        Alert.alert('Success', `File saved:\n${filename}`);
        return;
      }
    }

    // Fallback to previously granted SAF root
    let dirUri = await getSavedDirectoryUri();
    if (!dirUri) {
      dirUri = await requestDirectoryAccess();
    }

    if (dirUri) {
      await saveToSafDirectory(dirUri, filename, content);
      Alert.alert('Success', `File saved:\n${filename}`);
      return;
    }

    // SAF denied — fall back to app directory + share
    await saveToAppDirAndShare(filename, content);
  } catch (error: any) {
    console.error('SAF save error:', error);
    // If write failed (e.g. stale permission), fall back
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
