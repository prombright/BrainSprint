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
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#fff8ec',
      showSpinner: false,
    },
  },
}

export default config
