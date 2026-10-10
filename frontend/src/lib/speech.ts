// Read questions aloud so children who can't read yet can still play.
import { settings } from './settings'

let voice: SpeechSynthesisVoice | null = null

function chooseVoice() {
  if (!('speechSynthesis' in window)) return
  const voices = speechSynthesis.getVoices()
  voice =
    voices.find((v) => v.lang === 'en-GB') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null
}

if ('speechSynthesis' in window) {
  chooseVoice()
  speechSynthesis.addEventListener?.('voiceschanged', chooseVoice)
}


export const canSpeak = () => 'speechSynthesis' in window && settings.readAloud !== 'off'

export function speak(text: string) {
  if (!canSpeak()) return
  speechSynthesis.cancel()
  // read symbols the way a teacher would
  const said = text.replace(/☐/g, 'what number').replace(/−/g, ' minus ').replace(/×/g, ' times ').replace(/÷/g, ' divided by ')
  const u = new SpeechSynthesisUtterance(said)
  if (voice) u.voice = voice
  u.rate = settings.voiceSpeed === 'slow' ? 0.7 : 0.9
  u.pitch = 1.1
  speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel()
}
