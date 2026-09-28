/**
 * stores/auth.ts
 * セッション状態（cookie ベースの自前認証）を扱う Pinia ストア。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AuthUserDto, ProvidersResponse } from '~~/shared/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUserDto | null>(null)
  const providers = ref<ProvidersResponse>({ password: true, google: false, discord: false })
  const initialized = ref(false)
  const pending = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => Boolean(user.value))

  async function fetchSession(force = false): Promise<void> {
    if (initialized.value && !force) return
    try {
      const [session, providerList] = await Promise.all([
        $fetch<{ user: AuthUserDto | null }>('/api/auth/session'),
        $fetch<ProvidersResponse>('/api/auth/providers'),
      ])
      user.value = session.user
      providers.value = providerList
    }
    catch {
      user.value = null
    }
    finally {
      initialized.value = true
    }
  }

  async function login(identifier: string, password: string): Promise<boolean> {
    pending.value = true
    error.value = null
    try {
      const result = await $fetch<{ user: AuthUserDto }>('/api/auth/login', {
        method: 'POST',
        body: { identifier, password },
      })
      user.value = result.user
      return true
    }
    catch (err: any) {
      error.value = err?.data?.message || 'ログインに失敗しました'
      return false
    }
    finally {
      pending.value = false
    }
  }

  async function register(payload: {
    username: string
    email: string
    password: string
    displayName?: string
  }): Promise<boolean> {
    pending.value = true
    error.value = null
    try {
      const result = await $fetch<{ user: AuthUserDto }>('/api/auth/register', {
        method: 'POST',
        body: payload,
      })
      user.value = result.user
      return true
    }
    catch (err: any) {
      error.value = err?.data?.message || '登録に失敗しました'
      return false
    }
    finally {
      pending.value = false
    }
  }

  async function logout(): Promise<void> {
    pending.value = true
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    }
    finally {
      user.value = null
      pending.value = false
    }
  }

  return {
    user,
    providers,
    initialized,
    pending,
    error,
    isAuthenticated,
    fetchSession,
    login,
    register,
    logout,
  }
})
