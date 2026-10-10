// Sound, music and read-aloud preferences, saved on this device.
import { reactive, watch } from 'vue'

export interface Settings {
  sound: boolean // correct / wrong / finish sound effects
  music: boolean // soft background music on the menus
  readAloud: 'always' | 'young' | 'tap' | 'off' // when questions are read out
  voiceSpeed: 'slow' | 'normal'
}

const KEY = 'bsk:settings'
const defaults: Settings = { sound: true, music: false, readAloud: 'young', voiceSpeed: 'normal' }

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

/** Should questions in this class be read out without tapping 🔊? */
export const autoReadFor = (grade: string) => settings.readAloud === 'always' || (settings.readAloud === 'young' && (grade === 'TOP' || grade === 'P1'))
