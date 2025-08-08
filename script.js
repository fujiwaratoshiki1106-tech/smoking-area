let stores = [];

async function fetchStoresFromCSV() {
  const resp = await fetch('stores.csv');
  const text = await resp.text();
  const rows = text.trim().split('\n').map(r => r.split(','));
  const headers = rows[0];
  const data = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((key, i) => obj[key.trim()] = (row[i] || '').trim());
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

function isOpenNow(openHours) {
  // 期待フォーマット例:
  // "7:00-21:00" または "平日7:00-21:00;土日9:00-18:00"
  if (!openHours) return false;
  const now = new Date();
  const day = now.getDay(); // 0=日,6=土
  const hm = now.getHours() * 60 + now.getMinutes();

  const blocks = openHours.split(';').map(s => s.trim());
  // 超ざっくり判定：曜日指定が含まれていたらそれっぽいブロックだけ使う
  const pick = blocks.filter(b => {
    if (/平日/.test(b)) return day >= 1 && day <= 5;
    if (/土日/.test(b)) return day === 0 || day === 6;
    if (/土/.test(b) && !/土日/.test(b)) return day === 6;
    if (/日/.test(b) && !/土日/.test(b)) return day === 0;
    return !/[月火水木金土日]/.test(b); // 曜日未指定なら常に候補
  });

  const candidates = (pick.length ? pick : blocks).map(b => {
    const m = b.match(/(\d{1,2}):?(\d{2})?-(\d{1,2}):?(\d{2})?/);
    if (!m) return null;
    const s = parseInt(m[1]) * 60 + parseInt(m[2] || '0');
    const e = parseInt(m[3]) * 60 + parseInt(m[4] || '0');
    return { s, e };
  }).filter(Boolean);

  return candidates.some(({ s, e }) => {
    if (e < s) { // 日跨ぎ対応 22:00-02:00
      return hm >= s || hm <= e;
    }
    return hm >= s && hm <= e;
  });
}

const storeList = document.getElementById('store-list');
const categoryFilter = document.getElementById('category-filter');
const smokingFilter = document.getElementById('smoking-filter');

function renderStores() {
  const category = categoryFilter.value;
  const smoking = smokingFilter.value;

  const filtered = stores.filter(st =>
    (!category || st.category === category) &&
    (!smoking || st.smoking === smoking)
  );

  storeList.innerHTML = '';
  if (!filtered.length) {
    const p = document.createElement('p');
    p.textContent = '該当するお店が見つかりませんでした。';
    p.style.textAlign = 'center';
    storeList.appendChild(p);
    return;
  }

  filtered.forEach((st, i) => {
    const openNow = isOpenNow(st.openHours);
    const badges = `
      <div class="badges">
        ${st.priceRange ? `<span class="badge">${st.priceRange}</span>` : ''}
        ${st.seats ? `<span class="badge">席:${st.seats}</span>` : ''}
        ${st.powerOutlets?.toLowerCase()==='yes' ? `<span class="badge">🔌電源</span>` : ''}
        ${st.wifi?.toLowerCase()==='yes' ? `<span class="badge">📶Wi‑Fi</span>` : ''}
        ${openNow ? `<span class="badge badge-open">● 営業中</span>` : ''}
      </div>
    `;

    const card = document.createElement('div');
    card.className = 'store-card fade-in';
    card.style.animationDelay = `${i * 50}ms`;
    card.innerHTML = `
      <h3>${st.name}<span class="smoking-icon">${getSmokingIcon(st.smoking)}</span></h3>
      ${badges}
      <p>カテゴリ：${st.category}</p>
      <p>喫煙形態：${st.smoking}</p>
      <p>住所：${st.address}</p>
      <p><a href="${st.mapUrl}" target="_blank" rel="noopener">Google Mapで見る</a></p>
    `;
    storeList.appendChild(card);
  });
}

categoryFilter.addEventListener('change', renderStores);
smokingFilter.addEventListener('change', renderStores);

fetchStoresFromCSV();
