// Sound, music, read-aloud, screen and data preferences, saved on this device.
import { reactive, watch } from 'vue'

export interface Settings {
  sound: boolean // correct / wrong / finish sound effects
  music: boolean // soft background music on the menus
  readAloud: 'always' | 'young' | 'tap' | 'off' // when questions are read out
  voiceSpeed: 'slow' | 'normal'
  theme: 'auto' | 'light' | 'dark' // auto follows the phone's own setting
  dataSaver: boolean // fewer background updates on paid mobile data
}

const KEY = 'bsk:settings'
// phones with the system's "data saver" on start with ours on too
const systemSaveData = typeof navigator !== 'undefined' && !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
const defaults: Settings = { sound: true, music: false, readAloud: 'young', voiceSpeed: 'normal', theme: 'auto', dataSaver: systemSaveData }

function load(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...defaults }
  }
}

export const settings = reactive<Settings>(load())

watch(settings, (s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage blocked: settings last for this session only
  }
})

// ---------- dark screen ----------
const darkQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
function applyTheme() {
  const dark = settings.theme === 'dark' || (settings.theme === 'auto' && !!darkQuery?.matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0d0b' : '#16a34a')
}
if (typeof document !== 'undefined') {
  applyTheme()
  watch(() => settings.theme, applyTheme)
  darkQuery?.addEventListener('change', applyTheme)
}

// ---------- data saver ----------
/** How often background things may refresh: much less often with data saver on. */
export const refreshEvery = (normalMs: number, saverMs: number) => (settings.dataSaver ? saverMs : normalMs)

/** Should questions in this class be read out without tapping 🔊? */
export const autoReadFor = (grade: string) => settings.readAloud === 'always' || (settings.readAloud === 'young' && (grade === 'TOP' || grade === 'P1'))
