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

console.log("Firebase initialized (Absolute Humidity Model)");

// ===== Parameters =====
const GRID_SIZE = 15;
const POWER_P  = 2;
const SIGMA = 0.7;

let currentMode = "idw";
let latestSensors = []; // {x,y,z, temperature, RH, AH}

// UI buttons
document.getElementById("btnIDW").addEventListener("click", () => {
  currentMode = "idw"; redraw();
});
document.getElementById("btnGAUSS").addEventListener("click", () => {
  currentMode = "gauss"; redraw();
});

// ===== Absolute Humidity calculation =====
function computeAbsoluteHumidity(T, RH) {
  const rh = RH / 100;
  const sat = 6.112 * Math.exp((17.67 * T) / (T + 243.5));
  const AH = (sat * rh * 2.1674) / (273.15 + T);
  return AH;
}

function AH_to_RH(AH, T) {
  const sat = 6.112 * Math.exp((17.67 * T) / (T + 243.5));
  const maxAH = (sat * 2.1674) / (273.15 + T);
  return (AH / maxAH) * 100;
}

// ===== Grid =====
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

// ===== IDW =====
function idw(px, py, pz, sensors) {
  let num = 0, den = 0;
  for (const s of sensors) {
    const dx = px - s.x, dy = py - s.y, dz = pz - s.z;
    const d2 = dx*dx + dy*dy + dz*dz;
    if (d2 === 0) return s.AH;
    const w = 1 / Math.pow(d2, POWER_P / 2);
    num += w * s.AH;
    den += w;
  }
  return num / den;
}

// ===== Gaussian =====
function gauss(px, py, pz, sensors) {
  const c = 2 * SIGMA * SIGMA;
  let num = 0, den = 0;
  for (const s of sensors) {
    const dx = px - s.x, dy = py - s.y, dz = pz - s.z;
    const d2 = dx*dx + dy*dy + dz*dz;
    const w = Math.exp(-d2 / c);
    num += w * s.AH;
    den += w;
  }
  return num / den;
}

// ===== Firebase =====
onValue(sensorsRef, (snap) => {
  const data = snap.val();
  const list = [];

  for (let z=1; z<=3; z++) {
    for (let y=1; y<=3; y++) {
      for (let x=1; x<=3; x++) {

        const node = data?.[`z${z}`]?.[`y${y}`]?.[`x${x}`];
        if (!node || node.humidity === undefined || node.temperature === undefined) continue;

        const T = parseFloat(node.temperature);
        const RH = parseFloat(node.humidity);

        const AH = computeAbsoluteHumidity(T, RH);

        list.push({ x, y, z, T, RH, AH });
      }
    }
  }

  latestSensors = list;
  redraw();
});

// ===== DRAW =====
function redraw() {
  if (latestSensors.length === 0) return;

  const coords = buildGrid();
  const xs=[], ys=[], zs=[], vals=[];

  for (const p of coords) {
    const AH = (currentMode === "idw")
      ? idw(p.x,p.y,p.z,latestSensors)
      : gauss(p.x,p.y,p.z,latestSensors);

    // 補間した AH を各点の温度で RH に戻す
    const T_here = 30; // ★必要なら温度マップから補完して置き換え可能
    const RH_out = AH_to_RH(AH, T_here);

    xs.push(p.x);
    ys.push(p.y);
    zs.push(p.z);
    vals.push(RH_out);
  }

  Plotly.newPlot("humidity3d", [{
    type: "volume",
    x: xs, y: ys, z: zs,
    value: vals,
    opacity: 0.28,
    surface: { count: 20 },
    colorscale: [
      [0.0, "#0000ff"],
      [0.25, "#00ffff"],
      [0.5, "#00ff00"],
      [0.75, "#ffff00"],
      [1.0, "#ff0000"]
    ],
  }], {
    title: "Beehive Humidity 3D HeatMap (Absolute Humidity Model)",
    scene: {
      xaxis:{title:"x", range:[1,3]},
      yaxis:{title:"y", range:[1,3]},
      zaxis:{title:"z", range:[1,3]},
    }
  });
}
