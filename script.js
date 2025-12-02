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

console.log("Firebase initialized.");

// ===== Parameters =====
const GRID_SIZE = 15;
const POWER_P  = 2;        // IDW parameter
const SIGMA = 0.7;         // Gaussian RBF parameter

// ===== 現在の補間方式 ("idw" or "gauss") =====
let currentMode = "idw";
let currentField = "temp";

// ===== 最新センサーデータを保持 =====
let latestSensorsList = [];

// ===== ボタンによるモード切り替え =====
document.getElementById("btnIDW").addEventListener("click", () => {
  currentMode = "idw";
  redraw();
});

document.getElementById("btnGAUSS").addEventListener("click", () => {
  currentMode = "gauss";
  redraw();
});

// ===== 温度・湿度切り替え =====
document.getElementById("btnTEMP").addEventListener("click", () => {
  currentField = "temp";
  redraw();
});

document.getElementById("btnHUMID").addEventListener("click", () => {
  currentField = "humidity";
  redraw();
});

// ===== グリッド生成 =====
function buildGridCoords() {
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

// ===== IDW補間 =====
function idwTemperatureAtPoint(px, py, pz, sensors, power) {
  let num = 0;
  let den = 0;

  for (const s of sensors) {
    const dx = px - s.x;
    const dy = py - s.y;
    const dz = pz - s.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq === 0) return s.temp;

    const w = 1 / Math.pow(distSq, power / 2.0);
    num += w * s.temp;
    den += w;
  }

  return den === 0 ? NaN : num / den;
}

function idwHumidityAtPoint(px, py, pz, sensors, power) {
  let num = 0;
  let den = 0;

  for (const s of sensors) {
    if (s.humidity === null) continue;

    const dx = px - s.x;
    const dy = py - s.y;
    const dz = pz - s.z;
    const distSq = dx*dx + dy*dy + dz*dz;

    if (distSq === 0) return s.humidity;

    const w = 1 / Math.pow(distSq, power / 2.0);
    num += w * s.humidity;
    den += w;
  }

  return den === 0 ? NaN : num / den;
}

// ===== Gaussian（RBF）補間 =====
function gaussianTemperatureAtPoint(px, py, pz, sensors, sigma) {
  let num = 0;
  let den = 0;

  const twoSigma2 = 2 * sigma * sigma;

  for (const s of sensors) {
    const dx = px - s.x;
    const dy = py - s.y;
    const dz = pz - s.z;

    const dist2 = dx*dx + dy*dy + dz*dz;
    const w = Math.exp(-dist2 / twoSigma2);

    num += w * s.temp;
    den += w;
  }

  return den === 0 ? NaN : num / den;
}

function gaussianHumidityAtPoint(px, py, pz, sensors, sigma) {
  let num = 0;
  let den = 0;

  const twoSigma2 = 2 * sigma * sigma;

  for (const s of sensors) {
    if (s.humidity === null) continue;

    const dx = px - s.x;
    const dy = py - s.y;
    const dz = pz - s.z;
    const dist2 = dx*dx + dy*dy + dz*dz;

    const w = Math.exp(-dist2 / twoSigma2);
    num += w * s.humidity;
    den += w;
  }

  return den === 0 ? NaN : num / den;
}


function interpolate(x, y, z, sensors) {
  // 温度
  if (currentField === "temp") {
    return (currentMode === "idw")
      ? idwTemperatureAtPoint(x, y, z, sensors, POWER_P)
      : gaussianTemperatureAtPoint(x, y, z, sensors, SIGMA);
  }

  // 湿度
  if (currentField === "humidity") {
    return (currentMode === "idw")
      ? idwHumidityAtPoint(x, y, z, sensors, POWER_P)
      : gaussianHumidityAtPoint(x, y, z, sensors, SIGMA);
  }
}

// ===== Firebase Listener =====
onValue(sensorsRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  const sensorsList = [];

  for (let z = 1; z <= 3; z++) {
    const zNode = data[`z${z}`];
    if (!zNode) continue;

    for (let y = 1; y <= 3; y++) {
      const yNode = zNode[`y${y}`];
      if (!yNode) continue;

      for (let x = 1; x <= 3; x++) {
        const xNode = yNode[`x${x}`];
        if (!xNode || xNode.temperature === undefined) continue;

        sensorsList.push({
          x, y, z,
          temp: parseFloat(xNode.temperature)
          humidity: xNode.humidity !== undefined ? parseFloat(xNode.humidity) : null
        });
      }
    }
  }

  latestSensorsList = sensorsList;
  redraw();
});

// ===== 描画関数 =====
function redraw() {
  if (latestSensorsList.length === 0) return;

  const coords = buildGridCoords();
  const xs = [], ys = [], zs = [], values = [];

  for (const p of coords) {
    const t = interpolate(p.x, p.y, p.z, latestSensorsList);
    if (!Number.isNaN(t)) {
      xs.push(p.x);  
      ys.push(p.y);
      zs.push(p.z);
      values.push(t);
    }
  }

  const dataPlot = [{
    type: "volume",
    x: xs,
    y: ys,
    z: zs,
    value: values,
    opacity: 0.18,
    surface: { count: 20 },
    colorscale: [
      [0.0, "blue"],
      [0.5, "yellow"],
      [1.0, "red"]
    ],
  }];

  const layout = {
    title: 
      (currentField === "temp")
        ? (currentMode === "idw"
          ? "Temperature Heatmap (IDW)"
          : "Temperature Heatmap (Gaussian)")
        : (currentMode === "idw"
          ? "Humidity Heatmap (IDW)"
          : "Humidity Heatmap (Gaussian)"),
    scene: {
      xaxis: { title: "x", range: [1, 3] },
      yaxis: { title: "y", range: [1, 3] },
      zaxis: { title: "Layer (z)", range: [1, 3] }
    }
  };

  Plotly.newPlot("heatmap3d", dataPlot, layout);
}
