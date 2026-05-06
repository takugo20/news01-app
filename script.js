const DATA_PATHS = {
  top: "./data/top.json",
  news: "./data/news.json",
};

const state = {
  allNews: [],
  currentCategory: "すべて",
  searchText: "",
};

const topStatus = document.getElementById("topStatus");
const topCards = document.getElementById("topCards");
const topUpdated = document.getElementById("topUpdated");

const newsStatus = document.getElementById("newsStatus");
const newsList = document.getElementById("newsList");
const newsUpdated = document.getElementById("newsUpdated");
const categoryButtons = document.getElementById("categoryButtons");
const searchInput = document.getElementById("searchInput");

function formatDateTime(value) {
  if (!value) return "不明";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "不明";

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value, digits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return "取得失敗";

  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function weatherCodeToText(code) {
  const table = {
    0: "快晴",
    1: "晴れ",
    2: "一部曇り",
    3: "曇り",
    45: "霧",
    48: "霧氷",
    51: "小雨",
    53: "雨",
    55: "強い雨",
    61: "小雨",
    63: "雨",
    65: "強い雨",
    71: "小雪",
    73: "雪",
    75: "強い雪",
    80: "にわか雨",
    81: "にわか雨",
    82: "強いにわか雨",
    95: "雷雨",
    96: "雷雨・ひょう",
    99: "激しい雷雨・ひょう",
  };

  return table[code] ?? "不明";
}

async function fetchJson(path) {
  const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} の読み込みに失敗しました`);
  }
  return response.json();
}

function createTopCard(title, value, subText) {
  return `
    <article class="top-card">
      <p class="top-card-title">${escapeHtml(title)}</p>
      <p class="top-card-value">${escapeHtml(value)}</p>
      <p class="top-card-sub">${escapeHtml(subText)}</p>
    </article>
  `;
}

function renderTop(data) {
  const nikkei = data?.market?.nikkei225;
  const usdJpy = data?.market?.usdJpy;
  const weather = data?.weather;

  topUpdated.textContent = `最終更新：${formatDateTime(data?.updatedAt)}`;
  topStatus.classList.add("hidden");

  const nikkeiValue = nikkei?.value != null
    ? `${formatNumber(nikkei.value, 2)} 円`
    : "取得失敗";

  const nikkeiSub = nikkei?.error
    ? `エラー：${nikkei.error}`
    : `取得元：${nikkei?.source ?? "不明"} / ${nikkei?.date ?? "日付不明"} ${nikkei?.time ?? ""}`;

  const usdJpyValue = usdJpy?.value != null
    ? `${formatNumber(usdJpy.value, 3)} 円`
    : "取得失敗";

  const usdJpySub = usdJpy?.error
    ? `エラー：${usdJpy.error}`
    : `取得元：${usdJpy?.source ?? "不明"} / ${usdJpy?.date ?? "日付不明"} ${usdJpy?.time ?? ""}`;

  const weatherValue = weather?.temperature != null
    ? `${Math.round(weather.temperature)}℃`
    : "取得失敗";

  const weatherText = weather?.error
    ? `エラー：${weather.error}`
    : `${weatherCodeToText(weather?.weatherCode)} / 降水確率 ${weather?.precipitationProbability ?? "不明"}% / 風速 ${weather?.windSpeed ?? "不明"}m/s`;

  topCards.innerHTML = [
    createTopCard("日経平均株価", nikkeiValue, nikkeiSub),
    createTopCard("円/ドル為替レート", usdJpyValue, usdJpySub),
    createTopCard("宇都宮市の天気", weatherValue, weatherText),
  ].join("");
}

function renderCategories() {
  const categories = ["すべて", ...new Set(state.allNews.map((item) => item.category).filter(Boolean))];

  categoryButtons.innerHTML = categories.map((category) => {
    const activeClass = category === state.currentCategory ? " active" : "";
    return `<button class="category-button${activeClass}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`;
  }).join("");
}

function matchesSearch(item, keyword) {
  if (!keyword) return true;

  const target = [item.title, item.description, item.source, item.category]
    .join(" ")
    .toLowerCase();

  return target.includes(keyword.toLowerCase());
}

function renderNews() {
  const filtered = state.allNews.filter((item) => {
    const categoryOk = state.currentCategory === "すべて" || item.category === state.currentCategory;
    const searchOk = matchesSearch(item, state.searchText.trim());
    return categoryOk && searchOk;
  });

  if (filtered.length === 0) {
    newsStatus.textContent = "該当するニュースがありません。検索条件を変えてください。";
    newsStatus.className = "status-message";
    newsStatus.classList.remove("hidden");
    newsList.innerHTML = "";
    return;
  }

  newsStatus.classList.add("hidden");

  newsList.innerHTML = filtered.map((item) => {
    const url = item.url && item.url !== "#" ? item.url : "javascript:void(0)";
    const target = item.url && item.url !== "#" ? " target=\"_blank\" rel=\"noopener noreferrer\"" : "";

    return `
      <a class="news-card" href="${escapeHtml(url)}"${target}>
        <h3>${escapeHtml(item.title)}</h3>
        <div class="news-meta">
          <span class="badge">${escapeHtml(item.category ?? "未分類")}</span>
          <span>${escapeHtml(item.source ?? "配信元不明")}</span>
          <span>${formatDateTime(item.publishedAt)}</span>
        </div>
        <p class="news-description">${escapeHtml(item.description ?? "概要はありません。")}</p>
      </a>
    `;
  }).join("");
}

async function loadTop() {
  try {
    const data = await fetchJson(DATA_PATHS.top);
    renderTop(data);
  } catch (error) {
    topUpdated.textContent = "最終更新：取得失敗";
    topStatus.textContent = `日経平均・為替・天気の読み込みに失敗しました。${error.message}`;
    topStatus.className = "status-message error";
  }
}

async function loadNews() {
  try {
    const data = await fetchJson(DATA_PATHS.news);
    state.allNews = Array.isArray(data.items) ? data.items : [];
    newsUpdated.textContent = `最終更新：${formatDateTime(data.updatedAt)}`;
    renderCategories();
    renderNews();
  } catch (error) {
    newsUpdated.textContent = "最終更新：取得失敗";
    newsStatus.textContent = `ニュースの読み込みに失敗しました。${error.message}`;
    newsStatus.className = "status-message error";
  }
}

categoryButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;

  state.currentCategory = button.dataset.category;
  renderCategories();
  renderNews();
});

searchInput.addEventListener("input", (event) => {
  state.searchText = event.target.value;
  renderNews();
});

loadTop();
loadNews();
