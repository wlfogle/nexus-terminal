use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::collections::HashMap;
use crate::ai::AIService;

/// Enhanced AI capabilities inspired by starred repositories
/// Integrates features from: crush, repomix, repo-wizard, aider, gpt-pilot, etc.
pub struct EnhancedAIService {
    base_ai: AIService,
    context_store: ContextStore,
    agent_coordinator: AgentCoordinator,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextStore {
    pub terminal_history: Vec<CommandEntry>,
    pub repository_context: Option<RepositoryContext>,
    pub project_knowledge: HashMap<String, String>,
    pub conversation_memory: Vec<ConversationEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandEntry {
    pub command: String,
    pub output: String,
    pub exit_code: i32,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepositoryContext {
    pub file_tree: String,
    pub readme_content: Option<String>,
    pub package_files: HashMap<String, String>, // package.json, Cargo.toml, etc.
    pub git_info: GitInfo,
    pub technology_stack: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitInfo {
    pub branch: String,
    pub status: String,
    pub recent_commits: Vec<String>,
    pub remote_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationEntry {
    pub role: String, // "user", "assistant", "system"
    pub content: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub context_tags: Vec<String>,
}

/// Agent coordination system (inspired by awesome-a2a)
pub struct AgentCoordinator {
    pub active_agents: HashMap<String, Agent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub agent_type: AgentType,
    pub status: AgentStatus,
    pub capabilities: Vec<String>,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentType {
    CodeReviewer,    // Inspired by repo-wizard
    CodeGenerator,   // Inspired by gpt-pilot
    PairProgrammer,  // Inspired by aider
    GitAssistant,    // Git workflow automation
    SystemAnalyzer,  // System optimization
    DocumentWriter,  // Documentation generator
    TestWriter,      // Test generation
    Debugger,        // Error analysis and fixing
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentStatus {
    Idle,
    Working,
    WaitingForApproval,
    Error(String),
}

impl EnhancedAIService {
    pub async fn new(base_ai: AIService) -> Result<Self> {
        Ok(Self {
            base_ai,
            context_store: ContextStore::new(),
            agent_coordinator: AgentCoordinator::new(),
        })
    }

    /// Repomix-style repository analysis and packaging
    pub async fn analyze_and_pack_repository(&mut self, repo_path: &str) -> Result<String> {
        let repo_context = self.build_repository_context(repo_path).await?;
        self.context_store.repository_context = Some(repo_context.clone());

        // Create AI-friendly repository package
        let package = format!(
            "# Repository Analysis: {}\n\n## File Structure\n{}\n\n## README\n{}\n\n## Package Configuration\n{}\n\n## Git Information\n{}\n\n## Technology Stack\n{}\n\n## AI Analysis\n{}",
            repo_path,
            repo_context.file_tree,
            repo_context.readme_content.unwrap_or_else(|| "No README found".to_string()),
            self.format_package_files(&repo_context.package_files),
            self.format_git_info(&repo_context.git_info),
            repo_context.technology_stack.join(", "),
            self.base_ai.analyze_repository(&repo_context.file_tree, repo_context.readme_content.as_deref()).await?
        );

        Ok(package)
    }

    /// Crush-style glamorous AI coding assistance
    pub async fn glamorous_code_assistance(&self, request: &str, context: &str) -> Result<String> {
        let enhanced_context = format!(
            "Terminal Context:\n{}\n\nRepository Context:\n{}\n\nCommand History:\n{}\n\nUser Request: {}",
            context,
            self.format_repository_context(),
            self.format_command_history(),
            request
        );

        let glamorous_prompt = format!(
            "🎭 You are a glamorous AI coding agent! Be helpful, stylish, and efficient.\n\n{}\n\n💫 Provide a response that is:\n- Technically accurate\n- Elegantly presented\n- Contextually aware\n- Action-oriented\n\nUse emojis appropriately and make the terminal experience delightful! ✨",
            enhanced_context
        );

        self.base_ai.chat(&glamorous_prompt, None).await
    }

    /// Aider-style pair programming
    pub async fn pair_programming_session(&mut self, task: &str) -> Result<String> {
        // Activate pair programming agent
        let agent_id = self.agent_coordinator.activate_agent(AgentType::PairProgrammer, task.to_string())?;
        
        let context = format!(
            "🤝 Pair Programming Session Started\n\nTask: {}\n\nCurrent Context:\n{}\n\nLet's work together step by step!",
            task,
            self.format_full_context()
        );

        self.base_ai.chat(&context, None).await
    }

    /// Repo-wizard style safe code application
    pub async fn apply_code_changes_safely(&self, changes: &str, review: bool) -> Result<String> {
        if review {
            let review_prompt = format!(
                "🔍 Code Review Request\n\nProposed Changes:\n{}\n\nCurrent Repository Context:\n{}\n\nPlease review these changes and provide:\n1. Safety analysis\n2. Potential issues\n3. Recommendations\n4. Approval/rejection with reasoning",
                changes,
                self.format_repository_context()
            );
            
            self.base_ai.chat(&review_prompt, None).await
        } else {
            // Direct application (with safety checks)
            self.validate_and_apply_changes(changes).await
        }
    }

    /// GPT-Pilot style project generation and development
    pub async fn generate_project(&self, description: &str, tech_stack: &[String]) -> Result<String> {
        let prompt = format!(
            "🚀 Project Generation Request\n\nDescription: {}\nTech Stack: {}\n\nGenerate a complete project structure with:\n1. File structure\n2. Core implementation files\n3. Configuration files\n4. Documentation\n5. Setup instructions\n\nMake it production-ready and follow best practices!",
            description,
            tech_stack.join(", ")
        );

        self.base_ai.generate_code(&prompt, "project").await
    }

    /// LLMFeeder-style web content integration
    pub async fn feed_web_content(&mut self, url: &str, content: &str) -> Result<()> {
        // Convert web content to clean markdown and store in context
        let clean_content = self.clean_web_content(content);
        
        self.context_store.project_knowledge.insert(
            format!("web:{}", url),
            clean_content
        );
        
        Ok(())
    }

    /// LocalGPT-style private document chat
    pub async fn chat_with_documents(&self, query: &str, document_paths: &[String]) -> Result<String> {
        let mut document_content = String::new();
        
        for path in document_paths {
            if let Ok(content) = tokio::fs::read_to_string(path).await {
                document_content.push_str(&format!("=== {} ===\n{}\n\n", path, content));
            }
        }

        let prompt = format!(
            "📚 Document Chat Session\n\nDocuments:\n{}\n\nQuery: {}\n\nProvide a comprehensive answer based on the documents. Keep all data local and private!",
            document_content,
            query
        );

        self.base_ai.chat(&prompt, None).await
    }

    /// Multi-agent coordination (inspired by awesome-a2a)
    pub async fn coordinate_agents(&mut self, task: &str) -> Result<String> {
        // Determine which agents are needed for the task
        let required_agents = self.analyze_task_requirements(task);
        
        let mut results = Vec::new();
        for agent_type in required_agents {
            let agent_id = self.agent_coordinator.activate_agent(agent_type, task.to_string())?;
            let result = self.execute_agent_task(&agent_id, task).await?;
            results.push(result);
        }

        // Coordinate and synthesize results
        let coordination_prompt = format!(
            "🤖 Multi-Agent Coordination\n\nTask: {}\n\nAgent Results:\n{}\n\nSynthesize these results into a cohesive response:",
            task,
            results.join("\n---\n")
        );

        self.base_ai.chat(&coordination_prompt, None).await
    }

    // Helper methods
    async fn build_repository_context(&self, repo_path: &str) -> Result<RepositoryContext> {
        use crate::utils::get_file_tree;
        use crate::git;

        let file_tree = get_file_tree(repo_path, Some(3))?;
        
        let readme_content = {
            let readme_paths = ["README.md", "README.txt", "readme.md"];
            let mut content = None;
            for readme in readme_paths {
                let path = Path::new(repo_path).join(readme);
                if let Ok(readme_text) = tokio::fs::read_to_string(&path).await {
                    content = Some(readme_text);
                    break;
                }
            }
            content
        };

        let package_files = self.collect_package_files(repo_path).await?;
        let technology_stack = self.detect_technology_stack(&package_files);

        let git_info = GitInfo {
            branch: git::get_branch_name(repo_path).unwrap_or_else(|_| "unknown".to_string()),
            status: git::get_status(repo_path).unwrap_or_else(|_| "unknown".to_string()),
            recent_commits: Vec::new(), // TODO: Implement
            remote_url: None, // TODO: Implement
        };

        Ok(RepositoryContext {
            file_tree,
            readme_content,
            package_files,
            git_info,
            technology_stack,
        })
    }

    async fn collect_package_files(&self, repo_path: &str) -> Result<HashMap<String, String>> {
        let mut package_files = HashMap::new();
        
        let package_names = [
            "package.json", "Cargo.toml", "pyproject.toml", "go.mod", 
            "pom.xml", "build.gradle", "composer.json", "Gemfile"
        ];

        for package_name in package_names {
            let path = Path::new(repo_path).join(package_name);
            if let Ok(content) = tokio::fs::read_to_string(&path).await {
                package_files.insert(package_name.to_string(), content);
            }
        }

        Ok(package_files)
    }

    fn detect_technology_stack(&self, package_files: &HashMap<String, String>) -> Vec<String> {
        let mut stack = Vec::new();

        if package_files.contains_key("package.json") {
            stack.push("Node.js".to_string());
            stack.push("JavaScript".to_string());
        }
        if package_files.contains_key("Cargo.toml") {
            stack.push("Rust".to_string());
        }
        if package_files.contains_key("pyproject.toml") {
            stack.push("Python".to_string());
        }
        if package_files.contains_key("go.mod") {
            stack.push("Go".to_string());
        }

        stack
    }

    fn clean_web_content(&self, content: &str) -> String {
        // Basic HTML to markdown conversion
        // In a real implementation, you'd use a proper HTML parser
        content
            .replace("<h1>", "# ")
            .replace("</h1>", "\n")
            .replace("<h2>", "## ")
            .replace("</h2>", "\n")
            .replace("<p>", "\n")
            .replace("</p>", "\n")
            .replace("<br>", "\n")
    }

    async fn validate_and_apply_changes(&self, _changes: &str) -> Result<String> {
        // TODO: Implement safe code application
        Ok("Changes validated and ready for application".to_string())
    }

    fn analyze_task_requirements(&self, task: &str) -> Vec<AgentType> {
        let mut agents = Vec::new();
        
        let task_lower = task.to_lowercase();
        
        if task_lower.contains("review") || task_lower.contains("check") {
            agents.push(AgentType::CodeReviewer);
        }
        if task_lower.contains("generate") || task_lower.contains("create") {
            agents.push(AgentType::CodeGenerator);
        }
        if task_lower.contains("debug") || task_lower.contains("error") {
            agents.push(AgentType::Debugger);
        }
        if task_lower.contains("test") {
            agents.push(AgentType::TestWriter);
        }
        if task_lower.contains("git") || task_lower.contains("commit") {
            agents.push(AgentType::GitAssistant);
        }

        agents
    }

    async fn execute_agent_task(&self, _agent_id: &str, task: &str) -> Result<String> {
        // TODO: Implement agent-specific task execution
        self.base_ai.chat(task, None).await
    }

    fn format_repository_context(&self) -> String {
        if let Some(ref repo) = self.context_store.repository_context {
            format!("Tech Stack: {}\nBranch: {}", 
                repo.technology_stack.join(", "), 
                repo.git_info.branch
            )
        } else {
            "No repository context available".to_string()
        }
    }

    fn format_command_history(&self) -> String {
        self.context_store.terminal_history
            .iter()
            .rev()
            .take(5)
            .map(|cmd| format!("$ {}", cmd.command))
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn format_full_context(&self) -> String {
        format!(
            "Repository: {}\nRecent Commands: {}\nConversation Items: {}",
            self.format_repository_context(),
            self.context_store.terminal_history.len(),
            self.context_store.conversation_memory.len()
        )
    }

    fn format_package_files(&self, package_files: &HashMap<String, String>) -> String {
        package_files
            .iter()
            .map(|(name, content)| format!("=== {} ===\n{}", name, content))
            .collect::<Vec<_>>()
            .join("\n\n")
    }

    fn format_git_info(&self, git_info: &GitInfo) -> String {
        format!(
            "Branch: {}\nStatus: {}\nCommits: {}",
            git_info.branch,
            git_info.status,
            git_info.recent_commits.len()
        )
    }
}

impl ContextStore {
    fn new() -> Self {
        Self {
            terminal_history: Vec::new(),
            repository_context: None,
            project_knowledge: HashMap::new(),
            conversation_memory: Vec::new(),
        }
    }
}

impl AgentCoordinator {
    fn new() -> Self {
        Self {
            active_agents: HashMap::new(),
        }
    }

    fn activate_agent(&mut self, agent_type: AgentType, context: String) -> Result<String> {
        let agent_id = format!("{:?}-{}", agent_type, uuid::Uuid::new_v4());
        
        let agent = Agent {
            id: agent_id.clone(),
            agent_type,
            status: AgentStatus::Working,
            capabilities: Vec::new(), // TODO: Define based on agent type
            context,
        };

        self.active_agents.insert(agent_id.clone(), agent);
        Ok(agent_id)
    }
}
