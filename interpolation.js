// ===== グリッド生成（共通） =====
export function buildGridCoords(gridSize = 15) {
  const coords = [];
  for (let k = 0; k < gridSize; k++) {
    const z = 1 + (k / (gridSize - 1)) * 2;
    for (let j = 0; j < gridSize; j++) {
      const y = 1 + (j / (gridSize - 1)) * 2;
      for (let i = 0; i < gridSize; i++) {
        const x = 1 + (i / (gridSize - 1)) * 2;
        coords.push({ x, y, z });
      }
    }
  }
  return coords;
}

// ===== IDW 補間（共通） =====
export function idwInterpolate(px, py, pz, sensors, valueKey, power = 2) {
  let num = 0, den = 0;

  for (const s of sensors) {
    const dx = px - s.x;
    const dy = py - s.y;
    const dz = pz - s.z;

    const d2 = dx*dx + dy*dy + dz*dz;
    if (d2 === 0) return s[valueKey];

    const w = 1 / Math.pow(d2, power / 2);
    num += w * s[valueKey];
    den += w;
  }

  return num / den;
}

// ===== Gaussian RBF 補間（共通） =====
export function gaussInterpolate(px, py, pz, sensors, valueKey, sigma = 0.7) {
  let num = 0, den = 0;
  const c = 2 * sigma * sigma;

  for (const s of sensors) {
    const dx = px - s.x;
    const dy = py - s.y;
    const dz = pz - s.z;

    const d2 = dx*dx + dy*dy + dz*dz;
    const w = Math.exp(-d2 / c);

    num += w * s[valueKey];
    den += w;
  }

  return num / den;
}
