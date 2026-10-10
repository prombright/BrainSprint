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
  // Wi-Fi test builds only (npm run build:android-lan): the app talks to this computer over plain http,
  // which Android blocks unless the app itself is served over http and allows it
  ...(process.env.BSK_LAN_TEST ? { server: { androidScheme: 'http', cleartext: true } } : {}),
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#fff8ec',
      showSpinner: false,
    },
  },
}

export default config
