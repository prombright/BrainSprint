<script setup lang="ts">
// ⚡ Brain Power badge: shows how much is left and when the next one refills.
import { BRAIN_POWER_MAX } from '../game/scoring'
import { countdown } from '../lib/clock'
import { usePlayer } from '../stores/player'

const player = usePlayer()
</script>

<template>
  <div
    class="flex items-center gap-1 rounded-full px-3 py-1.5 text-lg font-bold shadow-[0_3px_0_rgb(0_0_0/0.15)]"
    :class="player.unlimitedPower ? 'bg-berry text-white' : player.power <= 5 ? 'bg-cherry text-white' : 'bg-ocean text-white'"
    :title="player.unlimitedPower ? 'Unlimited Brain Power' : `Brain Power ${player.power} of ${BRAIN_POWER_MAX}`"
  >
    ⚡
    <span v-if="player.unlimitedPower">∞</span>
    <span v-else class="tabular-nums">
      {{ player.power }}
      <span v-if="player.power < BRAIN_POWER_MAX" class="text-xs font-medium opacity-80">+1 in {{ countdown(player.nextPowerIn) }}</span>
    </span>
  </div>
</template>
