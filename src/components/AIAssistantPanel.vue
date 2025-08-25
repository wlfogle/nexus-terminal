<template>
  <div class="ai-assistant-panel">
    <!-- Header -->
    <div class="ai-header">
      <div class="ai-header-title">
        <div class="ai-avatar">🤖</div>
        <div>
          <h3>WarpAI Assistant</h3>
          <span class="ai-status" :class="aiStatus">{{ statusText }}</span>
        </div>
      </div>
      <div class="ai-header-actions">
        <!-- AI Mode Selector -->
        <select v-model="currentMode" @change="switchMode" class="ai-mode-selector">
          <option value="chat">💬 Chat</option>
          <option value="crush">🎭 Glamorous</option>
          <option value="pair">🤝 Pair Programming</option>
          <option value="wizard">🧙‍♂️ Code Wizard</option>
          <option value="docs">📚 Document Chat</option>
          <option value="repo">📦 Repo Analysis</option>
          <option value="agents">🤖 Multi-Agent</option>
        </select>
        <button @click="$emit('close')" class="close-btn">✕</button>
      </div>
    </div>

    <!-- AI Mode Content -->
    <div class="ai-content">
      <!-- Chat Mode -->
      <ChatMode v-if="currentMode === 'chat'" />
      
      <!-- Glamorous Mode (Crush-style) -->
      <GlamorousMode v-if="currentMode === 'crush'" />
      
      <!-- Pair Programming Mode (Aider-style) -->
      <PairProgrammingMode v-if="currentMode === 'pair'" />
      
      <!-- Code Wizard Mode (Repo-wizard style) -->
      <CodeWizardMode v-if="currentMode === 'wizard'" />
      
      <!-- Document Chat Mode (LocalGPT style) -->
      <DocumentChatMode v-if="currentMode === 'docs'" />
      
      <!-- Repository Analysis Mode (Repomix style) -->
      <RepoAnalysisMode v-if="currentMode === 'repo'" />
      
      <!-- Multi-Agent Mode -->
      <MultiAgentMode v-if="currentMode === 'agents'" />
    </div>

    <!-- Chat Interface -->
    <div class="chat-interface">
      <!-- Messages -->
      <div class="messages" ref="messagesContainer">
        <ChatMessage 
          v-for="message in messages" 
          :key="message.id"
          :message="message"
          @execute-code="executeCode"
          @apply-changes="applyChanges"
        />
        
        <!-- Typing indicator -->
        <div v-if="isTyping" class="typing-indicator">
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          AI is thinking...
        </div>
      </div>

      <!-- Input Area -->
      <div class="input-area">
        <!-- Quick Actions -->
        <div class="quick-actions" v-if="quickActions.length > 0">
          <button 
            v-for="action in quickActions" 
            :key="action.id"
            @click="executeQuickAction(action)"
            class="quick-action-btn"
          >
            {{ action.emoji }} {{ action.label }}
          </button>
        </div>

        <!-- Input Field -->
        <div class="message-input-container">
          <textarea
            v-model="inputMessage"
            @keydown="handleInputKeydown"
            @paste="handlePaste"
            ref="messageInput"
            placeholder="Ask AI anything, paste code, or drag & drop files..."
            class="message-input"
            rows="1"
          ></textarea>
          
          <!-- Input Actions -->
          <div class="input-actions">
            <button @click="attachFile" class="action-btn" title="Attach file">📎</button>
            <button @click="pasteCode" class="action-btn" title="Paste code">📋</button>
            <button @click="recordVoice" class="action-btn" title="Voice input">🎤</button>
            <button 
              @click="sendMessage" 
              :disabled="!inputMessage.trim() || isTyping"
              class="send-btn"
            >
              <span v-if="!isTyping">➤</span>
              <span v-else>⏸</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Context Info -->
    <div class="context-info" v-if="currentContext">
      <div class="context-header">
        🧠 Context: {{ currentContext.type }}
      </div>
      <div class="context-details">
        {{ currentContext.summary }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useAIStore } from '../stores/ai'
import { useTerminalStore } from '../stores/terminal'
import { useConfigStore } from '../stores/config'

// Mode Components
import ChatMode from './ai-modes/ChatMode.vue'
import GlamorousMode from './ai-modes/GlamorousMode.vue'
import PairProgrammingMode from './ai-modes/PairProgrammingMode.vue'
import CodeWizardMode from './ai-modes/CodeWizardMode.vue'
import DocumentChatMode from './ai-modes/DocumentChatMode.vue'
import RepoAnalysisMode from './ai-modes/RepoAnalysisMode.vue'
import MultiAgentMode from './ai-modes/MultiAgentMode.vue'

import ChatMessage from './ChatMessage.vue'

import type { ChatMessage as ChatMessageType, QuickAction, AIContext } from '../types'

// Stores
const aiStore = useAIStore()
const terminalStore = useTerminalStore()
const configStore = useConfigStore()

// Refs
const messagesContainer = ref<HTMLDivElement>()
const messageInput = ref<HTMLTextAreaElement>()

// State
const currentMode = ref('chat')
const inputMessage = ref('')
const isTyping = ref(false)
const messages = ref<ChatMessageType[]>([])

// Computed
const aiStatus = computed(() => aiStore.connectionStatus)
const statusText = computed(() => {
  switch (aiStore.connectionStatus) {
    case 'connected': return '🟢 Connected to Ollama'
    case 'connecting': return '🟡 Connecting...'
    case 'disconnected': return '🔴 Disconnected'
    case 'error': return '❌ Connection Error'
    default: return '⚪ Unknown'
  }
})

const quickActions = computed(() => {
  const actions: QuickAction[] = [
    { id: 'explain', emoji: '💡', label: 'Explain', description: 'Explain the last command' },
    { id: 'fix', emoji: '🔧', label: 'Fix Error', description: 'Help fix the last error' },
    { id: 'optimize', emoji: '⚡', label: 'Optimize', description: 'Optimize system performance' },
    { id: 'generate', emoji: '✨', label: 'Generate', description: 'Generate code or scripts' },
  ]

  // Add mode-specific actions
  if (currentMode.value === 'repo') {
    actions.push({ id: 'analyze-repo', emoji: '📦', label: 'Analyze Repo', description: 'Analyze current repository' })
  }
  
  if (currentMode.value === 'pair') {
    actions.push({ id: 'start-session', emoji: '🤝', label: 'Start Pairing', description: 'Start pair programming' })
  }

  return actions
})

const currentContext = computed(() => aiStore.currentContext)

// Emits
const emit = defineEmits<{
  close: []
}>()

// Methods
async function switchMode() {
  // Clear messages when switching modes
  messages.value = []
  
  // Initialize mode-specific context
  await aiStore.switchMode(currentMode.value)
  
  // Add welcome message for the new mode
  const welcomeMessage = getWelcomeMessage(currentMode.value)
  if (welcomeMessage) {
    messages.value.push(welcomeMessage)
  }
}

function getWelcomeMessage(mode: string): ChatMessageType | null {
  const welcomeMessages: Record<string, ChatMessageType> = {
    chat: {
      id: Date.now().toString(),
      role: 'assistant',
      content: '👋 Hello! I\'m your AI assistant. How can I help you today?',
      timestamp: new Date(),
      mode: 'chat'
    },
    crush: {
      id: Date.now().toString(),
      role: 'assistant', 
      content: '🎭✨ Welcome to Glamorous AI! I\'m here to make your terminal experience absolutely *fabulous*. What magical coding adventure shall we embark on today? 💫',
      timestamp: new Date(),
      mode: 'crush'
    },
    pair: {
      id: Date.now().toString(),
      role: 'assistant',
      content: '🤝 Ready for some pair programming? Let\'s work together step by step. Share your project or tell me what you\'d like to build!',
      timestamp: new Date(),
      mode: 'pair'
    },
    wizard: {
      id: Date.now().toString(),
      role: 'assistant',
      content: '🧙‍♂️ The Code Wizard is here! I can safely review and apply code changes to your repository. What spells shall we cast on your codebase?',
      timestamp: new Date(),
      mode: 'wizard'
    },
    docs: {
      id: Date.now().toString(),
      role: 'assistant',
      content: '📚 Document chat activated! Drop any files or paste content and I\'ll help you understand and work with it. Everything stays private and local.',
      timestamp: new Date(),
      mode: 'docs'
    },
    repo: {
      id: Date.now().toString(),
      role: 'assistant',
      content: '📦 Repository analysis mode! I can analyze your entire codebase, generate documentation, and provide architectural insights. What project should we explore?',
      timestamp: new Date(),
      mode: 'repo'
    },
    agents: {
      id: Date.now().toString(),
      role: 'assistant',
      content: '🤖 Multi-agent system online! I can coordinate multiple AI specialists for complex tasks. What challenge requires our collective intelligence?',
      timestamp: new Date(),
      mode: 'agents'
    }
  }
  
  return welcomeMessages[mode] || null
}

async function sendMessage() {
  if (!inputMessage.value.trim() || isTyping.value) return

  const userMessage: ChatMessageType = {
    id: Date.now().toString(),
    role: 'user',
    content: inputMessage.value,
    timestamp: new Date(),
    mode: currentMode.value
  }

  messages.value.push(userMessage)
  
  const messageText = inputMessage.value
  inputMessage.value = ''
  
  // Auto-resize textarea
  if (messageInput.value) {
    messageInput.value.style.height = 'auto'
  }

  isTyping.value = true

  try {
    let response: string
    
    // Route to appropriate AI mode
    switch (currentMode.value) {
      case 'crush':
        response = await aiStore.glamorousChat(messageText)
        break
      case 'pair':
        response = await aiStore.startPairProgramming(messageText)
        break
      case 'wizard':
        response = await aiStore.reviewCode(messageText)
        break
      case 'docs':
        response = await aiStore.chatWithDocuments(messageText)
        break
      case 'repo':
        response = await aiStore.analyzeRepository(messageText)
        break
      case 'agents':
        response = await aiStore.coordinateAgents(messageText)
        break
      default:
        response = await aiStore.chat(messageText)
    }

    const assistantMessage: ChatMessageType = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      mode: currentMode.value
    }

    messages.value.push(assistantMessage)
  } catch (error) {
    console.error('AI chat error:', error)
    
    const errorMessage: ChatMessageType = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '❌ Sorry, I encountered an error. Please check the AI connection and try again.',
      timestamp: new Date(),
      mode: currentMode.value,
      isError: true
    }
    
    messages.value.push(errorMessage)
  } finally {
    isTyping.value = false
    await scrollToBottom()
  }
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    if (event.shiftKey) {
      // Shift+Enter: new line
      return
    } else {
      // Enter: send message
      event.preventDefault()
      sendMessage()
    }
  }

  // Auto-resize textarea
  nextTick(() => {
    if (messageInput.value) {
      messageInput.value.style.height = 'auto'
      messageInput.value.style.height = `${messageInput.value.scrollHeight}px`
    }
  })
}

async function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      // Handle image paste
      const file = item.getAsFile()
      if (file) {
        await handleFileUpload(file)
        event.preventDefault()
      }
    } else if (item.type === 'text/plain') {
      // Handle text paste - detect if it's code
      const text = await new Promise<string>(resolve => {
        item.getAsString(resolve)
      })
      
      if (isCodeContent(text)) {
        // Format as code block
        const codeBlock = `\`\`\`\n${text}\n\`\`\``
        inputMessage.value += codeBlock
        event.preventDefault()
      }
    }
  }
}

function isCodeContent(text: string): boolean {
  // Simple heuristics to detect code
  const codeIndicators = [
    /function\s+\w+\s*\(/,
    /class\s+\w+/,
    /import\s+.*from/,
    /^\s*[{}][\s\S]*[{}]\s*$/,
    /^\s*def\s+\w+\s*\(/,
    /^\s*#include\s*</,
    /{[\s\S]*}/
  ]
  
  return codeIndicators.some(pattern => pattern.test(text)) || text.split('\n').length > 3
}

async function handleFileUpload(file: File) {
  // Handle file upload to AI context
  const content = await file.text()
  
  const fileMessage: ChatMessageType = {
    id: Date.now().toString(),
    role: 'user',
    content: `📎 **${file.name}**\n\`\`\`\n${content}\n\`\`\``,
    timestamp: new Date(),
    mode: currentMode.value,
    attachments: [{ name: file.name, type: file.type, content }]
  }
  
  messages.value.push(fileMessage)
  
  // Add to AI context
  await aiStore.addFileToContext(file.name, content)
}

async function executeQuickAction(action: QuickAction) {
  switch (action.id) {
    case 'explain':
      inputMessage.value = 'Please explain the last command and its output'
      break
    case 'fix':
      inputMessage.value = 'Help me fix the last error'
      break
    case 'optimize':
      inputMessage.value = 'How can I optimize my system performance?'
      break
    case 'generate':
      inputMessage.value = 'Generate a script for: '
      messageInput.value?.focus()
      return
    case 'analyze-repo':
      await aiStore.analyzeCurrentRepository()
      return
    case 'start-session':
      inputMessage.value = 'Start a pair programming session'
      break
  }
  
  if (inputMessage.value) {
    await sendMessage()
  }
}

async function executeCode(code: string) {
  // Execute code in terminal
  await terminalStore.executeCommand('default', code)
}

async function applyChanges(changes: string) {
  // Apply code changes safely
  await aiStore.applyCodeChanges(changes, true) // true for review mode
}

function attachFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = '.txt,.md,.js,.ts,.py,.rs,.go,.java,.cpp,.c,.json,.yaml,.toml'
  
  input.onchange = async (event) => {
    const files = (event.target as HTMLInputElement).files
    if (files) {
      for (const file of files) {
        await handleFileUpload(file)
      }
    }
  }
  
  input.click()
}

function pasteCode() {
  // Focus input and trigger paste
  messageInput.value?.focus()
  navigator.clipboard.readText().then(text => {
    if (isCodeContent(text)) {
      inputMessage.value += `\`\`\`\n${text}\n\`\`\``
    } else {
      inputMessage.value += text
    }
  })
}

async function recordVoice() {
  // TODO: Implement voice input
  console.log('Voice input not yet implemented')
}

async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Watch for new messages and scroll to bottom
watch(messages, scrollToBottom, { deep: true })

onMounted(() => {
  // Initialize with welcome message
  switchMode()
  
  // Focus input
  messageInput.value?.focus()
})
</script>

<style scoped>
.ai-assistant-panel {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: rgba(26, 26, 26, 0.95);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.ai-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
}

.ai-header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-avatar {
  font-size: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-header-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.ai-status {
  font-size: 12px;
  opacity: 0.7;
}

.ai-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-mode-selector {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #ffffff;
  font-size: 12px;
}

.close-btn {
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: #ffffff;
  cursor: pointer;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.ai-content {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.chat-interface {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #667eea;
  animation: typing 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }
.typing-dots span:nth-child(3) { animation-delay: 0s; }

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0);
  } 40% {
    transform: scale(1);
  }
}

.input-area {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
}

.quick-actions {
  display: flex;
  gap: 8px;
  padding: 12px 20px 0;
  flex-wrap: wrap;
}

.quick-action-btn {
  padding: 6px 12px;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 12px;
  color: #ffffff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-action-btn:hover {
  background: rgba(102, 126, 234, 0.3);
  transform: translateY(-1px);
}

.message-input-container {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 16px 20px;
}

.message-input {
  flex: 1;
  min-height: 40px;
  max-height: 120px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #ffffff;
  font-family: inherit;
  font-size: 14px;
  resize: none;
  overflow-y: auto;
}

.message-input:focus {
  outline: none;
  border-color: #667eea;
  background: rgba(255, 255, 255, 0.08);
}

.message-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  color: #ffffff;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 14px;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.send-btn {
  padding: 10px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.context-info {
  padding: 12px 20px;
  background: rgba(102, 126, 234, 0.1);
  border-top: 1px solid rgba(102, 126, 234, 0.3);
}

.context-header {
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 4px;
}

.context-details {
  font-size: 11px;
  opacity: 0.8;
  line-height: 1.4;
}
</style>
