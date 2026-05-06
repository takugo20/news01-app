# ニュースダッシュボード

GitHub Pagesで公開する、RSS + GitHub Actions + JSON方式のニュースアプリです。

## 機能

- 日経平均株価を表示
- 円/ドル為替レートを表示
- 宇都宮市の天気を表示
- ニュース一覧を表示
- カテゴリで絞り込み
- キーワード検索
- 記事タップで元サイトを開く
- 更新日時を表示
- 読み込み中・取得失敗時の表示

## ファイル構成

```text
index.html
style.css
script.js
data/
  news.json
  top.json
  update-log.json
scripts/
  update-data.mjs
.github/workflows/
  update-news.yml
package.json
README.md
```

## 仕組み

```text
RSS / Stooq / Open-Meteo
        ↓
GitHub Actionsが3時間ごとに取得
        ↓
data/news.json と data/top.json を更新
        ↓
GitHub Pages上のJavaScriptがJSONを読み込んで表示
```

## GitHubでの公開手順

1. GitHubで新しいリポジトリを作る
2. このフォルダ内のファイルをすべてアップロードする
3. リポジトリの `Settings` → `Actions` → `General` を開く
4. `Workflow permissions` を `Read and write permissions` にする
5. `Settings` → `Pages` を開く
6. `Build and deployment` で `Deploy from a branch` を選ぶ
7. Branchを `main`、フォルダを `/root` にして保存する
8. `Actions` タブの `Update news data` を開き、`Run workflow` で手動実行する
9. `data/news.json` と `data/top.json` が更新されたら、GitHub PagesのURLを開く

## データ取得元

### ニュースRSS

初期設定では、以下のRSSを利用しています。

- Yahoo!ニュース 国内: `https://news.yahoo.co.jp/rss/topics/domestic.xml`
- Yahoo!ニュース 経済: `https://news.yahoo.co.jp/rss/topics/business.xml`
- Yahoo!ニュース IT: `https://news.yahoo.co.jp/rss/topics/it.xml`
- Yahoo!ニュース スポーツ: `https://news.yahoo.co.jp/rss/topics/sports.xml`
- Yahoo!ニュース エンタメ: `https://news.yahoo.co.jp/rss/topics/entertainment.xml`
- ITmedia NEWS: `https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml`

取得元を変更する場合は、`scripts/update-data.mjs` の `FEEDS` を編集してください。

### 日経平均株価・円/ドル為替レート

初期設定ではStooqのCSV形式のデータを利用しています。

- 日経平均株価: `^nkx`
- 円/ドル為替レート: `usdjpy`

### 宇都宮市の天気

初期設定ではOpen-Meteoを利用しています。

- 緯度: `36.5657`
- 経度: `139.8836`

## 注意点

- ニュース本文の全文転載はしません。タイトル・概要・元記事リンクのみ表示します。
- GitHub Actionsの定期実行は、混雑状況により遅れる場合があります。
- 株価・為替はリアルタイム保証ではありません。ニューストップの参考情報として扱ってください。
- 公開前に、各データ提供元の利用規約・利用条件を必ず確認してください。
