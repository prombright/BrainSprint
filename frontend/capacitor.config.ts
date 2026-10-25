import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // The app's permanent identity on the Play Store: it can't change after the first release.
  appId: 'com.brainsprint.kids',
  appName: 'BrainSprint Kids',
  webDir: 'dist',
  android: {
    // mobile money / API calls go over https in production
    allowMixedContent: false,
  },
  // Wi-Fi test builds only (npm run build:android-lan): the app may call this computer over plain http.
  // The app itself stays at https://localhost, so it is the same app to Android and an installed copy
  // updates in place, keeping the child's saved progress (which belongs to that address).
  ...(process.env.BSK_LAN_TEST ? { server: { cleartext: true }, android: { allowMixedContent: true } } : {}),
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#f4f7f5',
      showSpinner: false,
    },
  },
}

export default config
