// ===== Firebase SDK =====
import { initializeApp } 
  from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, onValue } 
  from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { buildGridCoords, idwInterpolate, gaussInterpolate }
  from "./interpolation.js";

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

//GaussianとIDWを呼び出す
function interpolate(x, y, z, sensors) {
  if (currentMode === "idw") {
    return idwInterpolate(x, y, z, sensors, "temp", POWER_P);
  }
  return gaussInterpolate(x, y, z, sensors, "temp", SIGMA);
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
          x, 
          y, 
          z,
          temp: parseFloat(xNode.temperature)
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

    if (!Number.isFinite(t)) continue;

    // ★ 物理レンジでクリップ（表示用）
    const clipped = Math.max(0, Math.min(40, t));

    xs.push(p.x);
    ys.push(p.y);
    zs.push(p.z);
    values.push(clipped);
  }

  const vmin = Math.min(...values);
  const vmax = Math.max(...values);

  const dataPlot = [{
  type: "volume",
  x: xs,
  y: ys,
  z: zs,
  value: values,

  isomin: 0,
  isomax: 40,

  opacity: 0.2,
  surface: { count: 30 },

  colorscale: [
    [0.0, "blue"],
    [0.5, "yellow"],
    [1.0, "red"]
  ],

  colorbar: {
    title: "Temperature (°C)",
    tick0: 0,
    dtick: 5
  }
}];

  const layout = {
    title:
      currentMode === "idw"
        ? "Temperature Heatmap (IDW)"
        : "Temperature Heatmap (Gaussian)",
    scene: {
      xaxis: { title: "x", range: [1, 3] },
      yaxis: { title: "y", range: [1, 3] },
      zaxis: { title: "Layer (z)", range: [1, 3] }
    }
  };

  Plotly.newPlot("heatmap3d", dataPlot, layout);
}
