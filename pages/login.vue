<script setup lang="ts">
/**
 * pages/login.vue
 * ログイン / 新規登録（cookie ベースの自前認証 + Google / Discord OAuth）
 */
import { useAuthStore } from '~~/stores/auth'

const route = useRoute()
const auth = useAuthStore()

const mode = ref<'login' | 'register'>(route.query.mode === 'register' ? 'register' : 'login')

const form = reactive({
  identifier: '',
  email: '',
  username: '',
  displayName: '',
  password: '',
})

const message = ref<string | null>(null)

const nextPath = computed(() => {
  const value = route.query.next
  return typeof value === 'string' && value.startsWith('/') ? value : '/'
})

const isDemoCookie = computed(() => {
  const config = useRuntimeConfig()
  return (config.public.sessionCookieName as string) === 'vocaloid_hz_session'
})

function switchMode(nextMode: 'login' | 'register'): void {
  mode.value = nextMode
  message.value = null
  auth.error = null
}

async function onSubmit(): Promise<void> {
  message.value = null

  const succeeded = mode.value === 'login'
    ? await auth.login(form.identifier.trim(), form.password)
    : await auth.register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim() || undefined,
      })

  if (!succeeded) {
    message.value = auth.error
    return
  }

  await navigateTo(nextPath.value)
}

onMounted(() => {
  auth.fetchSession()
})

useSeoMeta({
  title: 'ログイン / 新規登録',
  description: 'vocaloid.hz にログイン、または新規登録してボカロのレビューを書けます。',
})
</script>

<template>
  <div class="mx-auto max-w-xl">
    <header class="text-center">
      <h1 class="section-title !text-lg">
        {{ mode === 'login' ? 'ログイン' : '新規登録' }}
      </h1>
      <p class="mt-2 text-[12.5px] text-stone-400">
        登録すると、好きなボカロのレビューを書いたり編集したりできます。
      </p>
    </header>

    <div class="panel mt-6 p-5 sm:p-6">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="chip"
          :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': mode === 'login' }"
          @click="switchMode('login')"
        >
          ログイン
        </button>
        <button
          type="button"
          class="chip"
          :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': mode === 'register' }"
          @click="switchMode('register')"
        >
          新規登録
        </button>
      </div>

      <form class="mt-5 space-y-4" @submit.prevent="onSubmit">
        <template v-if="mode === 'login'">
          <label class="block">
            <span class="panel-title">ユーザー名 または メール</span>
            <input v-model="form.identifier" type="text" class="field mt-1.5" autocomplete="username" required>
          </label>
        </template>

        <template v-else>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="panel-title">ユーザー名</span>
              <input
                v-model="form.username"
                type="text"
                class="field mt-1.5"
                placeholder="3〜32字（a-z 0-9 _ .）"
                autocomplete="username"
                required
              >
            </label>

            <label class="block">
              <span class="panel-title">表示名（任意）</span>
              <input v-model="form.displayName" type="text" class="field mt-1.5" placeholder="レビューに出す名前">
            </label>
          </div>

          <label class="block">
            <span class="panel-title">メールアドレス</span>
            <input v-model="form.email" type="email" class="field mt-1.5" autocomplete="email" required>
          </label>
        </template>

        <label class="block">
          <span class="panel-title">パスワード</span>
          <input
            v-model="form.password"
            type="password"
            class="field mt-1.5"
            :minlength="mode === 'register' ? 8 : undefined"
            :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
            required
          >
        </label>

        <p v-if="message" class="text-[12px] text-glow-300">
          {{ message }}
        </p>

        <button type="submit" class="btn-primary w-full" :disabled="auth.pending">
          {{ auth.pending ? '処理中…' : (mode === 'login' ? 'ログインする' : 'この内容で登録する') }}
        </button>
      </form>

      <div v-if="auth.providers.google || auth.providers.discord" class="mt-6 border-t border-ink-800 pt-5">
        <p class="panel-title">
          SNS でログイン
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <a v-if="auth.providers.google" href="/api/auth/oauth/google" class="btn-ghost">
            Google でログイン
          </a>
          <a v-if="auth.providers.discord" href="/api/auth/oauth/discord" class="btn-ghost">
            Discord でログイン
          </a>
        </div>
      </div>

      <p v-if="isDemoCookie && mode === 'login'" class="mt-5 text-[11.5px] leading-relaxed text-stone-400">
        デモ用ログイン：<code class="font-mono text-stone-400">demo</code> /
        <code class="font-mono text-stone-400">vocaloid.hz</code>
      </p>
    </div>
  </div>
</template>
