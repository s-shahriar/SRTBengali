import * as FileSystem from 'expo-file-system/legacy';

const { StorageAccessFramework } = FileSystem;

function isSafUri(uri: string): boolean {
  return uri.startsWith('content://');
}

/**
 * Extract the parent tree URI from a SAF document URI.
 * SAF doc URIs look like:
 *   content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload%2Ffile.srt
 * The tree portion (before /document/) is what we need for createFileAsync.
 */
function getParentTreeUri(docUri: string): string | null {
  const treeIdx = docUri.indexOf('/tree/');
  const docIdx = docUri.indexOf('/document/');
  if (treeIdx < 0 || docIdx < 0) return null;
  return docUri.substring(0, docIdx);
}

/**
 * Renames a file. For SAF URIs: copy content to new file, delete old.
 */
export async function renameFile(
  oldUri: string,
  newName: string
): Promise<string> {
  try {
    if (isSafUri(oldUri)) {
      const parentUri = getParentTreeUri(oldUri);
      if (!parentUri) {
        throw new Error('Cannot determine parent directory from SAF URI');
      }

      // Read old file content
      const content = await StorageAccessFramework.readAsStringAsync(oldUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Create new file with new name
      const newUri = await StorageAccessFramework.createFileAsync(
        parentUri,
        newName,
        'text/plain'
      );

      // Write content to new file
      await StorageAccessFramework.writeAsStringAsync(newUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Delete old file
      await FileSystem.deleteAsync(oldUri, { idempotent: true });

      return newUri;
    }

    // Regular file:// URI
    const lastSlash = oldUri.lastIndexOf('/');
    const directory = oldUri.substring(0, lastSlash);
    const newUri = `${directory}/${newName}`;

    const existingFile = await FileSystem.getInfoAsync(newUri);
    if (existingFile.exists) {
      throw new Error('A file with this name already exists');
    }

    await FileSystem.moveAsync({ from: oldUri, to: newUri });
    return newUri;
  } catch (error: any) {
    throw new Error(`Failed to rename file: ${error.message}`);
  }
}

/**
 * Deletes a file. Works with both SAF and regular URIs.
 */
export async function deleteFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error: any) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Gets file info
 */
export async function getFileInfo(uri: string) {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info;
  } catch (error: any) {
    throw new Error(`Failed to get file info: ${error.message}`);
  }
}
