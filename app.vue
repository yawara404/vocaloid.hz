<script setup lang="ts">
/**
 * app.vue
 * ルート（全ページ共通）。ここでアプリ全体の head を足す。
 *
 * Google Search Console の「HTML タグ」による所有権確認は、
 * トップページの HTML に
 *   <meta name="google-site-verification" content="...">
 * が入っているかで判定される（リダイレクトは追跡されるため、サブパス配信でも使える）。
 *
 * content の値は env で渡す（値は Search Console の「HTML タグ」に表示される文字列）:
 *   .env:  NUXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<content の値>
 * 未設定なら meta タグを出さない（確認用タグを他の環境に残さないため）。
 */
const config = useRuntimeConfig()
const googleSiteVerification = config.public.googleSiteVerification as string

if (googleSiteVerification) {
  useHead({
    meta: [{ name: 'google-site-verification', content: googleSiteVerification }],
  })
}
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

