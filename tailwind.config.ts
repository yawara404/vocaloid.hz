import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

/**
 * tailwind.config.ts
 * ---------------------------------------------------------------
 * 色は assets/css/main.css の CSS カスタムプロパティ（RGB 3値）を参照する。
 * `rgb(var(--token) / <alpha-value>)` にしておくと `bg-ink-900/70` のような
 * 不透明度つきユーティリティもそのまま使え、テーマ（ライト / ダーク）で
 * 値だけが入れ替わる。
 *
 *   ink / hz / glow / stone … 既存クラス用のランプ（テーマで明暗が反転）
 *   canvas / surface / subtle / sunken / line / content / muted /
 *   faint / primary / action … セマンティックトークン（新規実装はこちら）
 */
const token = (name: string) => `rgb(var(${name}) / <alpha-value>)`

const ramp = (prefix: string, keys: readonly (string | number)[]) =>
  Object.fromEntries(keys.map(key => [key, token(`--${prefix}-${key}`)]))

export default <Partial<Config>>{
  content: [],
  theme: {
    extend: {
      colors: {
        ink: ramp('ink', [950, 900, 850, 800, 750, 700, 600, 500]),
        hz: ramp('hz', [50, 100, 200, 300, 400, 500, 600, 700]),
        glow: ramp('glow', [300, 400, 500, 600, 700]),
        // Tailwind 標準の stone は、テーマに連動するニュートラルランプとして上書きする
        stone: ramp('stone', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),

        // --- セマンティックトークン（用途で選ぶ色） ---
        canvas: token('--color-bg-base'),          // ページ全体の背景
        surface: token('--color-bg-surface'),      // カード・ヘッダー
        subtle: token('--color-bg-subtle'),        // 検索窓・タグ・インラインコード
        sunken: token('--color-bg-sunken'),        // メーターの空きなど沈んだ面
        line: token('--color-border'),             // 既定の枠線・区切り線
        'line-strong': token('--color-border-strong'),
        content: token('--color-text-main'),       // 見出し・本文の基本
        muted: token('--color-text-muted'),        // メタ情報・日付・執筆者
        faint: token('--color-text-faint'),        // プレースホルダー・補助
        primary: token('--color-primary'),         // 水色（文字・アイコン・フォーカス）
        'primary-strong': token('--color-primary-strong'),
        action: token('--color-action'),           // ボタンの塗り
        'action-hover': token('--color-action-hover'),
        'action-text': token('--color-action-text'),
        scrim: 'var(--scrim)',                     // モーダルの背景幕
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        bar: 'var(--shadow-bar)',
        ribbon: 'var(--shadow-ribbon)',
        player: 'var(--shadow-player)',
        modal: 'var(--shadow-modal)',
      },
      /**
       * Z 軸の一元管理（LAYOUT_ARCHITECTURE §1.2）。
       * 固定要素同士が干渉しないよう、重なり順は必ずこのトークンで指定する。
       *   z-sticky  10 … 目次・追従サイドバーなど（ヘッダーの下）
       *   z-header  30 … AppHeader（最上部固定）
       *   z-dropdown 40 … ヘッダーから開くメニュー
       *   z-bar     50 … PlaybackBar（画面最下部固定）
       *   z-sheet   60 … モバイルのボトムシート / 目次ドロワー
       *   z-modal   70 … 全画面モーダル（ヘルプ等）
       */
      zIndex: {
        sticky: '10',
        header: '30',
        dropdown: '40',
        bar: '50',
        sheet: '60',
        modal: '70',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Hiragino Kaku Gothic ProN',
          'Yu Gothic UI',
          'Meiryo',
          'sans-serif',
        ],
        serif: [
          'Hiragino Mincho ProN',
          'Yu Mincho',
          'YuMincho',
          'Noto Serif JP',
          'Georgia',
          'serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        jp: '0.03em',
      },
      maxWidth: {
        article: '720px',
      },
      typography: () => ({
        hz: {
          css: {
            '--tw-prose-body': 'rgb(var(--color-text-body))',
            '--tw-prose-headings': 'rgb(var(--color-text-main))',
            '--tw-prose-lead': 'rgb(var(--color-text-muted))',
            '--tw-prose-links': 'rgb(var(--color-primary))',
            '--tw-prose-bold': 'rgb(var(--color-text-main))',
            '--tw-prose-counters': 'rgb(var(--color-text-faint))',
            '--tw-prose-bullets': 'rgb(var(--color-primary))',
            '--tw-prose-hr': 'rgb(var(--color-border))',
            '--tw-prose-quotes': 'rgb(var(--color-text-main))',
            '--tw-prose-quote-borders': 'rgb(var(--color-primary))',
            '--tw-prose-captions': 'rgb(var(--color-text-muted))',
            '--tw-prose-code': 'rgb(var(--glow-300))',
            '--tw-prose-pre-code': 'rgb(var(--color-text-body))',
            '--tw-prose-pre-bg': 'rgb(var(--color-bg-code))',
            '--tw-prose-th-borders': 'rgb(var(--color-border-strong))',
            '--tw-prose-td-borders': 'rgb(var(--color-border))',
            fontSize: '1.0625rem',
            lineHeight: '1.85',
            letterSpacing: '0.03em',
            p: {
              marginTop: '1.5em',
              marginBottom: '1.5em',
            },
            h2: {
              fontFamily: 'Hiragino Kaku Gothic ProN, Yu Gothic UI, Meiryo, sans-serif',
              fontWeight: '700',
              letterSpacing: '0.02em',
              marginTop: '2.4em',
              marginBottom: '1em',
              borderLeft: '3px solid rgb(var(--color-primary))',
              paddingLeft: '0.75em',
            },
            h3: {
              fontFamily: 'Hiragino Kaku Gothic ProN, Yu Gothic UI, Meiryo, sans-serif',
              fontWeight: '700',
              marginTop: '2em',
              marginBottom: '0.8em',
            },
            blockquote: {
              fontStyle: 'normal',
              fontWeight: '400',
            },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after': { content: 'none' },
            a: {
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              textDecorationColor: 'rgb(var(--color-primary) / 0.35)',
              '&:hover': { color: 'rgb(var(--color-primary-strong))' },
            },
            img: {
              borderRadius: '0.5rem',
              border: '1px solid rgb(var(--color-border))',
            },
            code: {
              fontWeight: '500',
            },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
          },
        },
      }),
    },
  },
  plugins: [typography],
}
