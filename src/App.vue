<template>
  <div class="warpai-terminal" :class="{ 'theme-dark': isDark, 'theme-light': !isDark }">
    <!-- Title Bar -->
    <TitleBar v-if="config.appearance.show_title_bar" />
    
    <!-- Main Layout -->
    <div class="main-layout">
      <!-- AI Command Palette (Ctrl+Shift+P) -->
      <CommandPalette v-if="showCommandPalette" @close="showCommandPalette = false" />
      
      <!-- AI Chat Sidebar (Ctrl+Shift+A) -->
      <AIAssistantPanel 
        v-if="showAIAssistant" 
        @close="showAIAssistant = false"
        class="ai-panel"
      />
      
      <!-- Terminal Area -->
      <div class="terminal-container" :class="{ 'with-ai-panel': showAIAssistant }">
        <!-- Terminal Tabs -->
        <TerminalTabs />
        
        <!-- Terminal Content -->
        <div class="terminal-content">
          <router-view />
        </div>
      </div>
      
      <!-- AI Features Dock -->
      <AIFeaturesDock class="ai-dock" />
    </div>
    
    <!-- Status Bar -->
    <StatusBar />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useConfigStore } from './stores/config'
import { useUIStore } from './stores/ui'
import { useShortcuts } from './composables/useShortcuts'

import TitleBar from './components/TitleBar.vue'
import CommandPalette from './components/CommandPalette.vue'
import AIAssistantPanel from './components/AIAssistantPanel.vue'
import TerminalTabs from './components/TerminalTabs.vue'
import AIFeaturesDock from './components/AIFeaturesDock.vue'
import StatusBar from './components/StatusBar.vue'

// Stores
const configStore = useConfigStore()
const uiStore = useUIStore()

// Reactive refs
const config = configStore.config
const isDark = ref(config.appearance.theme === 'dark')
const showCommandPalette = ref(false)
const showAIAssistant = ref(false)

// Keyboard shortcuts
const shortcuts = useShortcuts()

onMounted(() => {
  // Initialize shortcuts
  shortcuts.register('Ctrl+Shift+P', () => {
    showCommandPalette.value = !showCommandPalette.value
  })
  
  shortcuts.register('Ctrl+Shift+A', () => {
    showAIAssistant.value = !showAIAssistant.value
  })
  
  shortcuts.register('Escape', () => {
    showCommandPalette.value = false
    showAIAssistant.value = false
  })
  
  // Load configuration
  configStore.loadConfig()
})

onUnmounted(() => {
  shortcuts.cleanup()
})
</script>

<style scoped>
.warpai-terminal {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;
}

.theme-dark {
  background: #1a1a1a;
  color: #ffffff;
}

.theme-light {
  background: #ffffff;
  color: #000000;
}

.main-layout {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

.terminal-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.terminal-container.with-ai-panel {
  margin-right: 400px;
}

.terminal-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.ai-panel {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 400px;
  z-index: 100;
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.ai-dock {
  position: fixed;
  bottom: 60px;
  right: 20px;
  z-index: 50;
}
</style>
