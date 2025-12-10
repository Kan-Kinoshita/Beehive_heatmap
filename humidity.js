// ===== Firebase SDK =====
import { initializeApp } 
  from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, onValue } 
  from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ===== 共通補間ロジック =====
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

console.log("Firebase initialized (Absolute Humidity Model)");

const GRID_SIZE = 15;
const POWER_P = 2;
const SIGMA = 0.7;

let currentMode = "idw";
let latestSensors = [];  // humidity sensor list

// ===== UI buttons =====
document.getElementById("btnIDW").addEventListener("click", () => {
  currentMode = "idw";
  redraw();
});
document.getElementById("btnGAUSS").addEventListener("click", () => {
  currentMode = "gauss";
  redraw();
});

// ===== AH calculation =====
function computeAbsoluteHumidity(T, RH) {
  const rh = RH / 100;
  const sat = 6.112 * Math.exp((17.67 * T) / (T + 243.5));
  return (sat * rh * 2.1674) / (273.15 + T);
}

function AH_to_RH(AH, T) {
  const sat = 6.112 * Math.exp((17.67 * T) / (T + 243.5));
  const maxAH = (sat * 2.1674) / (273.15 + T);
  return (AH / maxAH) * 100;
}

// ===== interpolation wrapper =====
function interpolateAH(x, y, z, sensors) {
  if (currentMode === "idw") {
    return idwInterpolate(x, y, z, sensors, "AH", POWER_P);
  }
  return gaussInterpolate(x, y, z, sensors, "AH", SIGMA);
}

// ===== Firebase Listener =====
onValue(sensorsRef, (snap) => {
  const data = snap.val();
  const list = [];

  for (let z=1; z<=3; z++) {
    for (let y=1; y<=3; y++) {
      for (let x=1; x<=3; x++) {
        const node = data?.[`z${z}`]?.[`y${y}`]?.[`x${x}`];
        if (!node || node.humidity === undefined || node.temperature === undefined)
          continue;

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

  const coords = buildGridCoords(GRID_SIZE);
  const xs = [], ys = [], zs = [], vals = [];

  for (const p of coords) {
    const AH = interpolateAH(p.x, p.y, p.z, latestSensors);

    const T_here = 30;  // TODO: ここはあとで温度補間値に置き換える
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
    title: "Beehive Humidity 3D HeatMap",
    scene: {
      xaxis:{title:"x", range:[1,3]},
      yaxis:{title:"y", range:[1,3]},
      zaxis:{title:"z", range:[1,3]},
    }
  });
}
