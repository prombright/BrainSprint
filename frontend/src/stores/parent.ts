import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, type ChildReport, type Parent } from '../lib/api'
import { usePlayer } from './player'

const TOKEN_KEY = 'bsk:parent'

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage blocked: the parent stays signed in for this session only
  }
}

export const useParent = defineStore('parent', () => {
  const token = ref<string | null>(readToken())
  const parent = ref<Parent | null>(null)
  const children = ref<ChildReport[]>([])

  function signedIn(r: { token: string; parent: Parent }) {
    token.value = r.token
    parent.value = r.parent
    writeToken(r.token)
  }

  async function register(phone: string, pin: string, name: string) {
    signedIn(await api.parentRegister({ phone, pin, name }))
    await linkThisDevice()
    await refresh()
  }

  async function login(phone: string, pin: string) {
    signedIn(await api.parentLogin({ phone, pin }))
    await refresh()
  }

  async function logout() {
    if (token.value) await api.parentLogout(token.value).catch(() => {})
    token.value = null
    parent.value = null
    children.value = []
    writeToken(null)
  }

  /** Reloads the dashboard. Signs out if the session has expired. */
  async function refresh() {
    if (!token.value) return
    try {
      const r = await api.parentMe(token.value)
      parent.value = r.parent
      children.value = r.children
    } catch (e) {
      if ((e as { status?: number }).status === 401) await logout()
      else throw e
    }
  }

  /** Adds the child who plays on this device to the parent's account. */
  async function linkThisDevice() {
    const player = usePlayer()
    await player.sync()
    if (!token.value || !player.auth) throw new Error('Connect to the internet first')
    await api.linkChild(token.value, player.auth)
    if (player.state.summary) player.state.summary.has_parent = true
    await refresh()
  }

  async function unlink(playerId: number) {
    if (!token.value) return
    await api.unlinkChild(token.value, playerId)
    await refresh()
  }

  return { token, parent, children, register, login, logout, refresh, linkThisDevice, unlink }
})
