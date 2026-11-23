export type FileData = { data: ArrayBuffer; size: number; type: string };

/** Browsers hand us blob: or data: urls, which fetch reads directly. */
export async function readFile(uri: string): Promise<FileData> {
  const blob = await (await fetch(uri)).blob();
  return { data: await blob.arrayBuffer(), size: blob.size, type: blob.type };
}
