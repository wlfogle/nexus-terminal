<template>
  <div class="terminal-view" ref="terminalContainer">
    <!-- Warp-style Block Output -->
    <div class="command-blocks" v-if="commandBlocks.length > 0">
      <CommandBlock 
        v-for="block in commandBlocks" 
        :key="block.id"
        :block="block"
        @ai-explain="handleAIExplain"
        @ai-improve="handleAIImprove"
      />
    </div>
    
    <!-- Terminal Instance -->
    <div class="xterm-container" ref="xtermContainer"></div>
    
    <!-- AI Suggestions Overlay -->
    <AICommandSuggestions 
      v-if="showSuggestions"
      :suggestions="suggestions"
      :position="suggestionPosition"
      @select="applySuggestion"
      @close="showSuggestions = false"
    />
    
    <!-- AI Error Analysis -->
    <AIErrorAnalysis
      v-if="showErrorAnalysis"
      :error="currentError"
      :command="currentCommand"
      @close="showErrorAnalysis = false"
      @apply-fix="applyErrorFix"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { SearchAddon } from 'xterm-addon-search'
import { CanvasAddon } from 'xterm-addon-canvas'

import { useTerminalStore } from '../stores/terminal'
import { useAIStore } from '../stores/ai'
import { useTerminal } from '../composables/useTerminal'

import CommandBlock from '../components/CommandBlock.vue'
import AICommandSuggestions from '../components/AICommandSuggestions.vue'
import AIErrorAnalysis from '../components/AIErrorAnalysis.vue'

import type { CommandBlock as CommandBlockType, AIError } from '../types'

// Props
const props = defineProps<{
  terminalId: string
}>()

// Stores
const terminalStore = useTerminalStore()
const aiStore = useAIStore()

// Refs
const terminalContainer = ref<HTMLDivElement>()
const xtermContainer = ref<HTMLDivElement>()

// Terminal composable
const { 
  terminal, 
  fitAddon, 
  createTerminal, 
  resizeTerminal,
  writeToTerminal,
  onTerminalData,
  onTerminalResize
} = useTerminal()

// State
const commandBlocks = ref<CommandBlockType[]>([])
const showSuggestions = ref(false)
const suggestions = ref<string[]>([])
const suggestionPosition = ref({ x: 0, y: 0 })
const showErrorAnalysis = ref(false)
const currentError = ref<AIError | null>(null)
const currentCommand = ref('')

// Current input tracking
let currentInput = ''
let inputStartCol = 0

onMounted(async () => {
  if (!xtermContainer.value) return
  
  // Create terminal instance
  await createTerminal(xtermContainer.value, {
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
    fontSize: 14,
    theme: {
      background: '#1a1a1a',
      foreground: '#ffffff',
      cursor: '#00ff00',
      selection: 'rgba(255, 255, 255, 0.3)',
      black: '#1a1a1a',
      red: '#ff6b6b',
      green: '#51cf66',
      yellow: '#ffd43b',
      blue: '#74c0fc',
      magenta: '#f06292',
      cyan: '#4dd0e1',
      white: '#ffffff',
    }
  })
  
  // Setup terminal event handlers
  setupTerminalHandlers()
  
  // Create backend terminal
  const terminalId = await terminalStore.createTerminal()
  
  // Focus terminal
  terminal.value?.focus()
})

function setupTerminalHandlers() {
  if (!terminal.value) return
  
  // Handle terminal data (user input)
  onTerminalData((data) => {
    handleTerminalInput(data)
  })
  
  // Handle terminal resize
  onTerminalResize(() => {
    if (terminal.value && fitAddon.value) {
      const { cols, rows } = terminal.value
      terminalStore.resizeTerminal(props.terminalId, cols, rows)
    }
  })
  
  // Handle output from backend
  terminalStore.$subscribe((mutation, state) => {
    const terminalOutput = state.terminalOutputs[props.terminalId]
    if (terminalOutput) {
      terminal.value?.write(terminalOutput)
      
      // Check for errors and suggest AI help
      checkForErrors(terminalOutput)
    }
  })
}

async function handleTerminalInput(data: string) {
  // Handle special keys
  if (data === '\r') { // Enter
    await executeCommand(currentInput)
    currentInput = ''
    inputStartCol = 0
    return
  }
  
  if (data === '\u007F') { // Backspace
    if (currentInput.length > 0) {
      currentInput = currentInput.slice(0, -1)
      terminal.value?.write('\b \b')
    }
    return
  }
  
  if (data === '\t') { // Tab - trigger AI completion
    await showAICompletion()
    return
  }
  
  if (data === '\x03') { // Ctrl+C
    currentInput = ''
    terminal.value?.write('^C\r\n')
    return
  }
  
  // Regular character input
  if (data >= ' ' && data <= '~') {
    currentInput += data
    terminal.value?.write(data)
    
    // Trigger real-time AI suggestions
    if (currentInput.length > 2) {
      debounceAISuggestions()
    }
  }
}

async function executeCommand(command: string) {
  if (!command.trim()) {
    terminal.value?.write('\r\n')
    return
  }
  
  currentCommand.value = command
  
  // Create command block
  const block: CommandBlockType = {
    id: Date.now().toString(),
    command: command.trim(),
    output: '',
    exitCode: 0,
    timestamp: new Date(),
    isRunning: true,
    aiSuggestions: []
  }
  
  commandBlocks.value.push(block)
  
  // Send command to backend
  await terminalStore.executeCommand(props.terminalId, command + '\r')
  
  // Get AI analysis in background
  analyzeCommandWithAI(block)
}

async function showAICompletion() {
  if (!currentInput.trim()) return
  
  // Get current terminal context
  const context = await getTerminalContext()
  
  try {
    const completions = await aiStore.completeCommand(currentInput, context)
    
    if (completions.length > 0) {
      suggestions.value = completions
      
      // Get cursor position for suggestions popup
      const rect = xtermContainer.value?.getBoundingClientRect()
      if (rect && terminal.value) {
        const cursor = terminal.value.buffer.active.cursorX
        const cellWidth = (rect.width / terminal.value.cols)
        
        suggestionPosition.value = {
          x: rect.left + (cursor * cellWidth),
          y: rect.top + 50
        }
      }
      
      showSuggestions.value = true
    }
  } catch (error) {
    console.error('AI completion error:', error)
  }
}

function debounceAISuggestions() {
  // Debounce AI suggestions to avoid too many requests
  clearTimeout((window as any).aiSuggestionTimeout)
  ;(window as any).aiSuggestionTimeout = setTimeout(showAICompletion, 500)
}

async function analyzeCommandWithAI(block: CommandBlockType) {
  try {
    const context = await getTerminalContext()
    const analysis = await aiStore.analyzeCommand(block.command, context)
    
    // Update block with AI suggestions
    block.aiSuggestions = analysis.suggestions || []
    
    // Check for potential issues
    if (analysis.warnings && analysis.warnings.length > 0) {
      // Show warnings to user
      console.warn('Command warnings:', analysis.warnings)
    }
  } catch (error) {
    console.error('AI analysis error:', error)
  }
}

function checkForErrors(output: string) {
  // Simple error detection patterns
  const errorPatterns = [
    /error:/i,
    /command not found/i,
    /permission denied/i,
    /no such file or directory/i,
    /syntax error/i,
    /failed/i
  ]
  
  const hasError = errorPatterns.some(pattern => pattern.test(output))
  
  if (hasError && currentCommand.value) {
    currentError.value = {
      command: currentCommand.value,
      output: output,
      suggestions: []
    }
    
    // Get AI error analysis
    getAIErrorAnalysis()
  }
}

async function getAIErrorAnalysis() {
  if (!currentError.value) return
  
  try {
    const analysis = await aiStore.explainError(
      currentError.value.output,
      currentError.value.command
    )
    
    currentError.value.explanation = analysis.explanation
    currentError.value.suggestions = analysis.suggestions
    
    showErrorAnalysis.value = true
  } catch (error) {
    console.error('AI error analysis failed:', error)
  }
}

async function getTerminalContext(): Promise<string> {
  const recentBlocks = commandBlocks.value.slice(-5)
  const context = recentBlocks.map(block => 
    `$ ${block.command}\n${block.output}`
  ).join('\n---\n')
  
  // Add current directory and git info if available
  const pwd = await terminalStore.getCurrentDirectory()
  const gitInfo = await terminalStore.getGitInfo()
  
  return `Current Directory: ${pwd}\nGit Info: ${gitInfo}\n\nRecent Commands:\n${context}`
}

function applySuggestion(suggestion: string) {
  // Clear current input
  while (currentInput.length > 0) {
    terminal.value?.write('\b \b')
    currentInput = currentInput.slice(0, -1)
  }
  
  // Apply suggestion
  currentInput = suggestion
  terminal.value?.write(suggestion)
  
  showSuggestions.value = false
}

function applyErrorFix(fix: string) {
  // Apply the AI-suggested fix
  currentInput = fix
  terminal.value?.write(`\r\n$ ${fix}`)
  showErrorAnalysis.value = false
}

function handleAIExplain(block: CommandBlockType) {
  // Open AI assistant with command explanation request
  aiStore.requestExplanation(block.command, block.output)
}

function handleAIImprove(block: CommandBlockType) {
  // Open AI assistant with improvement suggestions
  aiStore.requestImprovement(block.command, block.output)
}

onUnmounted(() => {
  terminal.value?.dispose()
  clearTimeout((window as any).aiSuggestionTimeout)
})
</script>

<style scoped>
.terminal-view {
  height: 100%;
  position: relative;
  overflow: hidden;
}

.command-blocks {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 200px;
  overflow-y: auto;
  z-index: 10;
  pointer-events: none;
}

.xterm-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

/* Custom xterm styles */
:deep(.xterm) {
  font-feature-settings: "liga" 0;
  position: relative;
  user-select: none;
  -ms-user-select: none;
  -webkit-user-select: none;
}

:deep(.xterm.focus),
:deep(.xterm:focus) {
  outline: none;
}

:deep(.xterm .xterm-helpers) {
  position: absolute;
  top: 0;
  z-index: 5;
}

:deep(.xterm .xterm-helper-textarea) {
  position: absolute;
  opacity: 0;
  left: -9999em;
  top: 0;
  width: 0;
  height: 0;
  z-index: -5;
  white-space: nowrap;
  overflow: hidden;
  resize: none;
}

:deep(.xterm .composition-view) {
  background: #000;
  color: #fff;
  display: none;
  position: absolute;
  white-space: nowrap;
  z-index: 1;
}

:deep(.xterm .composition-view.active) {
  display: block;
}

:deep(.xterm .xterm-viewport) {
  background-color: #000;
  overflow-y: scroll;
  cursor: default;
  position: absolute;
  right: 0;
  left: 0;
  top: 0;
  bottom: 0;
}

:deep(.xterm .xterm-screen) {
  position: relative;
}

:deep(.xterm .xterm-screen canvas) {
  position: absolute;
  left: 0;
  top: 0;
}

:deep(.xterm .xterm-scroll-area) {
  visibility: hidden;
}

:deep(.xterm-char-measure-element) {
  display: inline-block;
  visibility: hidden;
  position: absolute;
  top: 0;
  left: -9999em;
  line-height: normal;
}

:deep(.xterm.enable-mouse-events) {
  cursor: default;
}

:deep(.xterm.xterm-cursor-pointer) {
  cursor: pointer;
}

:deep(.xterm.column-select.focus) {
  cursor: crosshair;
}

:deep(.xterm .xterm-accessibility),
:deep(.xterm .xterm-message) {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
  z-index: 10;
  color: transparent;
}

:deep(.xterm .live-region) {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
</style>
