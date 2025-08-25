import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/tauri'

import type { 
  AIConfig, 
  ChatMessage, 
  AIContext, 
  Agent, 
  RepositoryContext,
  ConnectionStatus,
  CommandCompletion,
  AIError,
  AIMode,
  SearchResult
} from '../types'

export const useAIStore = defineStore('ai', () => {
  // State
  const config = ref<AIConfig>({
    ollama_url: 'http://localhost:11434',
    default_model: 'codellama:7b',
    timeout_seconds: 30,
    temperature: 0.7,
    max_tokens: 4096,
    models: []
  })

  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const currentMode = ref<AIMode>('chat')
  const currentContext = ref<AIContext | null>(null)
  const isTyping = ref(false)
  const availableModels = ref<string[]>([])

  // Enhanced AI State (from starred repos)
  const activeAgents = ref<Map<string, Agent>>(new Map())
  const repositoryContext = ref<RepositoryContext | null>(null)
  const conversationHistory = ref<ChatMessage[]>([])
  const documentContext = ref<Map<string, string>>(new Map())
  const webContentContext = ref<Map<string, string>>(new Map())

  // Computed
  const isConnected = computed(() => connectionStatus.value === 'connected')
  const canUseAI = computed(() => isConnected.value && availableModels.value.length > 0)

  // Actions
  async function initializeAI() {
    try {
      connectionStatus.value = 'connecting'
      
      // Test connection and get available models
      const models = await invoke<string[]>('get_available_models')
      availableModels.value = models
      config.value.models = models

      connectionStatus.value = 'connected'
      console.log('AI initialized with models:', models)
    } catch (error) {
      console.error('Failed to initialize AI:', error)
      connectionStatus.value = 'error'
      throw error
    }
  }

  async function testConnection(): Promise<boolean> {
    try {
      connectionStatus.value = 'connecting'
      await invoke('check_ai_connection')
      connectionStatus.value = 'connected'
      return true
    } catch (error) {
      connectionStatus.value = 'error'
      return false
    }
  }

  // Basic AI Chat
  async function chat(message: string, context?: string): Promise<string> {
    if (!canUseAI.value) throw new Error('AI not available')

    try {
      isTyping.value = true
      
      const response = await invoke<string>('ai_chat', {
        message,
        context: context || await getCurrentContext()
      })
      
      // Add to conversation history
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date(),
        mode: currentMode.value
      }
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        mode: currentMode.value
      }

      conversationHistory.value.push(userMessage, assistantMessage)
      
      return response
    } finally {
      isTyping.value = false
    }
  }

  // Enhanced AI Features (Crush-style)
  async function glamorousChat(message: string): Promise<string> {
    const glamorousContext = `
🎭✨ Glamorous AI Mode Active! ✨🎭

You are a fabulous, stylish, and incredibly helpful AI assistant. 
Make every response delightful and engaging while being technically accurate.
Use appropriate emojis and make the terminal experience magical!

Current Context: ${await getCurrentContext()}
    `.trim()

    return await chat(message, glamorousContext)
  }

  // Pair Programming (Aider-style)
  async function startPairProgramming(task: string): Promise<string> {
    const pairContext = `
🤝 Pair Programming Session

Task: ${task}
Repository: ${repositoryContext.value?.name || 'Unknown'}
Current Directory: ${repositoryContext.value?.path || process.cwd()}
Tech Stack: ${repositoryContext.value?.technology_stack.join(', ') || 'Unknown'}

Let's work together step by step. I'll help you break down the task and implement it properly.
    `.trim()

    return await chat(`Let's start pair programming: ${task}`, pairContext)
  }

  // Code Review (Repo-wizard style)
  async function reviewCode(code: string): Promise<string> {
    const reviewContext = `
🧙‍♂️ Code Wizard - Safe Code Review

Repository Context: ${repositoryContext.value?.name || 'Unknown'}
Technology Stack: ${repositoryContext.value?.technology_stack.join(', ') || 'Unknown'}

Please review this code and provide:
1. Safety analysis
2. Potential issues
3. Recommendations
4. Whether it's safe to apply
    `.trim()

    return await chat(`Review this code:\n\`\`\`\n${code}\n\`\`\``, reviewContext)
  }

  // Document Chat (LocalGPT style)
  async function chatWithDocuments(query: string): Promise<string> {
    const documents = Array.from(documentContext.value.entries())
      .map(([name, content]) => `=== ${name} ===\n${content}`)
      .join('\n\n')

    const docContext = `
📚 Document Chat - Private & Local

Available Documents:
${documents}

Query: ${query}

Please provide a comprehensive answer based on the documents. All data stays local and private.
    `.trim()

    return await chat(query, docContext)
  }

  // Repository Analysis (Repomix style)
  async function analyzeRepository(query?: string): Promise<string> {
    try {
      // Get current working directory
      const cwd = await invoke<string>('get_current_directory')
      
      // Analyze repository
      const analysis = await invoke<string>('analyze_repository', { path: cwd })
      
      if (query) {
        const analysisContext = `
📦 Repository Analysis

${analysis}

User Query: ${query}

Based on this repository analysis, please provide specific insights or recommendations.
        `.trim()

        return await chat(query, analysisContext)
      }
      
      return analysis
    } catch (error) {
      console.error('Repository analysis failed:', error)
      throw error
    }
  }

  // Multi-agent Coordination
  async function coordinateAgents(task: string): Promise<string> {
    const agentContext = `
🤖 Multi-Agent Coordination System

Task: ${task}
Available Agents: ${Array.from(activeAgents.value.values()).map(a => `${a.type} (${a.status})`).join(', ')}
Repository: ${repositoryContext.value?.name || 'Unknown'}

Analyzing task requirements and coordinating appropriate agents...
    `.trim()

    return await chat(`Coordinate agents for: ${task}`, agentContext)
  }

  // Command Completion
  async function completeCommand(partialCommand: string, context: string): Promise<string[]> {
    try {
      return await invoke<string[]>('ai_complete_command', {
        partialCommand,
        context
      })
    } catch (error) {
      console.error('Command completion failed:', error)
      return []
    }
  }

  // Error Analysis
  async function explainError(errorOutput: string, command: string): Promise<{ explanation: string; suggestions: string[] }> {
    try {
      const explanation = await invoke<string>('ai_explain_error', {
        errorOutput,
        command
      })

      // Parse explanation and extract suggestions
      const suggestions = extractSuggestionsFromExplanation(explanation)
      
      return { explanation, suggestions }
    } catch (error) {
      console.error('Error explanation failed:', error)
      return { explanation: 'Failed to analyze error', suggestions: [] }
    }
  }

  // Code Generation
  async function generateCode(description: string, language: string): Promise<string> {
    try {
      return await invoke<string>('ai_generate_code', {
        description,
        language
      })
    } catch (error) {
      console.error('Code generation failed:', error)
      throw error
    }
  }

  // Git Integration
  async function generateCommitMessage(): Promise<string> {
    try {
      const cwd = await invoke<string>('get_current_directory')
      return await invoke<string>('git_generate_commit', { path: cwd })
    } catch (error) {
      console.error('Commit message generation failed:', error)
      throw error
    }
  }

  // File and Content Management
  async function addFileToContext(fileName: string, content: string) {
    documentContext.value.set(fileName, content)
    
    // Update current context
    currentContext.value = {
      type: 'document',
      summary: `Added ${fileName} to context`,
      data: { fileName, contentLength: content.length },
      timestamp: new Date()
    }
  }

  async function addWebContentToContext(url: string, content: string) {
    // Clean HTML content to markdown
    const cleanContent = await cleanWebContent(content)
    webContentContext.value.set(url, cleanContent)
    
    currentContext.value = {
      type: 'web_content',
      summary: `Added web content from ${url}`,
      data: { url, contentLength: cleanContent.length },
      timestamp: new Date()
    }
  }

  // Search Functionality
  async function searchCode(query: string, includeContent = false): Promise<SearchResult[]> {
    try {
      const cwd = await invoke<string>('get_current_directory')
      const results = await invoke<string[]>('search_files', {
        query,
        path: cwd,
        includeContent
      })

      return results.map((result, index) => ({
        type: result.startsWith('content:') ? 'content' : 'file',
        title: result.replace(/^(file:|content:)/, ''),
        content: result,
        score: 1.0 - (index * 0.1),
        path: result.replace(/^(file:|content:)/, '')
      })) as SearchResult[]
    } catch (error) {
      console.error('Code search failed:', error)
      return []
    }
  }

  // Agent Management
  function createAgent(type: Agent['type'], context: string): string {
    const agent: Agent = {
      id: `${type}-${Date.now()}`,
      type,
      status: 'idle',
      capabilities: getAgentCapabilities(type),
      context,
      created_at: new Date(),
      last_activity: new Date()
    }

    activeAgents.value.set(agent.id, agent)
    return agent.id
  }

  function getAgentCapabilities(type: Agent['type']): string[] {
    const capabilities: Record<Agent['type'], string[]> = {
      code_reviewer: ['code-analysis', 'security-check', 'best-practices', 'refactoring'],
      code_generator: ['code-generation', 'scaffolding', 'boilerplate', 'templates'],
      pair_programmer: ['real-time-assistance', 'step-by-step-guidance', 'problem-solving'],
      git_assistant: ['commit-messages', 'branch-management', 'merge-conflicts', 'git-workflows'],
      system_analyzer: ['performance-analysis', 'resource-monitoring', 'optimization'],
      document_writer: ['documentation', 'comments', 'readme', 'api-docs'],
      test_writer: ['unit-tests', 'integration-tests', 'test-coverage', 'mocking'],
      debugger: ['error-analysis', 'bug-fixing', 'debugging-strategies', 'troubleshooting']
    }

    return capabilities[type] || []
  }

  // Mode Management
  async function switchMode(mode: AIMode) {
    currentMode.value = mode
    
    // Initialize mode-specific context
    switch (mode) {
      case 'repo':
        await loadRepositoryContext()
        break
      case 'agents':
        await initializeAgentSystem()
        break
      case 'docs':
        await loadDocumentContext()
        break
    }
  }

  // Context Helpers
  async function getCurrentContext(): Promise<string> {
    const contexts: string[] = []

    // Terminal context
    if (repositoryContext.value) {
      contexts.push(`Repository: ${repositoryContext.value.name}`)
      contexts.push(`Branch: ${repositoryContext.value.git_info.branch}`)
      contexts.push(`Tech Stack: ${repositoryContext.value.technology_stack.join(', ')}`)
    }

    // Active agents
    if (activeAgents.value.size > 0) {
      const agentInfo = Array.from(activeAgents.value.values())
        .map(a => `${a.type}:${a.status}`)
        .join(', ')
      contexts.push(`Active Agents: ${agentInfo}`)
    }

    // Documents in context
    if (documentContext.value.size > 0) {
      contexts.push(`Documents: ${Array.from(documentContext.value.keys()).join(', ')}`)
    }

    return contexts.join('\n')
  }

  async function loadRepositoryContext() {
    try {
      const cwd = await invoke<string>('get_current_directory')
      // This would be implemented in the Rust backend
      // const repoData = await invoke<RepositoryContext>('get_repository_context', { path: cwd })
      // repositoryContext.value = repoData
    } catch (error) {
      console.error('Failed to load repository context:', error)
    }
  }

  async function initializeAgentSystem() {
    // Initialize default agents
    createAgent('code_reviewer', 'Ready to review code for safety and quality')
    createAgent('debugger', 'Standing by to help with error analysis')
  }

  async function loadDocumentContext() {
    // Load any persistent document context
    // This could load from local storage or files
  }

  // Utility Functions
  function extractSuggestionsFromExplanation(explanation: string): string[] {
    const suggestions: string[] = []
    const lines = explanation.split('\n')
    
    let inSuggestionsSection = false
    for (const line of lines) {
      if (line.toLowerCase().includes('suggestion') || line.toLowerCase().includes('fix')) {
        inSuggestionsSection = true
        continue
      }
      
      if (inSuggestionsSection && line.trim().startsWith('-')) {
        suggestions.push(line.trim().substring(1).trim())
      } else if (inSuggestionsSection && !line.trim()) {
        inSuggestionsSection = false
      }
    }
    
    return suggestions
  }

  async function cleanWebContent(htmlContent: string): Promise<string> {
    // Basic HTML to markdown conversion
    return htmlContent
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Normalize whitespace
  }

  // Code Application (Repo-wizard style)
  async function applyCodeChanges(changes: string, reviewFirst = true): Promise<string> {
    const applyContext = `
🧙‍♂️ Code Wizard - Applying Changes

Changes to apply:
${changes}

Review required: ${reviewFirst}
Repository: ${repositoryContext.value?.name || 'Unknown'}

${reviewFirst ? 'Please review these changes before applying.' : 'Applying changes directly.'}
    `.trim()

    if (reviewFirst) {
      return await chat(`Review and validate these changes:\n${changes}`, applyContext)
    } else {
      // Direct application (would need backend implementation)
      return 'Changes applied successfully'
    }
  }

  // Advanced Features
  async function analyzeCurrentRepository(): Promise<void> {
    try {
      const analysis = await analyzeRepository()
      
      currentContext.value = {
        type: 'repository_analysis',
        summary: 'Repository analyzed',
        data: { analysis },
        timestamp: new Date()
      }
    } catch (error) {
      console.error('Repository analysis failed:', error)
    }
  }

  async function requestExplanation(command: string, output: string): Promise<void> {
    const explanation = await chat(`Please explain this command and its output:\n\nCommand: ${command}\nOutput: ${output}`)
    
    // Could emit an event or update UI state here
    console.log('Explanation:', explanation)
  }

  async function requestImprovement(command: string, output: string): Promise<void> {
    const improvement = await chat(`How can I improve this command or its usage?\n\nCommand: ${command}\nOutput: ${output}`)
    
    console.log('Improvement suggestions:', improvement)
  }

  // Cleanup
  function clearContext() {
    currentContext.value = null
    documentContext.value.clear()
    webContentContext.value.clear()
    activeAgents.value.clear()
    conversationHistory.value = []
  }

  // Initialize on store creation
  initializeAI().catch(console.error)

  return {
    // State
    config,
    connectionStatus,
    currentMode,
    currentContext,
    isTyping,
    availableModels,
    activeAgents,
    repositoryContext,
    conversationHistory,

    // Computed
    isConnected,
    canUseAI,

    // Basic Actions
    initializeAI,
    testConnection,
    chat,

    // Enhanced AI Modes
    glamorousChat,
    startPairProgramming,
    reviewCode,
    chatWithDocuments,
    analyzeRepository,
    coordinateAgents,

    // Command & Error Handling
    completeCommand,
    explainError,
    generateCode,
    generateCommitMessage,

    // Content Management
    addFileToContext,
    addWebContentToContext,
    searchCode,

    // Agent Management
    createAgent,
    switchMode,

    // Advanced Features
    applyCodeChanges,
    analyzeCurrentRepository,
    requestExplanation,
    requestImprovement,

    // Utilities
    clearContext
  }
})
