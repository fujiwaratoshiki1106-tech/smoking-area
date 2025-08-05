<script>
  let stores = [];

  async function fetchStoresFromCSV() {
    const response = await fetch('stores.csv');
    const text = await response.text();
    const rows = text.trim().split('\n').map(row => row.split(','));
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      let obj = {};
      headers.forEach((key, i) => obj[key.trim()] = row[i].trim());
      return obj;
    });
    stores = data;
    renderStores();
  }

  function getSmokingIcon(type) {
    switch (type) {
      case "全席喫煙可": return "🚬";
      case "分煙": return "🚷";
      case "喫煙ブースあり": return "🚪💨";
      default: return "❓";
    }
  }

  const storeList = document.getElementById("store-list");
  const categoryFilter = document.getElementById("category-filter");
  const smokingFilter = document.getElementById("smoking-filter");

  function renderStores() {
    const category = categoryFilter.value;
    const smoking = smokingFilter.value;
    const filtered = stores.filter(store => {
      return (!category || store.category === category) &&
             (!smoking || store.smoking === smoking);
    });

    storeList.innerHTML = "";

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "該当するお店が見つかりませんでした。";
      empty.style.textAlign = "center";
      storeList.appendChild(empty);
      return;
    }

    filtered.forEach((store, index) => {
      const card = document.createElement("div");
      card.className = "store-card fade-in";
      card.style.animationDelay = `${index * 50}ms`;
      card.innerHTML = `
        <h3>${store.name}<span class="smoking-icon">${getSmokingIcon(store.smoking)}</span></h3>
        <p>カテゴリ：${store.category}</p>
        <p>喫煙形態：${store.smoking}</p>
        <p>住所：${store.address}</p>
        <p><a href="${store.mapUrl}" target="_blank">Google Mapで見る</a></p>
      `;
      storeList.appendChild(card);
    });
  }

  categoryFilter.addEventListener("change", renderStores);
  smokingFilter.addEventListener("change", renderStores);

  // 初期化
  fetchStoresFromCSV();
</script>
