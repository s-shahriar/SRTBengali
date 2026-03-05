import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getSavedDirectoryUri, clearSavedDirectoryUri } from './permissions';

const { StorageAccessFramework } = FileSystem;

export interface SRTFileInfo {
  uri: string;
  name: string;
  size: number;
  modificationTime: number;
}

/**
 * Extract a human-readable filename from a SAF URI.
 */
function getNameFromSafUri(uri: string): string {
  const decoded = decodeURIComponent(uri);
  const lastSlash = decoded.lastIndexOf('/');
  const lastColon = decoded.lastIndexOf(':');
  const lastSep = Math.max(lastSlash, lastColon);
  return lastSep >= 0 ? decoded.substring(lastSep + 1) : decoded;
}

function isSubtitleFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.srt') || lower.endsWith('.ass') || lower.endsWith('.vtt');
}

/**
 * Heuristic: entries with a dot-extension are files, not directories.
 * Directories almost never contain dots in SAF URIs.
 */
function looksLikeFile(name: string): boolean {
  // If the name has a dot after position 0, it's likely a file
  const dot = name.lastIndexOf('.');
  return dot > 0;
}

/**
 * Recursively scan a SAF directory for subtitle files.
 *
 * Accepts pre-fetched entries to avoid redundant readDirectoryAsync calls.
 * Uses a heuristic: entries with a dot-extension are files, extensionless
 * entries are probed as possible directories.
 * All I/O runs in parallel for maximum speed.
 */
async function scanSafEntries(
  entries: string[],
  maxDepth: number,
  currentDepth: number
): Promise<SRTFileInfo[]> {
  const subtitleUris: string[] = [];
  const maybeDirUris: string[] = [];

  for (const uri of entries) {
    const name = getNameFromSafUri(uri);
    if (isSubtitleFile(name)) {
      subtitleUris.push(uri);
    } else if (!looksLikeFile(name)) {
      maybeDirUris.push(uri);
    }
    // Files with non-subtitle extensions are skipped entirely
  }

  // Run subtitle info fetching and directory probing in parallel
  const [subtitleFiles, dirFiles] = await Promise.all([
    // Subtitle files — just collect name/uri, skip slow getInfoAsync
    Promise.resolve(
      subtitleUris.map(uri => ({
        uri,
        name: getNameFromSafUri(uri),
        size: 0,
        modificationTime: 0,
      }))
    ),

    // Probe possible directories and recurse (all in parallel)
    currentDepth < maxDepth
      ? Promise.all(
          maybeDirUris.map(async (dirUri): Promise<SRTFileInfo[]> => {
            try {
              // If readDir succeeds → it's a directory, and we get entries for free
              const subEntries =
                await StorageAccessFramework.readDirectoryAsync(dirUri);
              return scanSafEntries(subEntries, maxDepth, currentDepth + 1);
            } catch {
              return [];
            }
          })
        )
      : Promise.resolve([]),
  ]);

  const results = [...subtitleFiles];
  if (Array.isArray(dirFiles)) {
    for (const batch of dirFiles) {
      results.push(...batch);
    }
  }
  return results;
}

/**
 * Entry point for SAF scanning. Reads the root directory and delegates.
 */
async function scanSafDirectory(directoryUri: string): Promise<SRTFileInfo[]> {
  try {
    const entries =
      await StorageAccessFramework.readDirectoryAsync(directoryUri);
    return scanSafEntries(entries, 5, 0);
  } catch (err) {
    console.log(`Cannot scan SAF directory: ${directoryUri}`, err);
    return [];
  }
}

/**
 * Scans a regular file:// directory (app's own storage).
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
            const subFiles = await scanLocalDirectory(itemUri, maxDepth, currentDepth + 1);
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
        // Skip
      }
    }
  } catch {
    // Skip
  }

  return files;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Main scan function. Scans SAF directory + app directory in parallel.
 */
export async function scanForSRTFiles(): Promise<SRTFileInfo[]> {
  try {
    // Launch both scans in parallel
    const localPromise = FileSystem.documentDirectory
      ? scanLocalDirectory(FileSystem.documentDirectory, 2)
      : Promise.resolve([]);

    let safPromise: Promise<SRTFileInfo[]> = Promise.resolve([]);
    if (Platform.OS === 'android') {
      const safUri = await getSavedDirectoryUri();
      if (safUri) {
        safPromise = withTimeout(scanSafDirectory(safUri), 15000).then(
          async (result) => {
            if (result === null) {
              console.log('SAF scan timed out — clearing stale URI');
              await clearSavedDirectoryUri();
              return [];
            }
            return result;
          }
        );
      }
    }

    const [localFiles, safFiles] = await Promise.all([localPromise, safPromise]);
    const allFiles = [...localFiles, ...safFiles];

    // Deduplicate by URI
    const uniqueFiles = Array.from(
      new Map(allFiles.map(file => [file.uri, file])).values()
    );

    // Sort by name (since we skip modificationTime for speed)
    uniqueFiles.sort((a, b) => a.name.localeCompare(b.name));

    return uniqueFiles;
  } catch (error) {
    console.error('Error scanning for SRT files:', error);
    return [];
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatDate(timestamp: number): string {
  if (timestamp === 0) return '';
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
