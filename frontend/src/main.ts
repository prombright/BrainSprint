import { createApp } from 'vue'
import { createPinia } from 'pinia'
// font ships inside the app so it works offline
import '@fontsource/lexend/latin-400.css'
import '@fontsource/lexend/latin-600.css'
import '@fontsource/lexend/latin-700.css'
import './style.css'
import './lib/settings' // applies the chosen screen (light / dark) before the first paint
import App from './App.vue'
import { router } from './router'
import { setupNative } from './lib/native'
import { initMusic } from './lib/music'

createApp(App).use(createPinia()).use(router).mount('#app')
setupNative(router)
initMusic()
