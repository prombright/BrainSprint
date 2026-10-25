// Phone-only behaviour when running inside the Android app. Does nothing on the web.
import { Capacitor } from '@capacitor/core'
import type { Router } from 'vue-router'

export async function setupNative(router: Router) {
  if (!Capacitor.isNativePlatform()) return

  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ])

  StatusBar.setStyle({ style: Style.Light }).catch(() => {})
  StatusBar.setBackgroundColor({ color: '#f4f7f5' }).catch(() => {})

  // Android back button: go back a screen; on the home screen, close the app.
  App.addListener('backButton', () => {
    const name = router.currentRoute.value.name
    if (name === 'home' || name === 'welcome') App.exitApp()
    else if (name === 'sprint' || name === 'result') router.push('/')
    else router.back()
  })

  await router.isReady()
  SplashScreen.hide().catch(() => {})
}
