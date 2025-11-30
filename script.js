// ===== Firebase SDK 読み込み =====

// v9 モジュラーSDKを使う
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ===== あなたの firebaseConfig を貼る =====
const firebaseConfig = {
  apiKey: "AIzaSyBaEPr5uJFKlTsEAK2AxByxJ6IKSkfmDJ8",
  authDomain: "beehiveheatmap.firebaseapp.com",
  databaseURL: "https://beehiveheatmap-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "beehiveheatmap",
  storageBucket: "beehiveheatmap.firebasestorage.app",
  messagingSenderId: "240823308650",
  appId: "1:240823308650:web:c3a052cb93d70009295513"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== sensors ノードを読み取る =====
const sensorsRef = ref(db, "sensors");

onValue(sensorsRef, (snapshot) => {
  const data = snapshot.val();
  console.log("📡 Firebase更新を受信:", data);

  // テストのため、画面に表示する
  const out = document.getElementById("out");
  out.textContent = JSON.stringify(data, null, 2);
});
