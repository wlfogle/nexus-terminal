import type { RouteRecordRaw } from 'vue-router'
import TerminalView from '../views/TerminalView.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    redirect: '/terminal/default'
  },
  {
    path: '/terminal/:terminalId',
    name: 'terminal',
    component: TerminalView,
    props: true
  }
]
