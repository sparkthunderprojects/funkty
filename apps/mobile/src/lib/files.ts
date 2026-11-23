import { File } from 'expo-file-system';

export type FileData = { data: ArrayBuffer; size: number; type: string };

/**
 * Reads a local file (the file:// uri the picker or image editor gives us) as raw bytes.
 * On a phone, `fetch(uri).blob()` produces a body that the storage API rejects with a 400, so
 * uploads send an ArrayBuffer instead.
 */
export async function readFile(uri: string): Promise<FileData> {
  const file = new File(uri);
  if (!file.exists) throw new Error('File not found');
  const data = await file.arrayBuffer();
  return { data, size: data.byteLength, type: '' };
}
