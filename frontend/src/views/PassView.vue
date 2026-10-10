<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ParentGate from '../components/ParentGate.vue'
import TopBar from '../components/TopBar.vue'
import { FREE_SPRINTS_PER_DAY } from '../game/scoring'
import { usePlayer, type PassPlan } from '../stores/player'

// Prices are placeholders until the pricing is decided.
const PLANS: { id: PassPlan; label: string; price: number; note: string }[] = [
  { id: 'day', label: '1 Day', price: 500, note: 'Unlimited sprints today' },
  { id: 'week', label: '1 Week', price: 2500, note: 'Save 30%' },
  { id: 'month', label: '1 Month', price: 8000, note: 'Best value' },
]

const player = usePlayer()
const router = useRouter()
const isDev = import.meta.env.DEV

const chosen = ref<PassPlan | null>(null)
const gateOpen = ref(false)
const notice = ref('')

function choose(plan: PassPlan) {
  chosen.value = plan
  gateOpen.value = true
}

function afterGate() {
  gateOpen.value = false
  notice.value = 'Paying with MTN MoMo and Airtel Money is coming soon.'
}

function demoActivate() {
  if (!chosen.value) return
  player.activatePass(chosen.value)
  router.push('/')
}
</script>

<template>
  <main class="flex flex-1 flex-col">
    <TopBar title="🎟️ Sprint Pass" back="/" />

    <section v-if="player.hasPass" class="mb-4 rounded-3xl bg-leaf/15 p-4 text-center font-semibold text-leaf">
      ✅ Your pass is active until {{ new Date(player.state.pass!.expiresAt).toLocaleString() }}
    </section>
    <section v-else-if="!player.canPlay" class="mb-4 rounded-3xl bg-white p-5 text-center shadow-sm">
      <div class="text-5xl">😴</div>
      <h2 class="mt-2 text-2xl font-bold">That's all the free sprints for today!</h2>
      <p class="mt-1 text-ink/70">Come back tomorrow for {{ FREE_SPRINTS_PER_DAY }} more, or ask a grown-up about a Sprint Pass.</p>
    </section>
    <p v-else class="mb-4 text-center text-lg text-ink/70">Play as many sprints as you like with a pass.</p>

    <div class="flex flex-col gap-3">
      <button
        v-for="p in PLANS"
        :key="p.id"
        class="btn-chunky flex items-center justify-between bg-white p-4 text-left"
        :class="chosen === p.id ? 'ring-4 ring-ocean' : ''"
        @click="choose(p.id)"
      >
        <span>
          <span class="block text-2xl">{{ p.label }}</span>
          <span class="text-sm font-normal text-ink/60">{{ p.note }}</span>
        </span>
        <span class="text-2xl text-sprint">UGX {{ p.price.toLocaleString() }}</span>
      </button>
    </div>

    <p v-if="notice" class="mt-4 rounded-2xl bg-ocean/10 p-3 text-center text-ocean">{{ notice }}</p>
    <button v-if="notice && isDev" class="mt-3 text-sm text-ink/50 underline" @click="demoActivate">
      (Developer only) Activate this pass without paying
    </button>

    <p class="mt-auto pt-6 text-center text-sm text-ink/50">Only grown-ups can buy a pass. Points and badges are free for everyone.</p>

    <ParentGate v-if="gateOpen" @passed="afterGate" @cancel="gateOpen = false" />
  </main>
</template>
