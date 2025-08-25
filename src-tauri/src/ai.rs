use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, error, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub ollama_url: String,
    pub default_model: String,
    pub timeout_seconds: u64,
    pub temperature: f32,
    pub max_tokens: u32,
}

impl Default for AIConfig {
    fn default() -> Self {
        Self {
            ollama_url: "http://localhost:11434".to_string(),
            default_model: "codellama:7b".to_string(),
            timeout_seconds: 30,
            temperature: 0.7,
            max_tokens: 4096,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaOptions {
    temperature: f32,
    num_predict: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaResponse {
    response: String,
    done: bool,
}

pub struct AIService {
    client: Client,
    config: AIConfig,
}

impl AIService {
    pub async fn new(config: &AIConfig) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .context("Failed to create HTTP client")?;

        let service = Self {
            client,
            config: config.clone(),
        };

        // Test connection
        service.test_connection().await?;
        
        Ok(service)
    }

    async fn test_connection(&self) -> Result<()> {
        let url = format!("{}/api/tags", self.config.ollama_url);
        let response = self.client.get(&url).send().await
            .context("Failed to connect to Ollama")?;

        if response.status().is_success() {
            info!("Successfully connected to Ollama at {}", self.config.ollama_url);
            Ok(())
        } else {
            error!("Failed to connect to Ollama: {}", response.status());
            Err(anyhow::anyhow!("Ollama connection failed: {}", response.status()))
        }
    }

    async fn generate(&self, prompt: &str, model: Option<&str>) -> Result<String> {
        let model = model.unwrap_or(&self.config.default_model);
        let url = format!("{}/api/generate", self.config.ollama_url);
        
        let request = OllamaRequest {
            model: model.to_string(),
            prompt: prompt.to_string(),
            stream: false,
            options: OllamaOptions {
                temperature: self.config.temperature,
                num_predict: self.config.max_tokens,
            },
        };

        debug!("Sending request to Ollama: {:?}", request);

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .context("Failed to send request to Ollama")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("Ollama request failed: {}", error_text);
            return Err(anyhow::anyhow!("Ollama request failed: {}", error_text));
        }

        let ollama_response: OllamaResponse = response.json().await
            .context("Failed to parse Ollama response")?;

        debug!("Received response from Ollama: {:?}", ollama_response);
        Ok(ollama_response.response)
    }

    pub async fn chat(&self, message: &str, context: Option<&str>) -> Result<String> {
        let prompt = if let Some(ctx) = context {
            format!(
                "Context: {}\n\nUser: {}\n\nAssistant: Please provide a helpful response based on the context and user's message.",
                ctx, message
            )
        } else {
            format!("User: {}\n\nAssistant:", message)
        };

        self.generate(&prompt, None).await
    }

    pub async fn complete_command(&self, partial_command: &str, context: &str) -> Result<Vec<String>> {
        let prompt = format!(
            "Given the following terminal context and partial command, suggest 3-5 possible completions:\n\nContext: {}\nPartial command: {}\n\nProvide only the completions, one per line, without explanations:",
            context, partial_command
        );

        let response = self.generate(&prompt, Some("codellama:7b")).await?;
        
        let completions: Vec<String> = response
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| line.trim().to_string())
            .take(5)
            .collect();

        Ok(completions)
    }

    pub async fn explain_error(&self, error_output: &str, command: &str) -> Result<String> {
        let prompt = format!(
            "Analyze this command error and provide a clear explanation and solution:\n\nCommand: {}\nError output: {}\n\nPlease explain:\n1. What went wrong\n2. Why it happened\n3. How to fix it\n4. Alternative approaches if applicable",
            command, error_output
        );

        self.generate(&prompt, Some("codellama:7b")).await
    }

    pub async fn generate_code(&self, description: &str, language: &str) -> Result<String> {
        let prompt = format!(
            "Generate {} code for the following requirement:\n\n{}\n\nProvide clean, well-commented code with proper error handling where appropriate:",
            language, description
        );

        self.generate(&prompt, Some("codellama:7b")).await
    }

    pub async fn generate_commit_message(&self, diff: &str) -> Result<String> {
        let prompt = format!(
            "Generate a concise, descriptive git commit message for these changes:\n\n{}\n\nFollow conventional commit format (type: description). Be specific but concise:",
            diff
        );

        self.generate(&prompt, Some("codellama:7b")).await
    }

    pub async fn analyze_repository(&self, file_tree: &str, readme_content: Option<&str>) -> Result<String> {
        let prompt = if let Some(readme) = readme_content {
            format!(
                "Analyze this repository structure and README:\n\nFile tree:\n{}\n\nREADME:\n{}\n\nProvide insights about:\n1. Project type and technology stack\n2. Architecture and structure\n3. Potential areas for improvement\n4. Development workflow suggestions",
                file_tree, readme
            )
        } else {
            format!(
                "Analyze this repository structure:\n\n{}\n\nProvide insights about:\n1. Project type and technology stack\n2. Architecture and structure\n3. Potential areas for improvement\n4. Development workflow suggestions",
                file_tree
            )
        };

        self.generate(&prompt, Some("codellama:7b")).await
    }

    pub async fn suggest_improvements(&self, code: &str, language: &str) -> Result<String> {
        let prompt = format!(
            "Review this {} code and suggest improvements:\n\n{}\n\nFocus on:\n1. Code quality and best practices\n2. Performance optimizations\n3. Security considerations\n4. Maintainability improvements\n5. Bug prevention",
            language, code
        );

        self.generate(&prompt, Some("codellama:7b")).await
    }

    pub async fn explain_concept(&self, concept: &str, context: &str) -> Result<String> {
        let prompt = format!(
            "Explain the concept '{}' in the context of '{}':\n\nProvide:\n1. A clear definition\n2. How it relates to the context\n3. Practical examples\n4. Common use cases or applications",
            concept, context
        );

        self.generate(&prompt, None).await
    }

    pub async fn get_available_models(&self) -> Result<Vec<String>> {
        let url = format!("{}/api/tags", self.config.ollama_url);
        
        let response = self.client.get(&url).send().await
            .context("Failed to fetch available models")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to fetch models: {}", response.status()));
        }

        #[derive(Deserialize)]
        struct ModelsResponse {
            models: Vec<Model>,
        }

        #[derive(Deserialize)]
        struct Model {
            name: String,
        }

        let models_response: ModelsResponse = response.json().await
            .context("Failed to parse models response")?;

        Ok(models_response.models.into_iter().map(|m| m.name).collect())
    }
}
