import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getSavedDirectoryUri } from './permissions';

const { StorageAccessFramework } = FileSystem;

export interface SRTFileInfo {
  uri: string;
  name: string;
  size: number;
  modificationTime: number;
}

/**
 * Extract a human-readable filename from a SAF URI.
 * SAF URIs are URL-encoded; this decodes them and returns the last path segment.
 */
function getNameFromSafUri(uri: string): string {
  const decoded = decodeURIComponent(uri);
  // SAF URIs look like:
  // content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload%2Ffile.srt
  // After decoding: .../primary:Download/file.srt
  const lastSlash = decoded.lastIndexOf('/');
  const lastColon = decoded.lastIndexOf(':');
  const lastSep = Math.max(lastSlash, lastColon);
  return lastSep >= 0 ? decoded.substring(lastSep + 1) : decoded;
}

/**
 * Check if a filename is a subtitle file.
 */
function isSubtitleFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.srt') || lower.endsWith('.ass') || lower.endsWith('.vtt');
}

/**
 * Recursively scan a SAF directory for subtitle files.
 *
 * FileSystem.getInfoAsync() does not reliably report isDirectory for SAF URIs.
 * Instead we try readDirectoryAsync on each entry: if it succeeds → directory,
 * if it throws → file.
 */
async function scanSafDirectory(
  directoryUri: string,
  maxDepth: number = 5,
  currentDepth: number = 0
): Promise<SRTFileInfo[]> {
  if (currentDepth >= maxDepth) return [];

  const files: SRTFileInfo[] = [];

  try {
    const entries = await StorageAccessFramework.readDirectoryAsync(directoryUri);

    for (const entryUri of entries) {
      // Try treating it as a directory first
      let isDir = false;
      try {
        await StorageAccessFramework.readDirectoryAsync(entryUri);
        isDir = true;
      } catch {
        // Not a directory
      }

      if (isDir) {
        const subFiles = await scanSafDirectory(entryUri, maxDepth, currentDepth + 1);
        files.push(...subFiles);
      } else {
        const name = getNameFromSafUri(entryUri);
        if (isSubtitleFile(name)) {
          let size = 0;
          let modTime = 0;
          try {
            const info = await FileSystem.getInfoAsync(entryUri);
            if (info.exists) {
              size = info.size || 0;
              modTime = info.modificationTime || 0;
            }
          } catch {
            // Use defaults
          }
          files.push({ uri: entryUri, name, size, modificationTime: modTime });
        }
      }
    }
  } catch (err) {
    console.log(`Cannot scan SAF directory: ${directoryUri}`, err);
  }

  return files;
}

/**
 * Recursively scans a regular file:// directory for subtitle files.
 * Used for scanning the app's own document/cache directories.
 */
async function scanLocalDirectory(
  directoryUri: string,
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<SRTFileInfo[]> {
  if (currentDepth >= maxDepth) return [];

  const files: SRTFileInfo[] = [];

  try {
    const items = await FileSystem.readDirectoryAsync(directoryUri);

    for (const item of items) {
      const itemUri = `${directoryUri}${directoryUri.endsWith('/') ? '' : '/'}${item}`;

      try {
        const info = await FileSystem.getInfoAsync(itemUri);

        if (info.exists) {
          if (info.isDirectory) {
            const subFiles = await scanLocalDirectory(
              itemUri,
              maxDepth,
              currentDepth + 1
            );
            files.push(...subFiles);
          } else if (isSubtitleFile(item)) {
            files.push({
              uri: itemUri,
              name: item,
              size: info.size || 0,
              modificationTime: info.modificationTime || 0,
            });
          }
        }
      } catch {
        // Skip files we can't access
      }
    }
  } catch {
    // Skip directories we can't access
  }

  return files;
}

/**
 * Scans for subtitle files from:
 * 1. The SAF-granted user directory (if granted)
 * 2. The app's own document directory (always accessible)
 */
export async function scanForSRTFiles(): Promise<SRTFileInfo[]> {
  const allFiles: SRTFileInfo[] = [];

  try {
    // 1. Scan app's own document directory (always works)
    const documentDirectory = FileSystem.documentDirectory;
    if (documentDirectory) {
      const docFiles = await scanLocalDirectory(documentDirectory, 2);
      allFiles.push(...docFiles);
    }

    // 2. On Android, scan the SAF-granted directory
    if (Platform.OS === 'android') {
      const safUri = await getSavedDirectoryUri();
      if (safUri) {
        const safFiles = await scanSafDirectory(safUri);
        allFiles.push(...safFiles);
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
