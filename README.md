# Page Kit

単一URLから本文を抽出し、Markdownで返す個人利用向けAPI。認証、検索、クロール機能は持たない。

## セットアップ

Node.js 22以上とBunが必要。

```sh
bun install
bunx playwright install chromium
cp .env.example .env
bun run dev
```

環境変数:

- `PORT`: HTTPポート。デフォルトは`3000`
- `DATABASE_PATH`: SQLiteファイル。デフォルトは`./data/cache.db`

## API

```sh
curl -X POST http://localhost:3000/fetch \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","render":"auto"}'
```

`render`は以下を指定できる。

- `auto`（デフォルト）: 通常取得後、本文が短いなどの条件に該当した場合だけChromiumを使う
- `never`: Chromiumを使わない
- `always`: 最初からChromiumを使う

同じ正規化URLの結果はSQLiteへ24時間キャッシュする。`"force": true`でキャッシュを無視できる。

## コマンド

```sh
bun run typecheck
bun run test
bun run build
bun run start
bun run test:browser # 実サイトとインストール済みChromiumを使う分離テスト
```

## セキュリティ上の制約

HTTP/HTTPSのみ許可し、localhost、プライベートIP、link-local、`.local`を拒否する。通常取得ではリダイレクトごと、Chromiumでは各リクエストの名前解決結果も検査する。DNS Rebindingへの完全な防御を保証するものではないため、信頼できない利用者へそのまま公開しないこと。

## Mac miniで常駐

`bun run build`後、`bun run start`を実行するlaunchd plistを作成し、`KeepAlive`と`WorkingDirectory`をこのディレクトリに設定する。標準出力と標準エラーのログ先もplistで指定する。
