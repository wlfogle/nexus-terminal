import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'

import App from './App.vue'
import { routes } from './router'
import './style.css'

// Create Vue app
const app = createApp(App)

// Create Pinia store
const pinia = createPinia()

// Create Vue Router
const router = createRouter({
  history: createWebHistory(),
  routes
})

// Use plugins
app.use(pinia)
app.use(router)

// Mount app
app.mount('#app')
