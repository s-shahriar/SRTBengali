import * as FileSystem from 'expo-file-system/legacy';

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
 * Keeps file creation in the same folder as the original file.
 */
function getParentDirectoryUri(docUri: string): string | null {
  const docIdx = docUri.indexOf('/document/');
  if (docIdx < 0) return null;

  const treeRootUri = docUri.substring(0, docIdx);
  const docIdEncoded = docUri.substring(docIdx + '/document/'.length);
  const docId = decodeURIComponent(docIdEncoded);
  const lastSlash = docId.lastIndexOf('/');

  // File is directly under selected root folder
  if (lastSlash < 0) {
    return treeRootUri;
  }

  const parentDocId = docId.substring(0, lastSlash);
  return `${treeRootUri}/document/${encodeURIComponent(parentDocId)}`;
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
      const parentUri = getParentDirectoryUri(oldUri);
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
        getMimeTypeForSubtitle(newName)
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
