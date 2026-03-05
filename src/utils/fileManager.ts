import * as FileSystem from 'expo-file-system/legacy';

/**
 * Renames a file
 */
export async function renameFile(
  oldUri: string,
  newName: string
): Promise<string> {
  try {
    // Extract directory from old URI
    const lastSlash = oldUri.lastIndexOf('/');
    const directory = oldUri.substring(0, lastSlash);
    const newUri = `${directory}/${newName}`;

    // Check if file with new name already exists
    const existingFile = await FileSystem.getInfoAsync(newUri);
    if (existingFile.exists) {
      throw new Error('A file with this name already exists');
    }

    // Rename (move) the file
    await FileSystem.moveAsync({
      from: oldUri,
      to: newUri,
    });

    return newUri;
  } catch (error: any) {
    throw new Error(`Failed to rename file: ${error.message}`);
  }
}

/**
 * Deletes a file
 */
export async function deleteFile(uri: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

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
