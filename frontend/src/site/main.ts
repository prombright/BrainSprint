// The public landing page: live numbers and the contact form. No framework needed.
import '@fontsource/lexend/latin-400.css'
import '@fontsource/lexend/latin-600.css'
import '@fontsource/lexend/latin-700.css'
import '../style.css'

const API = import.meta.env.VITE_API_URL ?? '/brainsprint/api'

document.getElementById('year')!.textContent = String(new Date().getFullYear())

// numbers appear only once the API says there are enough players to be worth showing
fetch(`${API}/stats`)
  .then((r) => (r.ok ? r.json() : null))
  .then((s) => {
    if (!s?.show) return
    for (const key of ['players', 'questions', 'schools']) {
      const el = document.querySelector(`[data-stat="${key}"]`)
      if (el) el.textContent = Number(s[key]).toLocaleString()
    }
    document.getElementById('stats')!.classList.remove('hidden')
  })
  .catch(() => {})

const form = document.getElementById('contact') as HTMLFormElement
const msg = document.getElementById('contact-msg')!

function show(text: string, good: boolean) {
  msg.textContent = text
  msg.className = `mt-3 rounded-xl p-3 ${good ? 'bg-leaf/15 text-leaf' : 'bg-cherry/10 text-cherry'}`
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const data = Object.fromEntries(new FormData(form)) as Record<string, string>
  if (!data.name?.trim() || !data.phone?.trim()) return show('Please add your name and phone number.', false)
  const button = form.querySelector('button[type=submit]') as HTMLButtonElement
  button.disabled = true
  try {
    const r = await fetch(`${API}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.')
    form.reset()
    show('Thank you! We will call or message you soon. 🎉', true)
  } catch (err) {
    show(err instanceof TypeError ? 'No internet connection. Please try again.' : (err as Error).message, false)
  } finally {
    button.disabled = false
  }
})
