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

console.log("Firebase initialized.");

// === Get sensors reference ===
const sensorsRef = ref(db, "sensors");

// ===== リアルタイムで Firebase → Heatmap 更新 =====
onValue(sensorsRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  console.log("🔥 Firebase data:", data);

  // 空の 3×3×3 グリッド（z,y,x）
  let grid = [
    [ [0,0,0], [0,0,0], [0,0,0] ],
    [ [0,0,0], [0,0,0], [0,0,0] ],
    [ [0,0,0], [0,0,0], [0,0,0] ],
  ];

  // === Firebase の値を grid に入れる ===
  for (let z = 1; z <= 3; z++) {
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        const temp = data[`z${z}`]?.[`y${y}`]?.[`x${x}`]?.temperature;
        if (temp !== undefined) {
          grid[z-1][y-1][x-1] = temp;
        }
      }
    }
  }

  // === Plotly 用の3層 surfaceデータ作成 ===
  const surfaces = [];

  for (let z = 0; z < 3; z++) {
    surfaces.push({
      z: [
        [z, z, z],
        [z, z, z],
        [z, z, z]
      ],
      x: [[1,2,3],[1,2,3],[1,2,3]],
      y: [[1,1,1],[2,2,2],[3,3,3]],
      surfacecolor: grid[z],
      type: "surface",
      showscale: (z === 0)  // カラースケールは1つだけ表示
    });
  }

  // === グラフ描画 ===
  Plotly.newPlot("heatmap3d", surfaces, {
    title: "Beehive Temperature 3D Heatmap",
    scene: {
      xaxis: { title: "x" },
      yaxis: { title: "y" },
      zaxis: { title: "Layer (z)" }
    }
  });

});
