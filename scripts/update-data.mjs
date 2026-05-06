import fs from "node:fs/promises";
import path from "node:path";
import Parser from "rss-parser";

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data");

const parser = new Parser({
  timeout: 20_000,
  headers: {
    "User-Agent": "news-dashboard-rss-reader/1.0 (+https://github.com/)"
  },
});

const FEEDS = [
  {
    category: "国内",
    source: "Yahoo!ニュース 国内",
    url: "https://news.yahoo.co.jp/rss/topics/domestic.xml",
  },
  {
    category: "経済",
    source: "Yahoo!ニュース 経済",
    url: "https://news.yahoo.co.jp/rss/topics/business.xml",
  },
  {
    category: "IT",
    source: "Yahoo!ニュース IT",
    url: "https://news.yahoo.co.jp/rss/topics/it.xml",
  },
  {
    category: "IT",
    source: "ITmedia NEWS",
    url: "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml",
  },
  {
    category: "スポーツ",
    source: "Yahoo!ニュース スポーツ",
    url: "https://news.yahoo.co.jp/rss/topics/sports.xml",
  },
  {
    category: "エンタメ",
    source: "Yahoo!ニュース エンタメ",
    url: "https://news.yahoo.co.jp/rss/topics/entertainment.xml",
  },
];

const STOOQ_QUOTES = {
  nikkei225: {
    label: "日経平均株価",
    symbol: "^nkx",
    source: "Stooq",
  },
  usdJpy: {
    label: "円/ドル為替レート",
    symbol: "usdjpy",
    source: "Stooq",
  },
};

function nowIso() {
  return new Date().toISOString();
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function limitText(value, maxLength) {
  const text = stripHtml(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

async function fetchFeed(feed) {
  const result = await parser.parseURL(feed.url);

  return result.items.slice(0, 20).map((item) => {
    const title = stripHtml(item.title);
    const url = item.link || item.guid || "#";
    const description = limitText(item.contentSnippet || item.summary || item.content || item.description || "", 160);
    const publishedAt = normalizeDate(item.isoDate || item.pubDate || item.published) || nowIso();

    return {
      id: `${feed.source}-${url}-${title}`,
      title,
      source: feed.source,
      category: feed.category,
      publishedAt,
      description,
      url,
    };
  }).filter((item) => item.title && item.url);
}

async function buildNewsData() {
  const settled = await Promise.allSettled(FEEDS.map(fetchFeed));
  const errors = [];
  const items = [];

  for (let i = 0; i < settled.length; i += 1) {
    const result = settled[i];
    const feed = FEEDS[i];

    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      errors.push({
        source: feed.source,
        url: feed.url,
        message: result.reason?.message ?? String(result.reason),
      });
    }
  }

  const deduped = [];
  const seen = new Set();

  for (const item of items) {
    const key = item.url === "#" ? item.title : item.url;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  if (deduped.length === 0) {
    throw new Error("すべてのRSS取得に失敗したため、news.jsonを更新しません。RSSのURLまたは利用条件を確認してください。");
  }

  return {
    updatedAt: nowIso(),
    generatedBy: "GitHub Actions",
    feeds: FEEDS.map((feed) => ({
      category: feed.category,
      source: feed.source,
      url: feed.url,
    })),
    errors,
    items: deduped.slice(0, 100),
  };
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("CSVの行数が不足しています");
  }

  const headers = lines[0].split(",").map((value) => value.trim());
  const values = lines[1].split(",").map((value) => value.trim());

  return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
}

async function fetchStooqQuote(config) {
  const params = new URLSearchParams({
    s: config.symbol,
    f: "sd2t2ohlcv",
    h: "",
    e: "csv",
  });

  const url = `https://stooq.com/q/l/?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "news-dashboard-market-reader/1.0 (+https://github.com/)"
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const row = parseCsv(await response.text());
  const close = Number(row.Close);

  if (!Number.isFinite(close)) {
    throw new Error("価格データを数値として取得できませんでした");
  }

  return {
    label: config.label,
    symbol: config.symbol,
    value: close,
    date: row.Date ?? null,
    time: row.Time ?? null,
    source: config.source,
    url,
    error: null,
  };
}

async function safeStooqQuote(config) {
  try {
    return await fetchStooqQuote(config);
  } catch (error) {
    return {
      label: config.label,
      symbol: config.symbol,
      value: null,
      date: null,
      time: null,
      source: config.source,
      url: null,
      error: error.message,
    };
  }
}

async function fetchWeather() {
  const params = new URLSearchParams({
    latitude: "36.5657",
    longitude: "139.8836",
    current: "temperature_2m,weather_code,wind_speed_10m",
    daily: "precipitation_probability_max,temperature_2m_max,temperature_2m_min",
    timezone: "Asia/Tokyo",
    forecast_days: "2",
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "news-dashboard-weather-reader/1.0 (+https://github.com/)"
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  return {
    city: "宇都宮市",
    latitude: 36.5657,
    longitude: 139.8836,
    temperature: data.current?.temperature_2m ?? null,
    weatherCode: data.current?.weather_code ?? null,
    windSpeed: data.current?.wind_speed_10m ?? null,
    precipitationProbability: data.daily?.precipitation_probability_max?.[0] ?? null,
    temperatureMax: data.daily?.temperature_2m_max?.[0] ?? null,
    temperatureMin: data.daily?.temperature_2m_min?.[0] ?? null,
    source: "Open-Meteo",
    url,
    error: null,
  };
}

async function safeWeather() {
  try {
    return await fetchWeather();
  } catch (error) {
    return {
      city: "宇都宮市",
      latitude: 36.5657,
      longitude: 139.8836,
      temperature: null,
      weatherCode: null,
      windSpeed: null,
      precipitationProbability: null,
      temperatureMax: null,
      temperatureMin: null,
      source: "Open-Meteo",
      url: null,
      error: error.message,
    };
  }
}

async function buildTopData() {
  const [nikkei225, usdJpy, weather] = await Promise.all([
    safeStooqQuote(STOOQ_QUOTES.nikkei225),
    safeStooqQuote(STOOQ_QUOTES.usdJpy),
    safeWeather(),
  ]);

  return {
    updatedAt: nowIso(),
    generatedBy: "GitHub Actions",
    market: {
      nikkei225,
      usdJpy,
    },
    weather,
  };
}

async function writeJson(filename, data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  const [newsData, topData] = await Promise.all([
    buildNewsData(),
    buildTopData(),
  ]);

  await writeJson("news.json", newsData);
  await writeJson("top.json", topData);
  await writeJson("update-log.json", {
    updatedAt: nowIso(),
    newsItems: newsData.items.length,
    newsErrors: newsData.errors,
    topErrors: {
      nikkei225: topData.market.nikkei225.error,
      usdJpy: topData.market.usdJpy.error,
      weather: topData.weather.error,
    },
  });

  console.log(`news.json: ${newsData.items.length}件`);
  console.log("top.json: 更新完了");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
