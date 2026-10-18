// One fetch per /data/kinetic/<id>.json, shared by KineticPlate and
// KineticPlate3D. Module scope: both components import this file, so the
// page loads each frame once even when the hologram and the point cloud
// ask for the same id.

export type KineticFrame = {
  cols: number;
  rows: number;
  grid: number[];
  depth?: number[];
  depthFade?: number;
  alt?: string;
};

const cache = new Map<string, Promise<KineticFrame>>();

export function fetchKineticJson(src: string): Promise<KineticFrame> {
  const cached = cache.get(src);
  if (cached) return cached;
  const pending = fetch(src, { priority: 'low' } as RequestInit)
    .then((res) => res.json() as Promise<KineticFrame>)
    .catch((err: unknown) => {
      cache.delete(src);
      throw err;
    });
  cache.set(src, pending);
  return pending;
}
