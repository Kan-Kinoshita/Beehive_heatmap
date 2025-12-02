// ===== Firebase SDK =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ===== Firebase Config =====
const firebaseConfig = {
  apiKey: "AIzaSyBaEPr5uJFKlTsEAK2AxByxJ6IKSkfmDJ8",
  authDomain: "beehiveheatmap.firebaseapp.com",
  databaseURL: "https://beehiveheatmap-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "beehiveheatmap",
  storageBucket: "beehiveheatmap.firebasestorage.app",
  messagingSenderId: "240823308650",
  appId: "1:240823308650:web:c3a052cb93d70009295513"
};

// ===== Firebase Init =====
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const sensorsRef = ref(db, "sensors");
console.log("Firebase initialized (Humidity Map)");

// ===== Parameters =====
const GRID_SIZE = 15;
const POWER_P  = 2;       // IDW exponent
const SIGMA = 0.7;        // Gaussian RBF sigma

let currentMode = "idw";  // "idw" or "gauss"
let latestSensors = [];   // humidity sensor list

// ===== Buttons =====
document.getElementById("btnIDW").addEventListener("click", () => {
  currentMode = "idw";
  redraw();
});

document.getElementById("btnGAUSS").addEventListener("click", () => {
  currentMode = "gauss";
  redraw();
});

// ===== Grid coordinates =====
function buildGrid() {
  const coords = [];
  for (let k = 0; k < GRID_SIZE; k++) {
    const z = 1 + (k / (GRID_SIZE - 1)) * 2;
    for (let j = 0; j < GRID_SIZE; j++) {
      const y = 1 + (j / (GRID_SIZE - 1)) * 2;
      for (let i = 0; i < GRID_SIZE; i++) {
        const x = 1 + (i / (GRID_SIZE - 1)) * 2;
        coords.push({ x, y, z });
      }
    }
  }
  return coords;
}

// ===== IDW interpolation =====
function idw(px, py, pz, sensors) {
  let num = 0, den = 0;

  for (const s of sensors) {
    const dx = px - s.x, dy = py - s.y, dz = pz - s.z;
    const d2 = dx*dx + dy*dy + dz*dz;
    if (d2 === 0) return s.humidity;

    const w = 1 / Math.pow(d2, POWER_P / 2);
    num += w * s.humidity;
    den += w;
  }
  return num / den;
}

// ===== Gaussian interpolation =====
function gauss(px, py, pz, sensors) {
  let num = 0, den = 0;
  const c = 2 * SIGMA * SIGMA;

  for (const s of sensors) {
    const dx = px - s.x, dy = py - s.y, dz = pz - s.z;
    const d2 = dx*dx + dy*dy + dz*dz;
    const w = Math.exp(-d2 / c);

    num += w * s.humidity;
    den += w;
  }
  return num / den;
}

// ===== Fetch humidity from Firebase =====
onValue(sensorsRef, (snap) => {
  const data = snap.val();
  const list = [];

  for (let z = 1; z <= 3; z++) {
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {

        const node = data?.[`z${z}`]?.[`y${y}`]?.[`x${x}`];
        if (!node || node.humidity === undefined) continue;

        list.push({
          x, y, z,
          humidity: parseFloat(node.humidity)
        });
      }
    }
  }

  latestSensors = list;
  redraw();
});

// ===== Draw =====
function redraw() {
  if (latestSensors.length === 0) return;

  const xs=[], ys=[], zs=[], vals=[];
  const coords = buildGrid();

  for (const p of coords) {
    const v = (currentMode === "idw")
      ? idw(p.x, p.y, p.z, latestSensors)
      : gauss(p.x, p.y, p.z, latestSensors);

    if (!Number.isNaN(v)) {
      xs.push(p.x);
      ys.push(p.y);
      zs.push(p.z);
      vals.push(v);
    }
  }

  const dataPlot = [{
    type: "volume",
    x: xs, y: ys, z: zs,
    value: vals,
    opacity: 0.24,
    surface: { count: 20 },

    // 湿度向けカラースケール（高湿度 = 赤, 低湿度 = 青）
    colorscale: [
      [0.0, "#0000ff"],   // blue (low humidity)
      [0.33, "#00ff00"],  // green
      [0.66, "#ffff00"],  // yellow
      [1.0, "#ff0000"]    // red (high humidity)
    ]
  }];

  Plotly.newPlot("humidity3d", dataPlot, {
    title: "Beehive Humidity 3D HeatMap (" + currentMode.toUpperCase() + ")",
    scene: {
      xaxis: { title: "x", range: [1,3] },
      yaxis: { title: "y", range: [1,3] },
      zaxis: { title: "z", range: [1,3] },
    }
  });
}
