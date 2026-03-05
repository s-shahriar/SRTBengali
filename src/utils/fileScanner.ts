import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export interface SRTFileInfo {
  uri: string;
  name: string;
  size: number;
  modificationTime: number;
}

/**
 * Recursively scans a directory for SRT files
 */
async function scanDirectory(
  directoryUri: string,
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<SRTFileInfo[]> {
  if (currentDepth >= maxDepth) return [];

  const files: SRTFileInfo[] = [];

  try {
    const items = await FileSystem.readDirectoryAsync(directoryUri);

    for (const item of items) {
      const itemUri = `${directoryUri}/${item}`;

      try {
        const info = await FileSystem.getInfoAsync(itemUri);

        if (info.exists) {
          if (info.isDirectory) {
            // Recursively scan subdirectories
            const subFiles = await scanDirectory(
              itemUri,
              maxDepth,
              currentDepth + 1
            );
            files.push(...subFiles);
          } else {
            // Check if it's an SRT file
            const isSRTFile =
              item.toLowerCase().endsWith('.srt') ||
              item.toLowerCase().endsWith('.ass') ||
              item.toLowerCase().endsWith('.vtt');

            if (isSRTFile) {
              files.push({
                uri: itemUri,
                name: item,
                size: info.size || 0,
                modificationTime: info.modificationTime || 0,
              });
            }
          }
        }
      } catch (itemError) {
        // Skip files we can't access
        console.log(`Cannot access: ${itemUri}`);
      }
    }
  } catch (dirError) {
    // Skip directories we can't access
    console.log(`Cannot scan directory: ${directoryUri}`);
  }

  return files;
}

/**
 * Scans the device for SRT files
 * Returns files from app's document directory and common subtitle locations
 */
export async function scanForSRTFiles(): Promise<SRTFileInfo[]> {
  const allFiles: SRTFileInfo[] = [];

  try {
    // Always scan app's document directory
    const documentDirectory = FileSystem.documentDirectory;
    if (documentDirectory) {
      const docFiles = await scanDirectory(documentDirectory, 2);
      allFiles.push(...docFiles);
    }

    // On Android, try to scan common directories
    if (Platform.OS === 'android') {
      const commonPaths = [
        FileSystem.cacheDirectory,
        // Note: On Android 10+, we may not have access to external storage
        // without proper SAF permissions
      ];

      for (const path of commonPaths) {
        if (path) {
          try {
            const files = await scanDirectory(path, 2);
            allFiles.push(...files);
          } catch (error) {
            console.log(`Cannot scan ${path}`);
          }
        }
      }
    }

    // Remove duplicates based on URI
    const uniqueFiles = Array.from(
      new Map(allFiles.map(file => [file.uri, file])).values()
    );

    // Sort by modification time (newest first)
    uniqueFiles.sort((a, b) => b.modificationTime - a.modificationTime);

    return uniqueFiles;
  } catch (error) {
    console.error('Error scanning for SRT files:', error);
    return [];
  }
}

/**
 * Formats file size to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Formats timestamp to readable date
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
