/** Beeswarm geometry for the enforcement-gates figure.
 *  Shared by the page (server viewBox) and the client script so the
 *  reserved box and the drawn chart use one layout. */

export type PlotPoint = { s: number; y: number; x: number; py: number };

const EPS = 1e-4;

export function logit(p: number): number {
  const q = Math.min(1 - EPS, Math.max(EPS, p));
  return Math.log(q / (1 - q));
}

export type PlotGeometry = {
  pts: PlotPoint[];
  n: number;
  W: number;
  H: number;
  padL: number;
  padR: number;
  base: number;
  axis: number;
  r: number;
  rh: number;
};

export function plotGeometry(raw: ReadonlyArray<readonly [number, number]>, width: number): PlotGeometry {
  const W = Math.round(width);
  const pts: PlotPoint[] = raw.map(([s, y]) => ({ s, y, x: 0, py: 0 }));
  const n = pts.length;
  const padL = 10;
  const padR = 10;
  const axis = 30;
  if (n === 0 || W < 10) {
    return { pts, n, W, H: 180, padL, padR, base: 40, axis, r: 1.45, rh: 1.13 };
  }
  const lmin = logit(pts[0].s) - 0.4;
  const lmax = logit(pts[n - 1].s) + 0.4;
  const r = Math.min(2.4, Math.max(1.45, W / 430));
  const rh = r * 0.78;
  const xOf = (l: number) => padL + ((l - lmin) / (lmax - lmin)) * (W - padL - padR);
  for (const p of pts) p.x = xOf(logit(p.s));

  const place = (side: PlotPoint[], step: number) => {
    const placed: PlotPoint[] = [];
    let maxH = 0;
    for (const p of side) {
      let k = 0;
      for (;;) {
        const yy = k * step;
        let hit = false;
        for (let j = placed.length - 1; j >= 0; j--) {
          const q = placed[j];
          const dx = p.x - q.x;
          if (dx > step) break;
          const dy = yy - q.py;
          if (dx * dx + dy * dy < step * step) {
            hit = true;
            break;
          }
        }
        if (!hit) {
          p.py = yy;
          break;
        }
        k += 1;
      }
      placed.push(p);
      maxH = Math.max(maxH, p.py);
    }
    return maxH;
  };

  const upH = place(pts.filter((p) => p.y === 1), r * 2 + 0.7);
  const downH = place(pts.filter((p) => p.y === 0), rh * 2 + 0.55);
  const top = 14;
  const base = top + upH + r + 6;
  const H = Math.ceil(base + 6 + downH + rh + axis);
  return { pts, n, W, H, padL, padR, base, axis, r, rh };
}

export function lineX(g: PlotGeometry, idx: number): number {
  const { pts, n, W, padL, padR } = g;
  if (idx <= 0) return padL - 6;
  if (idx >= n) return W - padR + 6;
  return (pts[idx - 1].x + pts[idx].x) / 2;
}

/** Keep a centered band label inside its band, then inside the plot. */
export function clampLabelCenter(
  ideal: number,
  bandLeft: number,
  bandRight: number,
  labelWidth: number,
  plotWidth: number,
): number {
  const half = Math.max(0, labelWidth) / 2;
  const plotMin = half;
  const plotMax = Math.max(half, plotWidth - half);
  let center = ideal;
  const bandMin = bandLeft + half;
  const bandMax = bandRight - half;
  if (bandMax >= bandMin) center = Math.min(Math.max(ideal, bandMin), bandMax);
  return Math.min(Math.max(center, plotMin), plotMax);
}
