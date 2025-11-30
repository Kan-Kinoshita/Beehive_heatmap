// ===== Firebase SDK =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ===== あなたの Firebase Config =====
const firebaseConfig = {
  apiKey: "AIzaSyBaEPr5uJFKlTsEAK2AxByxJ6IKSkfmDJ8",
  authDomain: "beehiveheatmap.firebaseapp.com",
  databaseURL: "https://beehiveheatmap-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "beehiveheatmap",
  storageBucket: "beehiveheatmap.firebasestorage.app",
  messagingSenderId: "240823308650",
  appId: "1:240823308650:web:c3a052cb93d70009295513"
};

// Firebase 初期化
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

console.log("Firebase initialized (IDW volume).");

// ===== IDW パラメータ =====
const GRID_SIZE = 15;   // 15 x 15 x 15
const POWER_P  = 2;     // d^p の p

// ===== Firebase sensors ノード =====
const sensorsRef = ref(db, "sensors");

// 3D グリッド用の座標（1〜3 の範囲を均等に分割）
function buildGridCoords() {
  const coords = [];
  for (let k = 0; k < GRID_SIZE; k++) {
    const z = 1 + (k / (GRID_SIZE - 1)) * 2; // 1〜3
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

// IDW で 1点の温度を計算
function idwTemperatureAtPoint(px, py, pz, sensors, power) {
  let num = 0;
  let den = 0;

  for (const s of sensors) {
    const dx = px - s.x;
    const dy = py - s.y;
    const dz = pz - s.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq === 0) {
      // ちょうどセンサー位置ならその値をそのまま返す
      return s.temp;
    }

    const w = 1 / Math.pow(distSq, power / 2.0); // (sqrt(d2))^p = d^p
    num += w * s.temp;
    den += w;
  }

  if (den === 0) return NaN;
  return num / den;
}

// ===== Firebase → Volume 可視化 =====
onValue(sensorsRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    console.log("No sensors data.");
    return;
  }

  console.log("🔥 Firebase data:", data);

  // ==== 1) 27個のセンサーを {x,y,z,temp} の配列にまとめる ====
  // z: 1〜3, y:1〜3, x:1〜3 の整数座標
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

        const temp = parseFloat(xNode.temperature);
        if (Number.isNaN(temp)) continue;

        sensorsList.push({ x, y, z, temp });
      }
    }
  }

  if (sensorsList.length === 0) {
    console.log("No valid sensor values.");
    return;
  }

  console.log("Sensors list for IDW:", sensorsList);

  // ==== 2) 3D グリッドを作り、IDW で各点の温度を計算 ====
  const coords = buildGridCoords();

  const xs = [];
  const ys = [];
  const zs = [];
  const values = [];

  for (const p of coords) {
    const t = idwTemperatureAtPoint(p.x, p.y, p.z, sensorsList, POWER_P);
    if (Number.isNaN(t)) continue;

    xs.push(p.x);
    ys.push(p.y);
    zs.push(p.z);
    values.push(t);
  }

  console.log("Grid points:", xs.length);

  // ==== 3) Plotly Volume で描画 ====
  const dataPlot = [{
    type: "volume",
    x: xs,
    y: ys,
    z: zs,
    value: values,
    opacity: 0.15,           // 全体の透明度（必要に応じて調整）
    surface: { count: 20 },  // 等値面の数
    colorscale: "YlOrRd",
    reversescale: true,
  }];

  const layout = {
    title: "Beehive Temperature 3D Volume (IDW)",
    scene: {
      xaxis: { title: "x", range: [1, 3] },
      yaxis: { title: "y", range: [1, 3] },
      zaxis: { title: "Layer (z)", range: [1, 3] }
    }
  };

  Plotly.newPlot("heatmap3d", dataPlot, layout);
});
