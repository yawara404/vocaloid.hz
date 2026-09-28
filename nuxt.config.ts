/**
 * `nuxt dev`（Vite）を公開トンネル（Cloudflare Tunnel など）経由で出すときの許可ホスト。
 * 既定の Host チェック（DNS リバインディング対策）がトンネルの Host を弾いて
 * 403 `Blocked request` になるため、公開ホスト名だけを env で足す。
 *   .env:  NUXT_DEV_ALLOWED_HOSTS=dev.example.com,another.example.com
 * 未設定なら既定（localhost のみ）のままで、ローカル開発には影響しない。
 */
const devAllowedHosts = (process.env.NUXT_DEV_ALLOWED_HOSTS ?? '')
  .split(',')
  .map(host => host.trim())
  .filter(Boolean)

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],
  devtools: {
    // 公開（Cloudflare Tunnel）で Vite をそのまま出すときは NUXT_DEVTOOLS_ENABLED=false にする。
    // DevTools は開発サーバーに WebSocket ルートを張るため、公開経由だと通常の GET が
    // h3 の 426 Upgrade Required に吸われてしまう。
    enabled: process.env.NUXT_DEVTOOLS_ENABLED !== 'false',
    // dev の component inspector（vite-plugin-vue-tracer）が SFC を分割コンパイルして
    // bindingMetadata を失わせ、template ref（ref="x"）が効かなくなるため無効化する。
    // 有効に戻すと、チャットの自動スクロールや ⌘K のフォーカスなどが dev で壊れる。
    componentInspector: false,
  },
  // SQLite はアプリが動くたびに WAL/SHM を書き換えるため、
  // 放置すると dev が「page reload data/vocaloid.hz.db-wal」で再読み込みを繰り返す。
  // DB ファイルは dev のウォッチャー対象から外す。
  ignore: ['**/data/*.db', '**/data/*.db-wal', '**/data/*.db-shm'],
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    viewer: false,
  },
  app: {
    /**
     * 公開（Cloudflare Tunnel のサブパス配信）では NUXT_APP_BASE_URL=/Vocaloid.hz/ を付けて
     * build / run する。既定はルート配信なので、開発時の `npm run dev` はそのままでよい。
     *   例: NUXT_APP_BASE_URL=/Vocaloid.hz/ npm run build && ./scripts/serve-public.sh
     */
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      htmlAttrs: { lang: 'ja' },
      titleTemplate: '%s | vocaloid.hz',
      meta: [
        // モバイルブラウザのUI色。実際の値は下のスクリプトがテーマに合わせて書き換える。
        { name: 'theme-color', content: '#F6F9FA' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      script: [
        {
          // 初回描画の前に <html data-theme> を決める。
          // 後から JS で当てると、白い画面が一瞬光る（FOUC）ため、head で同期的に実行する。
          // 優先順位: localStorage（この端末で最後に選んだ設定）
          //         > SSR が描画した data-theme-pref（アカウントの控え＝別端末での初期値）
          //         > 端末の設定。
          // 値は composables/useTheme.ts / server/middleware/theme.ts と揃えてある。
          innerHTML: `(() => {
  var KEY = 'vocaloid-hz-theme';
  var html = document.documentElement;

  var normalize = function (value) {
    return value === 'system' || value === 'light' || value === 'dark' ? value : null;
  };

  try {
    var stored = null;
    try { stored = window.localStorage.getItem(KEY); } catch (error) { /* プライベートモードなど */ }

    var preference = normalize(stored) || normalize(html.getAttribute('data-theme-pref')) || 'system';
    var theme = preference === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preference;

    html.setAttribute('data-theme-pref', preference);
    html.setAttribute('data-theme', theme);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0B0E10' : '#F6F9FA');
  } catch (error) {
    html.setAttribute('data-theme', 'light');
  }
})();`,
        },
      ],
    },
  },
  /**
   * Vite の Host 許可（既定の Host チェックは DNS リバインディング対策）。
   * トンネル公開時のホストは NUXT_DEV_ALLOWED_HOSTS にカンマ区切りで入れる。
   * scripts/serve-public.sh は PUBLIC_HOST をそのままこの変数へ渡す。
   */
  vite: {
    server: {
      allowedHosts: devAllowedHosts.length > 0 ? devAllowedHosts : undefined,
    },
  },
  runtimeConfig: {
    youtubeDataApiKey: '',
    sessionSecret: '',
    /** SQLite の保存先。実際の解決は server/database/db.ts（NUXT_DB_PATH / NUXT_DB_DIR）が行う。 */
    databaseFile: process.env.NUXT_DB_PATH || './data/vocaloid.hz.db',
    ollamaUrl: 'http://localhost:11434/api/chat',
    ollamaModel: 'gemma3:4b',
    /** gemma を VRAM に載せておく時間。既定の '5m' は「使ってから 5 分でアイドル（アンロード）に戻る」 */
    ollamaKeepAlive: '5m',
    /** AI ラウンジで店主（gemma）がひとりごとを呟く間隔。既定は 2 分に 1 回（「店主さん」と呼ばれた返事はこの間隔を待たない） */
    loungeAiIntervalMs: 120_000,
    discordWebhookUrl: '',
    discordBotToken: '',
    discordChannelId: '',
    googleClientId: '',
    googleClientSecret: '',
    discordClientId: '',
    discordClientSecret: '',
    public: {
      siteName: 'vocaloid.hz',
      siteTagline: '好きなボカロを、読んで語れるボカれびゅサイト。',
    },
  },
  typescript: {
    strict: true,
  },
})
