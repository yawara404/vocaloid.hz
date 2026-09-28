import { review as hiiragiMagnetite } from './content/05-hiiragi-magnetite'
import { review as yoidoreShirazu } from './content/06-yoidore-shirazu'
import { review as unhappyRefrain } from './content/07-unhappy-refrain'
import { review as king } from './content/04-king'
import { review as mesmerizer } from './content/03-mesmerizer'
import { review as senbonzakura } from './content/02-senbonzakura'
import { review as tellYourWorld } from './content/01-tell-your-world'
import type { SeedReview } from './seed-types'

export interface SeedUser {
  username: string
  displayName: string
  email: string
  /** プレーンパスワード。seed 時にハッシュ化する */
  password: string
  bio: string
  provider?: string
}

/**
 * デモユーザーの共通パスワード。
 * リポジトリには公開デモ用の既定値を置いておき、本番で seed するときは
 * NUXT_SEED_PASSWORD で上書きする（初回起動時の seed にのみ使われる）。
 */
const DEMO_PASSWORD = process.env.NUXT_SEED_PASSWORD || 'vocaloid.hz'

export const seedUsers: SeedUser[] = [
  {
    username: 'kiritzubo',
    displayName: '霧坪 しずか',
    email: 'kiritzubo@vocaloid.hz',
    password: DEMO_PASSWORD,
    bio: '歌詞と物語構造を読む係。語感派。',
  },
  {
    username: 'amane',
    displayName: '天音ソラ',
    email: 'amane@vocaloid.hz',
    password: DEMO_PASSWORD,
    bio: '調声と音響設計の話しかしない。ブレスの位置で三晩眠れる。',
  },
  {
    username: 'shirogane',
    displayName: '白銀レコード',
    email: 'shirogane@vocaloid.hz',
    password: DEMO_PASSWORD,
    bio: 'アルバム単位で聴く派。曲順を信用している。',
  },
  {
    username: 'demo',
    displayName: 'デモ批評家',
    email: 'demo@vocaloid.hz',
    password: DEMO_PASSWORD,
    bio: 'デモ用アカウント。ログインは demo / 既定パスワード（README 参照）。',
  },
]

/** 公開順（古い順）に並べた批評データ */
export const seedReviews: SeedReview[] = [
  unhappyRefrain,
  tellYourWorld,
  senbonzakura,
  king,
  mesmerizer,
  hiiragiMagnetite,
  yoidoreShirazu,
]
