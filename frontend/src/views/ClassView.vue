<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TopBar from '../components/TopBar.vue'
import { LEVELS, SUBJECTS } from '../game/types'
import { api, type Homework } from '../lib/api'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const code = ref('')
const message = ref('')
const error = ref('')
const busy = ref(false)
const loaded = ref(false)

onMounted(async () => {
  await player.loadClasses()
  loaded.value = true
})

async function join() {
  error.value = message.value = ''
  busy.value = true
  try {
    await player.sync()
    if (!player.auth) throw new Error('Connect to the internet to join a class')
    const r = await api.joinClass(player.auth, code.value)
    player.classes = r.classes
    message.value = `You joined ${r.joined.name} (${r.joined.teacher})!`
    code.value = ''
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function leave(id: number, name: string) {
  if (!confirm(`Leave ${name}? Your teacher won't see your work any more.`)) return
  if (player.auth) player.classes = (await api.leaveClass(player.auth, id)).classes
}

const subjectLabel = (s: string) => SUBJECTS.find((x) => x.id === s)?.label ?? s
const what = (h: Homework) => (h.topic ? `Practise ${h.topic}` : `${LEVELS.find((l) => l.id === h.level)?.label ?? h.level} level sprint`)
const dueText = (d: string) => {
  const days = Math.round((new Date(d + 'T23:59:59').getTime() - Date.now()) / 864e5)
  return days < 0 ? 'overdue' : days === 0 ? 'due today' : days === 1 ? 'due tomorrow' : `due ${new Date(d).toLocaleDateString('en-GB', { weekday: 'long' })}`
}

function play(h: Homework) {
  router.push({ path: `/homework/${h.id}`, query: { subject: h.subject, ...(h.topic ? { topic: h.topic } : { level: h.level ?? 'medium' }), title: h.title } })
}
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar title="My Class" back="/" />

    <form class="rounded-3xl bg-white p-4 shadow-sm" @submit.prevent="join">
      <label for="class-code" class="mb-2 block text-lg font-semibold">Join a class</label>
      <p class="-mt-1 mb-2 text-sm text-ink/60">Your teacher gives you a 6-letter class code.</p>
      <div class="flex gap-2">
        <input
          id="class-code"
          v-model="code"
          maxlength="8"
          autocomplete="off"
          placeholder="Class code"
          class="min-w-0 flex-1 rounded-2xl border-2 border-ink/10 px-4 py-3 font-mono text-2xl tracking-widest uppercase outline-none focus:border-ocean"
        />
        <button type="submit" class="btn-chunky bg-ocean px-5 text-xl text-white" :disabled="busy || code.trim().length < 6">Join</button>
      </div>
      <p v-if="message" class="mt-2 font-semibold text-leaf">{{ message }}</p>
      <p v-if="error" class="mt-2 text-cherry">{{ error }}</p>
    </form>

    <p v-if="loaded && !player.classes.length" class="rounded-3xl bg-white p-6 text-center text-ink/60 shadow-sm">You're not in a class yet.</p>

    <section v-for="c in player.classes" :key="c.id" class="rounded-3xl bg-white p-4 shadow-sm">
      <div class="flex items-start justify-between gap-2">
        <div>
          <h2 class="text-xl font-bold">{{ c.name }}</h2>
          <p class="text-sm text-ink/60">{{ c.teacher }}</p>
        </div>
        <button class="text-sm text-ink/40 underline" @click="leave(c.id, c.name)">Leave</button>
      </div>

      <h3 class="mt-3 mb-2 font-semibold">Homework</h3>
      <p v-if="!c.homework.length" class="text-ink/60">No homework right now.</p>
      <ul class="space-y-2">
        <li v-for="h in c.homework" :key="h.id" class="flex items-center gap-3 rounded-2xl p-3" :class="h.done ? 'bg-leaf/10' : 'bg-cream'">
          <span class="text-2xl">{{ h.done ? '✅' : '📝' }}</span>
          <span class="min-w-0 flex-1">
            <span class="block font-semibold">{{ h.title }}</span>
            <span class="block text-sm text-ink/60">{{ subjectLabel(h.subject) }} · {{ what(h) }} · {{ dueText(h.due_on) }}</span>
            <span v-if="h.done" class="block text-sm font-semibold text-leaf">Done: {{ h.done.correct }}/{{ h.done.total }}</span>
          </span>
          <button class="btn-chunky shrink-0 px-4 py-2" :class="h.done ? 'bg-white' : 'bg-sprint text-white'" @click="play(h)">{{ h.done ? 'Again' : 'Start' }}</button>
        </li>
      </ul>
    </section>
  </main>
</template>
