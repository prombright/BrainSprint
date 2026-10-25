import { createApp } from 'vue'
import '@fontsource/fredoka/latin-400.css'
import '@fontsource/fredoka/latin-600.css'
import '../style.css'
import '../lib/settings' // applies the chosen screen (light / dark) before the first paint
import TeacherApp from './TeacherApp.vue'

createApp(TeacherApp).mount('#teacher')
