// script.js — CSV場所自動探索 + フォールバック + バッジ + 営業中 + ラベル（紙OK/分煙/喫煙室）

let stores = [];

/* ====== 軽量CSVパーサ（ダブルクオート対応） ====== */
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell.trim()); cell = ''; }
      else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
      else if (ch === '\r') { /* skip */ }
      else { cell += ch; }
    }
  }
  if (cell.length || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(r => r.length && r.some(c => c !== ''));
}

/* ====== CSVを取得（複数候補パスを順に試行） ====== */
/* ルート直下 / data/ / docs/ を順に試します。必要なら下の配列を編集してください。 */
async function loadCSV() {
  const candidates = [
    './stores.csv',
    './data/stores.csv',
    './docs/stores.csv',           // GitHub Pages: /docs を公開にしている場合
    `${window.location.pathname.replace(/\/[^/]*$/, '/') }stores.csv` // 念のため相対
  ];
  let lastErr;
  for (const p of candidates) {
    const url = `${p}?ts=${Date.now()}`; // キャッシュ回避
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} @ ${url}`);
      const text = await resp.text();
      const rows = parseCSV(text);
      if (!rows.length) throw new Error('CSV empty');
      const headers = rows[0].map(h => h.trim());
      return rows.slice(1).map(r => {
        const obj = {};
        headers.forEach((key, i) => obj[key] = (r[i] ?? '').trim());
        return obj;
      });
    } catch (e) {
      lastErr = e;
      console.warn('CSV読み込み失敗:', e.message);
    }
  }
  throw lastErr || new Error('CSV読み込みに失敗しました');
}

/* ====== フォールバック（最小1件だけ表示） ====== */
const FALLBACK = [
  {
    name: "Cafe バンカム",
    category: "喫茶店",
    smoking: "全席喫煙可",
    address: "福岡市博多区博多駅中央街2-1",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=福岡市博多区博多駅中央街2-1",
    priceRange: "¥",
    openHours: "7:00-20:00",
    seats: "24",
    powerOutlets: "yes",
    wifi: "no"
  }
];

/* ====== ラベル変換 ====== */
function getSmokingLabel(type) {
  switch (type) {
    case '全席喫煙可':     return '紙OK';
    case '分煙':           return '分煙';
    case '喫煙ブースあり': return '喫煙室';
    default:               return '-';
  }
}

/* ====== 営業中判定（JST・ざっくり） ====== */
function isOpenNow(openHoursRaw) {
  if (!openHoursRaw) return false;
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const day = jst.getDay(); // 0=日 … 6=土
  const hm  = jst.getHours() * 60 + jst.getMinutes();

  const blocks = openHoursRaw.split(';').map(s => s.trim()).filter(Boolean);
  const pick = blocks.filter(b => {
    if (/平日/.test(b)) return day >= 1 && day <= 5;
    if (/土日/.test(b)) return day === 0 || day === 6;
    if (/土/.test(b) && !/土日/.test(b)) return day === 6;
    if (/日/.test(b) && !/土日/.test(b)) return day === 0;
    return !/[月火水木金土日]/.test(b);
  });
  const target = pick.length ? pick : blocks;

  const ranges = target.map(b => {
    const m = b.match(/(\d{1,2}):?(\d{2})?\s*-\s*(翌)?(\d{1,2}):?(\d{2})?/);
    if (!m) return null;
    const s = parseInt(m[1], 10) * 60 + parseInt(m[2] || '0', 10);
    const eRaw = parseInt(m[4], 10) * 60 + parseInt(m[5] || '0', 10);
    const crosses = !!m[3] || eRaw < s; // 翌 or 終了<開始
    return { s, e: eRaw, crosses };
  }).filter(Boolean);

  return ranges.some(({ s, e, crosses }) => (crosses ? hm >= s || hm <= e : hm >= s && hm <= e));
}

/* ====== DOM ====== */
const storeList      = document.getElementById('store-list');
const categoryFilter = document.getElementById('category-filter');
const smokingFilter  = document.getElementById('smoking-filter');

/* ====== 描画 ====== */
function renderStores() {
  const category = categoryFilter?.value || '';
  const smoking  = smokingFilter?.value  || '';

  const filtered = stores.filter(st =>
    (!category || st.category === category) &&
    (!smoking  || st.smoking  === smoking)
  );

  if (!storeList) return;
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
    const badgesHtml = `
      <div class="badges">
        ${st.priceRange ? `<span class="badge">${st.priceRange}</span>` : ''}
        ${st.seats      ? `<span class="badge">席:${st.seats}</span>` : ''}
        ${st.powerOutlets && st.powerOutlets.toLowerCase() === 'yes' ? `<span class="badge">🔌電源</span>` : ''}
        ${st.wifi         && st.wifi.toLowerCase()         === 'yes' ? `<span class="badge">📶Wi‑Fi</span>` : ''}
        ${openNow ? `<span class="badge badge-open">● 営業中</span>` : ''}
      </div>
    `;
    const card = document.createElement('div');
    card.className = 'store-card fade-in';
    card.style.animationDelay = `${i * 50}ms`;
    card.innerHTML = `
      <h3>${st.name || '-'}</h3>
      <span class="smoking-label">${getSmokingLabel(st.smoking)}</span>
      ${badgesHtml}
      <p>カテゴリ：${st.category || '-'}</p>
      <p>喫煙形態：${st.smoking || '-'}</p>
      <p>住所：${st.address || '-'}</p>
      <p><a href="${st.mapUrl || '#'}" target="_blank" rel="noopener">Google Mapで見る</a></p>
    `;
    storeList.appendChild(card);
  });
}

/* ====== 起動 ====== */
async function start() {
  try {
    stores = await loadCSV();
  } catch (e) {
    console.error('CSV全候補で失敗。フォールバック表示に切替:', e);
    stores = FALLBACK;
    const warn = document.createElement('div');
    warn.textContent = 'CSVの読み込みに失敗したため、サンプルデータを表示しています。';
    warn.style.textAlign = 'center';
    warn.style.margin = '0.5rem 0';
    warn.style.opacity = '0.8';
    document.body.prepend(warn);
  }
  renderStores();
}

categoryFilter?.addEventListener('change', renderStores);
smokingFilter?.addEventListener('change', renderStores);
start();
