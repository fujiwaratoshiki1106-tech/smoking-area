// script.js —— バッジ表示 + 営業中判定 + CSV読込（軽量パーサ付き）

let stores = [];

// --- 軽量CSVパーサ（ダブルクオート対応、改行/カンマを適切に処理）---
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { // 連続ダブルクオートはエスケープ
        cell += '"'; i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell.trim()); cell = '';
      } else if (ch === '\n') {
        row.push(cell.trim()); rows.push(row); row = []; cell = '';
      } else if (ch === '\r') {
        // ignore
      } else {
        cell += ch;
      }
    }
  }
  // 最終セル
  if (cell.length || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter(r => r.length && r.some(c => c !== ''));
}

// --- CSVを取得してオブジェクト配列へ ---
async function fetchStoresFromCSV() {
  try {
    const resp = await fetch(`stores.csv?ts=${Date.now()}`); // キャッシュ回避
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();

    const rows = parseCSV(text);
    if (!rows.length) throw new Error('CSVが空です');

    const headers = rows[0].map(h => h.trim());
    const data = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((key, i) => obj[key] = (r[i] ?? '').trim());
      return obj;
    });

    stores = data;
    renderStores();
  } catch (e) {
    console.error('CSV読み込みエラー:', e);
    const list = document.getElementById('store-list');
    if (list) {
      list.innerHTML = `<p style="text-align:center">データの読み込みに失敗しました。時間をおいて再読み込みしてください。</p>`;
    }
  }
}

function getSmokingIcon(type) {
  switch (type) {
    case '全席喫煙可':     return '🚬';
    case '分煙':           return '🚷';
    case '喫煙ブースあり': return '🚪💨';
    default:               return '❓';
  }
}

// 営業中判定（ざっくり）
// 例: "7:00-21:00" / "平日7:00-21:00;土日9:00-18:00" / "10:00-翌2:00"
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
    // 曜日指定なしは常に候補
    return !/[月火水木金土日]/.test(b);
  });

  const target = pick.length ? pick : blocks;

  const ranges = target.map(b => {
    // "10:00-翌2:00" / "10:00-02:00" 両対応
    const m = b.match(/(\d{1,2}):?(\d{2})?\s*-\s*(翌)?(\d{1,2}):?(\d{2})?/);
    if (!m) return null;
    const s = parseInt(m[1], 10) * 60 + parseInt(m[2] || '0', 10);
    let e = parseInt(m[4], 10) * 60 + parseInt(m[5] || '0', 10);
    const crosses = !!m[3] || e < s; // 翌 or 終了時刻が開始より小さい
    return { s, e, crosses };
  }).filter(Boolean);

  return ranges.some(({ s, e, crosses }) => (crosses ? hm >= s || hm <= e : hm >= s && hm <= e));
}

const storeList      = document.getElementById('store-list');
const categoryFilter = document.getElementById('category-filter');
const smokingFilter  = document.getElementById('smoking-filter');

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
      <h3>${st.name || '-'}<span class="smoking-icon">${getSmokingIcon(st.smoking)}</span></h3>
      ${badgesHtml}
      <p>カテゴリ：${st.category || '-'}</p>
      <p>喫煙形態：${st.smoking || '-'}</p>
      <p>住所：${st.address || '-'}</p>
      <p><a href="${st.mapUrl || '#'}" target="_blank" rel="noopener">Google Mapで見る</a></p>
    `;
    storeList.appendChild(card);
  });
}

// フィルタ操作で即再描画
categoryFilter?.addEventListener('change', renderStores);
smokingFilter?.addEventListener('change', renderStores);

// 起動
fetchStoresFromCSV();
