<script setup lang="ts">
// Friends are added only with a code shared in person: no searching for strangers.
import { onMounted, ref } from 'vue'
import AvatarBadge from '../components/AvatarBadge.vue'
import PlayerCardModal from '../components/PlayerCardModal.vue'
import TopBar from '../components/TopBar.vue'
import { activityLabel } from '../lib/activity'
import { api, type FriendsData } from '../lib/api'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const data = ref<FriendsData | null>(null)
const code = ref('')
const message = ref('')
const error = ref('')
const busy = ref(false)
const copied = ref(false)
const openId = ref<number | null>(null)

async function auth() {
  await player.sync()
  if (!player.auth) throw new Error('Connect to the internet to see your friends')
  return player.auth
}

onMounted(async () => {
  try {
    data.value = await api.friends(await auth())
  } catch (e) {
    error.value = (e as Error).message
  }
})

async function add() {
  error.value = message.value = ''
  busy.value = true
  try {
    data.value = await api.addFriend(await auth(), code.value)
    message.value = `🎉 ${data.value.added} is now your friend!`
    code.value = ''
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function remove(id: number, name: string) {
  if (!confirm(`Remove ${name} from your friends?`)) return
  data.value = await api.removeFriend(await auth(), id)
}

async function share() {
  const text = `Be my friend on BrainSprint Kids! My code is ${data.value!.code}`
  try {
    if (navigator.share) await navigator.share({ text })
    else {
      await navigator.clipboard.writeText(data.value!.code)
      copied.value = true
      setTimeout(() => (copied.value = false), 2000)
    }
  } catch {
    // share sheet closed
  }
}
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar title="👫 Friends" back="/" />

    <p v-if="error && !data" class="rounded-3xl bg-white p-6 text-center text-ink/70 shadow-sm">📶 {{ error }}</p>

    <template v-if="data">
      <section class="rounded-3xl bg-ink p-5 text-center text-white">
        <p class="opacity-80">My friend code</p>
        <p class="my-1 font-mono text-5xl font-bold tracking-[0.2em]">{{ data.code }}</p>
        <p class="text-sm opacity-70">Tell it to a friend you know, so they can add you.</p>
        <button class="btn-chunky mt-3 bg-sun px-6 py-2 text-lg text-ink" @click="share">{{ copied ? 'Copied ✓' : '📤 Share my code' }}</button>
      </section>

      <form class="rounded-3xl bg-white p-4 shadow-sm" @submit.prevent="add">
        <label class="mb-2 block text-lg font-semibold" for="code">Add a friend</label>
        <div class="flex gap-2">
          <input
            id="code"
            v-model="code"
            maxlength="8"
            autocomplete="off"
            placeholder="Their code"
            class="min-w-0 flex-1 rounded-2xl border-2 border-ink/10 px-4 py-3 font-mono text-2xl tracking-widest uppercase outline-none focus:border-ocean"
          />
          <button type="submit" class="btn-chunky bg-ocean px-5 text-xl text-white" :disabled="busy || code.trim().length < 6">Add</button>
        </div>
        <p v-if="message" class="mt-2 font-semibold text-leaf">{{ message }}</p>
        <p v-if="error" class="mt-2 text-cherry">{{ error }}</p>
      </form>

      <section class="rounded-3xl bg-white p-4 shadow-sm">
        <h2 class="mb-2 text-xl font-bold">This week among friends</h2>
        <p v-if="!data.friends.length" class="text-ink/60">No friends yet. Share your code with a classmate or cousin!</p>
        <ol class="space-y-2">
          <li v-for="(f, i) in data.friends" :key="f.id" class="flex items-center gap-3 rounded-2xl bg-cream px-3 py-2">
            <span class="w-6 text-center font-bold">{{ i + 1 }}</span>
            <button class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="openId = f.id">
              <AvatarBadge :avatar="f.avatar" :xp="f.xp_total" :online="f.online" size="sm" />
              <span class="min-w-0">
                <span class="block truncate font-semibold">{{ f.name }} <span v-if="f.day_streak" class="text-sm text-sprint">🔥{{ f.day_streak }}</span></span>
                <span class="block truncate text-xs text-ink/60">{{ f.online ? `🟢 ${activityLabel(f.activity) || 'Online now'}` : f.grade }}</span>
              </span>
            </button>
            <span class="font-bold tabular-nums">{{ f.week_xp.toLocaleString() }} <span class="text-xs font-medium text-ink/50">XP</span></span>
            <button class="px-1 text-ink/30" :aria-label="`Remove ${f.name}`" @click="remove(f.id, f.name)">✕</button>
          </li>
        </ol>
        <p v-if="data.friends.length" class="mt-2 text-center text-sm text-ink/50">Tap a friend to race them 🏁</p>
      </section>
    </template>

    <PlayerCardModal v-if="openId" :player-id="openId" @close="openId = null" />
  </main>
</template>
