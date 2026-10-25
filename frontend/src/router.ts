import { createRouter, createWebHashHistory } from 'vue-router'
import { usePlayer } from './stores/player'
import { PAYWALL_ENABLED } from './game/scoring'

declare module 'vue-router' {
  interface RouteMeta {
    // focus: no navigation (sign-up, sprints) · wide: uses the full width on laptops
    layout?: 'focus' | 'wide'
  }
}

// Hash history works the same on the web and inside the Capacitor mobile shell.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./views/HomeView.vue'), meta: { layout: 'wide' } },
    { path: '/welcome', name: 'welcome', component: () => import('./views/WelcomeView.vue'), meta: { layout: 'focus' } },
    { path: '/subject/:subject', name: 'levels', component: () => import('./views/LevelsView.vue') },
    { path: '/sprint/:subject/:grade/:level', name: 'sprint', component: () => import('./views/SprintView.vue'), meta: { layout: 'focus' } },
    { path: '/result', name: 'result', component: () => import('./views/ResultView.vue') },
    { path: '/badges', name: 'badges', component: () => import('./views/BadgesView.vue'), meta: { layout: 'wide' } },
    { path: '/pass', name: 'pass', component: () => import('./views/PassView.vue') },
    { path: '/power', name: 'power', component: () => import('./views/PowerView.vue') },
    { path: '/league', name: 'league', component: () => import('./views/LeagueView.vue') },
    { path: '/parent', name: 'parent', component: () => import('./views/ParentView.vue') },
    { path: '/profile', name: 'profile', component: () => import('./views/ProfileView.vue') },
    { path: '/friends', name: 'friends', component: () => import('./views/FriendsView.vue') },
    { path: '/school', name: 'school', component: () => import('./views/SchoolView.vue'), meta: { layout: 'wide' } },
    { path: '/boss', name: 'boss', component: () => import('./views/BossView.vue') },
    { path: '/homework/:id', name: 'homework', component: () => import('./views/SprintView.vue'), meta: { layout: 'focus' } },
    { path: '/class', name: 'class', component: () => import('./views/ClassView.vue') },
    { path: '/mock', name: 'mock', component: () => import('./views/MockView.vue') },
    { path: '/mock/exam', name: 'mock-exam', component: () => import('./views/MockExamView.vue'), meta: { layout: 'focus' } },
    { path: '/practice', name: 'practice', component: () => import('./views/SprintView.vue'), meta: { layout: 'focus' } },
    { path: '/progress', name: 'progress', component: () => import('./views/ProgressView.vue'), meta: { layout: 'wide' } },
    { path: '/boss/fight', name: 'boss-fight', component: () => import('./views/SprintView.vue'), meta: { layout: 'focus' } },
    { path: '/compete', name: 'compete', component: () => import('./views/CompeteView.vue') },
    { path: '/compete/duels', name: 'duels', component: () => import('./views/DuelsView.vue') },
    { path: '/compete/schools', name: 'school-contests', component: () => import('./views/SchoolContestsView.vue') },
    { path: '/compete/play/:kind(contests|duels|weekly)/:id', name: 'paper', component: () => import('./views/PaperView.vue'), meta: { layout: 'focus' } },
    { path: '/compete/:kind(contests|duels|weekly)/:id', name: 'compete-result', component: () => import('./views/CompeteResultView.vue') },
    { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const player = usePlayer()
  if (!player.profile && to.name !== 'welcome') return { name: 'welcome' }
  if (to.name === 'pass' && !PAYWALL_ENABLED) return { name: 'home' }
  const playing = ['sprint', 'boss-fight', 'practice', 'homework'].includes(String(to.name))
  if (playing && player.outOfPower) return { name: 'power' }
  if (playing && !player.canPlay) return { name: 'pass' }
})
