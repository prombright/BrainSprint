import { createApp } from 'vue'
import '@fontsource/lexend/latin-400.css'
import '@fontsource/lexend/latin-600.css'
import '@fontsource/lexend/latin-700.css'
import '../style.css'
import '../lib/settings' // applies the chosen screen (light / dark) before the first paint
import TeacherApp from './TeacherApp.vue'

createApp(TeacherApp).mount('#teacher')
