export const HOME_PAGE = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page Kit</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; color: #172033; background: #f4f6f8; }
    main { width: min(920px, calc(100% - 32px)); margin: 0 auto; padding: 64px 0; }
    header { margin-bottom: 28px; }
    h1 { margin: 0 0 8px; font-size: clamp(2rem, 6vw, 3.5rem); letter-spacing: -.05em; }
    header p { margin: 0; color: #667085; }
    .panel { padding: 24px; border: 1px solid #d9dee7; border-radius: 18px; background: #fff; box-shadow: 0 12px 36px rgb(23 32 51 / 8%); }
    form { display: grid; gap: 16px; }
    label { display: grid; gap: 7px; font-size: .875rem; font-weight: 650; }
    input, textarea, button { font: inherit; }
    input, textarea { width: 100%; border: 1px solid #c8cfda; border-radius: 10px; color: inherit; background: #fff; outline: none; }
    input { height: 46px; padding: 0 13px; }
    input:focus, textarea:focus { border-color: #4967e8; box-shadow: 0 0 0 3px rgb(73 103 232 / 14%); }
    .url-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
    button { min-height: 46px; padding: 0 20px; border: 0; border-radius: 10px; color: #fff; background: #3152dc; font-weight: 700; cursor: pointer; }
    button:hover { background: #2544c4; }
    button:disabled { cursor: wait; opacity: .65; }
    .status { min-height: 1.5em; margin: 18px 0 8px; color: #667085; font-size: .875rem; }
    .status.error { color: #b42318; }
    .result-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    h2 { margin: 0; font-size: 1rem; }
    .copy { min-height: 34px; padding: 0 12px; color: #344054; border: 1px solid #c8cfda; background: #fff; font-size: .82rem; }
    .copy:hover { background: #f7f8fa; }
    textarea { min-height: 360px; padding: 14px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .86rem; line-height: 1.6; }
    [hidden] { display: none !important; }
    @media (max-width: 600px) { main { padding: 36px 0; } .panel { padding: 18px; } .url-row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Page Kit</h1>
      <p>Webページの本文を、読みやすいMarkdownに変換します。</p>
    </header>
    <section class="panel">
      <form id="convert-form">
        <label>
          URL
          <span class="url-row">
            <input id="url" type="url" inputmode="url" required autofocus placeholder="https://example.com/article">
            <button id="submit" type="submit">Markdownに変換</button>
          </span>
        </label>
      </form>
      <p id="status" class="status" role="status" aria-live="polite"></p>
      <div id="result" hidden>
        <div class="result-header">
          <h2 id="title">変換結果</h2>
          <button id="copy" class="copy" type="button">コピー</button>
        </div>
        <textarea id="markdown" readonly aria-label="変換されたMarkdown"></textarea>
      </div>
    </section>
  </main>
  <script>
    const form = document.querySelector('#convert-form');
    const url = document.querySelector('#url');
    const submit = document.querySelector('#submit');
    const status = document.querySelector('#status');
    const result = document.querySelector('#result');
    const title = document.querySelector('#title');
    const markdown = document.querySelector('#markdown');
    const copy = document.querySelector('#copy');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      submit.textContent = '変換中…';
      status.className = 'status';
      status.textContent = 'ページを取得しています。';
      result.hidden = true;

      try {
        const response = await fetch('/fetch', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ url: url.value, render: 'auto' }),
        });
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error?.message || '変換に失敗しました');

        title.textContent = body.data.title || '変換結果';
        markdown.value = body.data.markdown;
        status.textContent = body.data.metadata.cached ? 'キャッシュから取得しました。' : '変換しました。';
        result.hidden = false;
      } catch (error) {
        status.className = 'status error';
        status.textContent = error instanceof Error ? error.message : '変換に失敗しました';
      } finally {
        submit.disabled = false;
        submit.textContent = 'Markdownに変換';
      }
    });

    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(markdown.value);
      copy.textContent = 'コピーしました';
      setTimeout(() => { copy.textContent = 'コピー'; }, 1500);
    });
  </script>
</body>
</html>`;
