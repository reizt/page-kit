# Page Kit

単一URLから本文を抽出し、Markdownで返す個人利用向けCloudflare Worker。通常のHTTP取得で本文が不足する場合だけBrowser Runを使う。

## セットアップ

```sh
bun install
cp .env.example .env
bun run dev
```

`.env`の`API_KEY`はREST APIとMCPのBearer認証に使う。Cloudflareへはsecretとして登録する。

```sh
bunx wrangler secret bulk .env
```

## REST API

```sh
curl -X POST https://page-kit.reiju.me/fetch \
  -H "Authorization: Bearer $PAGE_KIT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","render":"auto"}'
```

`render`:

- `auto`（デフォルト）: 通常取得後、本文が短い場合などにBrowser Runへ切り替える
- `never`: Browser Runを使わない
- `always`: 最初からBrowser Runを使う

同じ正規化URLの結果はD1へ24時間キャッシュする。`"force": true`でキャッシュを無視できる。

## MCP

Streamable HTTP MCPを`/mcp`で提供し、`fetch_page` toolを公開する。

```sh
export PAGE_KIT_API_KEY='...'
codex mcp add page-kit \
  --url https://page-kit.reiju.me/mcp \
  --bearer-token-env-var PAGE_KIT_API_KEY
```

## デプロイ

```sh
bunx wrangler d1 migrations apply page-kit --remote
bunx wrangler secret bulk .env
bun run deploy
```

`wrangler.jsonc`に以下を設定済み。

- D1 database: `page-kit`
- Browser Run binding: `BROWSER`
- Custom Domain: `page-kit.reiju.me`

## 検証

```sh
bun run typecheck
bun run test
bun run build
```

## セキュリティ上の制約

HTTP/HTTPSのみ許可し、localhost、プライベートIP、link-local、`.local`を拒否する。通常取得ではリダイレクトごと、Browser Runではnavigation requestごとに名前解決結果も検査する。DNS Rebindingへの完全な防御を保証するものではない。
