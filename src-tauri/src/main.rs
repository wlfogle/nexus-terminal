// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;
use anyhow::Result;
use chrono::Timelike;

mod ai;
mod git;
mod terminal;
mod ai_optimized;
mod vision_commands;
mod config;
mod utils;
mod broadcast;
mod web_scraper;
mod vision;

use ai::AIService;
use ai_optimized::RequestPriority;
use terminal::TerminalManager;
use config::AppConfig;

#[derive(Debug)]
struct AppState {
    terminal_manager: Arc<RwLock<TerminalManager>>,
    ai_service: Arc<RwLock<AIService>>,
    ai_optimized_service: Arc<RwLock<ai_optimized::OptimizedAIService>>,
    config: Arc<RwLock<AppConfig>>,
}

// AI-related commands
#[tauri::command]
async fn ai_chat(
    message: String,
    context: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ai_service = state.ai_service.read().await;
    ai_service
        .chat(&message, context.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_complete_command(
    partial_command: String,
    context: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let ai_service = state.ai_service.read().await;
    ai_service
        .complete_command(&partial_command, &context)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_explain_error(
    error_output: String,
    command: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ai_service = state.ai_service.read().await;
    ai_service
        .explain_error(&error_output, &command)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_generate_code(
    description: String,
    language: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ai_service = state.ai_service.read().await;
    ai_service
        .generate_code(&description, &language)
        .await
        .map_err(|e| e.to_string())
}

// Terminal-related commands
#[tauri::command]
async fn create_terminal(
    shell: Option<String>,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    env: Option<std::collections::HashMap<String, String>>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut terminal_manager = state.terminal_manager.write().await;
    terminal_manager
        .create_terminal_with_config(shell, args, cwd, env)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_simple_terminal(
    shell: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut terminal_manager = state.terminal_manager.write().await;
    terminal_manager
        .create_terminal(shell)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_to_terminal(
    terminal_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let terminal_manager = state.terminal_manager.read().await;
    terminal_manager
        .write_to_terminal(&terminal_id, &data)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn resize_terminal(
    terminal_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let terminal_manager = state.terminal_manager.read().await;
    terminal_manager
        .resize_terminal(&terminal_id, cols, rows)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn kill_terminal(
    terminal_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut terminal_manager = state.terminal_manager.write().await;
    terminal_manager
        .kill_terminal(&terminal_id)
        .await
        .map_err(|e| e.to_string())
}

// Git integration commands
#[tauri::command]
async fn git_status(path: String) -> Result<String, String> {
    git::get_status(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_generate_commit(
    path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let changes = git::get_diff(&path).map_err(|e| e.to_string())?;
    let ai_service = state.ai_service.read().await;
    ai_service
        .generate_commit_message(&changes)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_get_branch_name(path: String) -> Result<String, String> {
    git::get_branch_name(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_is_repo(path: String) -> Result<bool, String> {
    Ok(git::is_repo(&path))
}

#[tauri::command]
async fn git_get_recent_commits(path: String, limit: usize) -> Result<Vec<String>, String> {
    git::get_recent_commits(&path, limit).map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_get_remote_url(path: String) -> Result<Option<String>, String> {
    git::get_remote_url(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_get_ahead_behind(path: String) -> Result<(usize, usize), String> {
    git::get_ahead_behind_count(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_get_branch_info(path: String) -> Result<git::BranchInfo, String> {
    git::get_branch_info(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_get_all_branches(path: String) -> Result<git::BranchList, String> {
    git::get_all_branches(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_get_stash_list(path: String) -> Result<Vec<git::StashEntry>, String> {
    git::get_stash_list(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_get_commit_changes(path: String, commit_hash: String) -> Result<Vec<git::FileChange>, String> {
    git::get_commit_changes(&path, &commit_hash).map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_get_repository_stats(path: String) -> Result<git::RepositoryStats, String> {
    git::get_repository_stats(&path).map_err(|e| e.to_string())
}

// Contextual suggestions commands
#[tauri::command]
async fn get_contextual_suggestions(
    partial_command: String,
    context: serde_json::Value,
    _filter: Option<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let ai_service = state.ai_service.read().await;
    
    // Convert context to a structured prompt for AI
    let context_str = format!(
        "Current directory: {}\nPartial command: {}\nContext: {}", 
        context.get("currentDirectory").and_then(|v| v.as_str()).unwrap_or("unknown"),
        partial_command,
        serde_json::to_string(&context).unwrap_or_default()
    );
    
    let prompt = format!(
        "Based on the following context, suggest relevant shell commands:\n{}\n\nProvide suggestions as a JSON array with command, description, confidence (0-1), and category fields.",
        context_str
    );
    
    let response = ai_service.chat(&prompt, Some(&context_str)).await.map_err(|e| e.to_string())?;
    
    // Parse AI response and return structured suggestions
    // For now, return a fallback response if parsing fails
    match serde_json::from_str::<Vec<serde_json::Value>>(&response) {
        Ok(suggestions) => Ok(suggestions),
        Err(_) => {
            // Fallback: generate basic suggestions based on partial command
            let mut suggestions = Vec::new();
            
            if partial_command.starts_with("git") {
                suggestions.push(serde_json::json!({
                    "command": "git status",
                    "description": "Show working tree status",
                    "confidence": 0.8,
                    "category": "git",
                    "context": ["git-command"]
                }));
            } else if partial_command.starts_with("ls") {
                suggestions.push(serde_json::json!({
                    "command": "ls -la",
                    "description": "List files with details",
                    "confidence": 0.9,
                    "category": "navigation",
                    "context": ["file-listing"]
                }));
            }
            
            Ok(suggestions)
        }
    }
}

#[tauri::command]
async fn get_current_context() -> Result<serde_json::Value, String> {
    use std::env;
    // Process commands would be used for system integration
    
    let current_dir = env::current_dir().map_err(|e| e.to_string())?
        .to_string_lossy().to_string();
    
    // Get directory contents
    let dir_contents: Vec<String> = std::fs::read_dir(&current_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            entry.ok().and_then(|e| e.file_name().to_str().map(|s| s.to_string()))
        })
        .collect();
    
    // Check if it's a git repository
    let git_info = if git::is_repo(&current_dir) {
        let status = git::get_status(&current_dir).unwrap_or_default();
        let branch = git::get_branch_name(&current_dir).unwrap_or("unknown".to_string());
        let remote_url = git::get_remote_url(&current_dir).unwrap_or(None);
        
        serde_json::json!({
            "branch": branch,
            "status": if status.contains("nothing to commit") { "clean" } else { "dirty" },
            "remote": remote_url
        })
    } else {
        serde_json::Value::Null
    };
    
    // Determine project type
    let project_type = if dir_contents.contains(&"package.json".to_string()) {
        "nodejs"
    } else if dir_contents.contains(&"Cargo.toml".to_string()) {
        "rust"
    } else if dir_contents.contains(&"requirements.txt".to_string()) || dir_contents.contains(&"setup.py".to_string()) {
        "python"
    } else if dir_contents.contains(&"go.mod".to_string()) {
        "go"
    } else {
        "other"
    };
    
    // Get time of day
    let hour = chrono::Local::now().hour();
    let time_of_day = match hour {
        6..=11 => "morning",
        12..=17 => "afternoon",
        18..=21 => "evening",
        _ => "night"
    };
    
    Ok(serde_json::json!({
        "currentDirectory": current_dir,
        "directoryContents": dir_contents,
        "gitRepository": git_info,
        "projectType": project_type,
        "timeOfDay": time_of_day,
        "dayOfWeek": chrono::Local::now().format("%A").to_string(),
        "recentCommands": Vec::<String>::new(), // Would need to be tracked separately
        "workingOnFiles": Vec::<String>::new(), // Would need file monitoring
        "activeProcesses": Vec::<serde_json::Value>::new(), // Would need process monitoring
        "environmentVars": std::env::vars().collect::<std::collections::HashMap<String, String>>(),
        "shellHistory": Vec::<String>::new() // Would need shell history integration
    }))
}

#[tauri::command]
async fn learn_from_command(
    command: String,
    successful: bool,
    context: serde_json::Value,
) -> Result<(), String> {
    // Log command learning for future analysis
    tracing::info!(
        "Learning from command: {} (success: {}) in context: {}",
        command,
        successful,
        context.get("currentDirectory").and_then(|v| v.as_str()).unwrap_or("unknown")
    );
    
    // In a real implementation, this would store learning data in a database
    // For now, we just log it
    Ok(())
}

// Configuration commands
#[tauri::command]
async fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let config = state.config.read().await;
    Ok(config.clone())
}

#[tauri::command]
async fn update_config(
    new_config: AppConfig,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut config = state.config.write().await;
    *config = new_config.clone();
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_temp_file_path(
    name: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let config = state.config.read().await;
    Ok(config.temp_file_path(&name).to_string_lossy().to_string())
}

#[tauri::command]
async fn get_cache_file_path(
    name: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let config = state.config.read().await;
    Ok(config.cache_file_path(&name).to_string_lossy().to_string())
}

// AI helper commands
#[tauri::command]
async fn check_ai_connection(state: State<'_, AppState>) -> Result<bool, String> {
    let ai_service = state.ai_service.read().await;
    // Test if we can get available models (indicates connection)
    match ai_service.get_available_models().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
async fn ai_analyze_repository(
    project_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let file_tree = utils::get_file_tree(&project_path, Some(3))
        .map_err(|e| e.to_string())?;
    
    let readme_content = {
        let readme_paths = ["README.md", "readme.md", "README.txt", "README"];
        let mut content = None;
        for readme_path in &readme_paths {
            let full_path = format!("{}/{}", project_path, readme_path);
            if let Ok(readme) = tokio::fs::read_to_string(&full_path).await {
                content = Some(readme);
                break;
            }
        }
        content
    };
    
    let ai_service = state.ai_service.read().await;
    ai_service
        .analyze_repository(&file_tree, readme_content.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_suggest_improvements(
    code: String,
    language: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ai_service = state.ai_service.read().await;
    ai_service
        .suggest_improvements(&code, &language)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_explain_concept(
    concept: String,
    context: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ai_service = state.ai_service.read().await;
    ai_service
        .explain_concept(&concept, &context)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_current_model(state: State<'_, AppState>) -> Result<String, String> {
    let config = state.config.read().await;
    Ok(config.ai.default_model.clone())
}

#[tauri::command]
async fn send_ai_message(
    message: String,
    context: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ai_service = state.ai_service.read().await;
    
    // Convert context object to formatted string
    let context_str = if context.is_object() {
        let mut context_parts = Vec::new();
        
        if let Some(shell) = context.get("shell").and_then(|v| v.as_str()) {
            context_parts.push(format!("Shell: {}", shell));
        }
        
        if let Some(cwd) = context.get("workingDirectory").and_then(|v| v.as_str()) {
            context_parts.push(format!("Working Directory: {}", cwd));
        }
        
        if let Some(recent_commands) = context.get("recentCommands").and_then(|v| v.as_array()) {
            if !recent_commands.is_empty() {
                let commands: Vec<String> = recent_commands
                    .iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect();
                if !commands.is_empty() {
                    context_parts.push(format!("Recent Commands: {}", commands.join(", ")));
                }
            }
        }
        
        if let Some(errors) = context.get("errors").and_then(|v| v.as_array()) {
            if !errors.is_empty() {
                context_parts.push(format!("Recent Errors: {} errors detected", errors.len()));
            }
        }
        
        if let Some(history) = context.get("terminalHistory").and_then(|v| v.as_array()) {
            if !history.is_empty() {
                context_parts.push(format!("Command History: {} commands", history.len()));
            }
        }
        
        context_parts.join("\n")
    } else {
        context.as_str().unwrap_or("").to_string()
    };
    
    ai_service
        .chat(&message, if context_str.is_empty() { None } else { Some(&context_str) })
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_terminal_context(state: State<'_, AppState>) -> Result<String, String> {
    let terminal_manager = state.terminal_manager.read().await;
    let terminals = terminal_manager.list_terminals();
    
    if terminals.is_empty() {
        Ok("No active terminals".to_string())
    } else {
        let context = terminals.iter()
            .map(|t| format!("Terminal {}: {} in {}", t.id, t.shell, t.cwd))
            .collect::<Vec<_>>()
            .join("\n");
        Ok(context)
    }
}

// Window control commands
#[tauri::command]
async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_maximize(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

// AI service management commands
#[tauri::command]
async fn restart_ai_service(state: State<'_, AppState>) -> Result<(), String> {
    let config = {
        let config_guard = state.config.read().await;
        config_guard.ai.clone()
    };
    
    // Recreate AI service
    let new_ai_service = AIService::new(&config).await.map_err(|e| e.to_string())?;
    
    // Replace the AI service in state
    {
        let mut ai_service_guard = state.ai_service.write().await;
        *ai_service_guard = new_ai_service;
    }
    
    Ok(())
}

#[tauri::command]
async fn ai_clear_completed_requests(state: State<'_, AppState>) -> Result<(), String> {
    let ai_service = state.ai_service.read().await;
    ai_service.clear_completed_requests().await.map_err(|e| e.to_string())
}

// Optimized AI service commands
#[tauri::command]
async fn ai_submit_priority_request(
    prompt: String,
    priority: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ai_service = state.ai_service.read().await;
    
    let priority_level = match priority.as_str() {
        "high" => RequestPriority::High,
        "critical" => RequestPriority::Critical,
        "low" => RequestPriority::Low,
        _ => RequestPriority::Normal,
    };
    
    ai_service
        .submit_priority_request(prompt, priority_level)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_batch_process(
    requests: Vec<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let ai_service = state.ai_service.read().await;
    
    let processed_requests: Vec<(String, RequestPriority)> = requests
        .into_iter()
        .filter_map(|req| {
            let prompt = req.get("prompt").and_then(|p| p.as_str())?;
            let priority_str = req.get("priority").and_then(|p| p.as_str()).unwrap_or("normal");
            
            let priority = match priority_str {
                "high" => RequestPriority::High,
                "critical" => RequestPriority::Critical,
                "low" => RequestPriority::Low,
                _ => RequestPriority::Normal,
            };
            
            Some((prompt.to_string(), priority))
        })
        .collect();
    
    ai_service
        .batch_process_requests(processed_requests)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_get_service_stats(state: State<'_, AppState>) -> Result<String, String> {
    let ai_service = state.ai_service.read().await;
    ai_service
        .get_service_stats()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_clear_completed(state: State<'_, AppState>) -> Result<(), String> {
    let ai_service = state.ai_optimized_service.read().await;
    ai_service.clear_completed().await;
    Ok(())
}

#[tauri::command]
async fn ai_chat_async(
    message: String,
    context: Option<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let ai_service = state.ai_optimized_service.read().await;
    let response = ai_service.chat_async(&message, context.as_deref()).await.map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "id": response.id,
        "content": response.content,
        "model_used": response.model_used,
        "processing_time_ms": response.processing_time.as_millis(),
        "tokens_used": response.tokens_used,
        "success": response.success,
        "error": response.error
    }))
}

#[tauri::command]
async fn ai_submit_async_request(
    prompt: String,
    model: Option<String>,
    priority: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ai_service = state.ai_optimized_service.read().await;
    
    let priority = match priority.as_str() {
        "critical" => ai_optimized::RequestPriority::Critical,
        "high" => ai_optimized::RequestPriority::High,
        "normal" => ai_optimized::RequestPriority::Normal,
        "low" => ai_optimized::RequestPriority::Low,
        "background" => ai_optimized::RequestPriority::Background,
        _ => ai_optimized::RequestPriority::Normal,
    };
    
    let request = ai_optimized::AIRequest::simple(prompt)
        .with_priority(priority);
    
    if let Some(model) = model {
        let request = request.with_model(model);
        let _rx = ai_service.submit_request_async(request).await.map_err(|e| e.to_string())?;
    } else {
        let _rx = ai_service.submit_request_async(request).await.map_err(|e| e.to_string())?;
    }
    
    Ok("Request submitted successfully".to_string())
}

#[tauri::command]
async fn ai_analyze_critical_error(
    error_output: String,
    command: String,
    context: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ai_service = state.ai_service.read().await;
    ai_service
        .analyze_critical_error(&error_output, &command, &context)
        .await
        .map_err(|e| e.to_string())
}

// Advanced AI Request Builder commands
#[tauri::command]
async fn ai_create_simple_request(
    prompt: String,
) -> Result<String, String> {
    use crate::ai_optimized::AIRequest;
    let request = AIRequest::simple(prompt);
    Ok(format!("Created request {} with timeout: {:?}s", request.id, request.timeout.as_secs()))
}

#[tauri::command]
async fn ai_create_custom_request(
    prompt: String,
    priority: String,
    timeout_seconds: u64,
    context: Option<String>,
    model: Option<String>,
) -> Result<serde_json::Value, String> {
    use crate::ai_optimized::{AIRequest, RequestPriority};
    use std::time::Duration;
    
    let priority_level = match priority.as_str() {
        "critical" => RequestPriority::Critical,
        "high" => RequestPriority::High,
        "low" => RequestPriority::Low,
        "background" => RequestPriority::Background,
        _ => RequestPriority::Normal,
    };
    
    let mut request = AIRequest::simple(prompt)
        .with_priority(priority_level)
        .with_timeout(Duration::from_secs(timeout_seconds));
    
    if let Some(ctx) = context {
        request = request.with_context(ctx);
    }
    
    if let Some(mdl) = model {
        request = request.with_model(mdl);
    }
    
    let can_retry = request.can_retry();
    let created_at_secs = request.created_at.elapsed().as_secs();
    
    Ok(serde_json::json!({
        "id": request.id,
        "priority": format!("{:?}", request.priority),
        "timeout": request.timeout.as_secs(),
        "max_retries": request.max_retries,
        "retry_count": request.retry_count,
        "can_retry": can_retry,
        "created_ago_seconds": created_at_secs
    }))
}

#[tauri::command]
async fn ai_increment_request_retry(
    request_data: serde_json::Value,
) -> Result<serde_json::Value, String> {
    use crate::ai_optimized::{AIRequest, RequestPriority};
    use std::time::Duration;
    
    // Reconstruct AIRequest from JSON for retry logic
    let prompt = request_data.get("prompt")
        .and_then(|v| v.as_str())
        .ok_or("Missing prompt")?
        .to_string();
    
    let mut request = AIRequest::simple(prompt);
    
    // Restore request properties
    if let Some(priority_str) = request_data.get("priority").and_then(|v| v.as_str()) {
        let priority = match priority_str {
            "Critical" => RequestPriority::Critical,
            "High" => RequestPriority::High,
            "Low" => RequestPriority::Low,
            "Background" => RequestPriority::Background,
            _ => RequestPriority::Normal,
        };
        request = request.with_priority(priority);
    }
    
    if let Some(timeout) = request_data.get("timeout").and_then(|v| v.as_u64()) {
        request = request.with_timeout(Duration::from_secs(timeout));
    }
    
    if let Some(retries) = request_data.get("retry_count").and_then(|v| v.as_u64()) {
        request.retry_count = retries as u32;
    }
    
    // Increment retry count
    request.increment_retry();
    
    Ok(serde_json::json!({
        "id": request.id,
        "retry_count": request.retry_count,
        "max_retries": request.max_retries,
        "can_retry": request.can_retry(),
        "updated": true
    }))
}

// AI Response Analysis commands
#[tauri::command]
async fn ai_analyze_response(
    response_data: serde_json::Value,
) -> Result<serde_json::Value, String> {
    use crate::ai_optimized::AIResponse;
    use std::time::Duration;
    
    // Extract response data for analysis
    let content = response_data.get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    
    let processing_time_ms = response_data.get("processing_time_ms")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    
    let success = response_data.get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    
    let tokens_used = response_data.get("tokens_used")
        .and_then(|v| v.as_u64())
        .map(|v| v as u32);
    
    // Create AIResponse for analysis
    let response = AIResponse {
        id: uuid::Uuid::new_v4().to_string(),
        request_id: response_data.get("request_id")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string(),
        content: content.to_string(),
        model_used: response_data.get("model_used")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string(),
        processing_time: Duration::from_millis(processing_time_ms),
        tokens_used,
        success,
        error: response_data.get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    };
    
    Ok(serde_json::json!({
        "response_id": response.id,
        "request_id": response.request_id,
        "content_length": response.content.len(),
        "model_used": response.model_used,
        "processing_time_ms": response.processing_time.as_millis(),
        "tokens_used": response.tokens_used,
        "success": response.success,
        "has_error": response.error.is_some(),
        "word_count": response.content.split_whitespace().count(),
        "line_count": response.content.lines().count()
    }))
}

// Direct VisionService commands
#[tauri::command]
async fn vision_initialize_service() -> Result<(), String> {
    let vision_service = vision::get_vision_service();
    let mut service = vision_service.lock().await;
    service.initialize().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn vision_capture_full_screen() -> Result<vision::ScreenCapture, String> {
    let vision_service = vision::get_vision_service();
    let service = vision_service.lock().await;
    service.capture_full_screen().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn vision_capture_region(
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<vision::ScreenCapture, String> {
    let vision_service = vision::get_vision_service();
    let service = vision_service.lock().await;
    service.capture_screen_region(x, y, width, height).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn vision_perform_ocr(
    image_path: String,
    engine: String,
) -> Result<Vec<vision::OCRResult>, String> {
    let vision_service = vision::get_vision_service();
    let service = vision_service.lock().await;
    service.perform_ocr(&image_path, &engine).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn vision_detect_ui_elements(
    image_path: String,
) -> Result<Vec<vision::VisualElement>, String> {
    let vision_service = vision::get_vision_service();
    let service = vision_service.lock().await;
    service.detect_ui_elements(&image_path).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn vision_analyze_with_ai(
    image_data: Vec<u8>,
    prompt: String,
    context: String,
    ollama_host: String,
    ollama_port: String,
) -> Result<String, String> {
    let vision_service = vision::get_vision_service();
    let service = vision_service.lock().await;
    service.analyze_screen_with_ai(image_data, prompt, context, ollama_host, ollama_port)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn vision_comprehensive_analysis(
    capture_id: String,
    image_data: Vec<u8>,
) -> Result<vision::ScreenAnalysis, String> {
    let vision_service = vision::get_vision_service();
    let service = vision_service.lock().await;
    service.analyze_screen_comprehensive(&capture_id, image_data)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn vision_check_dependencies() -> Result<(), String> {
    let vision_service = vision::get_vision_service();
    let service = vision_service.lock().await;
    service.check_vision_dependencies().await.map_err(|e| e.to_string())
}

// HTTP Client Pool Management commands
#[tauri::command]
async fn ai_create_optimized_service(
    state: State<'_, AppState>,
) -> Result<String, String> {
    use crate::ai_optimized::OptimizedAIService;
    
    let config = {
        let config_guard = state.config.read().await;
        config_guard.ai.clone()
    };
    
    match OptimizedAIService::new_with_config(&config).await {
        Ok(_service) => Ok("Optimized AI service created successfully".to_string()),
        Err(e) => Err(format!("Failed to create optimized service: {}", e))
    }
}

#[tauri::command]
async fn ai_get_pool_stats(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let ai_service = state.ai_service.read().await;
    
    // Access the optimized service if available
    if let Some(optimized) = &ai_service.optimized_service {
        let stats = optimized.get_pool_stats().await;
        Ok(serde_json::json!({
            "active_connections": stats.active_connections,
            "idle_connections": stats.idle_connections,
            "pending_requests": stats.pending_requests,
            "processed_requests": stats.processed_requests,
            "failed_requests": stats.failed_requests,
            "average_response_time": stats.average_response_time,
            "queue_by_priority": stats.queue_by_priority
        }))
    } else {
        Err("Optimized service not available".to_string())
    }
}

#[tauri::command]
async fn close_terminal(
    terminal_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut terminal_manager = state.terminal_manager.write().await;
    terminal_manager
        .kill_terminal(&terminal_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_terminal_info(
    terminal_id: String,
    state: State<'_, AppState>,
) -> Result<Option<terminal::TerminalInfo>, String> {
    let terminal_manager = state.terminal_manager.read().await;
    Ok(terminal_manager.get_terminal_info(&terminal_id))
}

#[tauri::command]
async fn list_terminals(
    state: State<'_, AppState>,
) -> Result<Vec<terminal::TerminalInfo>, String> {
    let terminal_manager = state.terminal_manager.read().await;
    Ok(terminal_manager.list_terminals())
}

#[tauri::command]
async fn get_terminal_count(
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let terminal_manager = state.terminal_manager.read().await;
    Ok(terminal_manager.get_terminal_count())
}

// System utilities
#[tauri::command]
async fn get_system_info() -> Result<HashMap<String, String>, String> {
    utils::get_system_info().map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_files(
    query: String,
    path: String,
    include_content: bool,
) -> Result<Vec<String>, String> {
    utils::search_files(&query, &path, include_content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn execute_safe_system_command(command: String) -> Result<String, String> {
    utils::execute_safe_command(&command).await.map_err(|e| e.to_string())
}

// AI System Diagnostic and Repair Commands
#[tauri::command]
async fn ai_diagnose_system(
    issue_description: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let system_info = utils::get_detailed_system_info().await.map_err(|e| e.to_string())?;
    let ai_service = state.ai_service.read().await;
    ai_service
        .diagnose_system_issue(&issue_description, &system_info)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_fix_compilation(
    error_output: String,
    project_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let project_context = utils::analyze_project_structure(&project_path).await.map_err(|e| e.to_string())?;
    let ai_service = state.ai_service.read().await;
    ai_service
        .fix_compilation_errors(&error_output, &project_context)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_fix_packages(
    package_manager: String,
    error_output: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ai_service = state.ai_service.read().await;
    ai_service
        .fix_package_issues(&package_manager, &error_output)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_fix_service(
    service_name: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let service_status = utils::get_service_status(&service_name).await.map_err(|e| e.to_string())?;
    let service_logs = utils::get_service_logs(&service_name).await.unwrap_or_default();
    let ai_service = state.ai_service.read().await;
    ai_service
        .fix_service_issues(&service_name, &service_status, &service_logs)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_fix_environment(
    tool_name: String,
    error: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let installation_context = utils::get_environment_info().await.map_err(|e| e.to_string())?;
    let ai_service = state.ai_service.read().await;
    ai_service
        .fix_environment_setup(&tool_name, &installation_context, &error)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_fix_display(
    display_error: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let desktop_env = utils::get_desktop_environment().await.unwrap_or("unknown".to_string());
    let ai_service = state.ai_service.read().await;
    ai_service
        .fix_display_issues(&display_error, &desktop_env)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_fix_network(
    network_problem: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let network_config = utils::get_network_config().await.map_err(|e| e.to_string())?;
    let ai_service = state.ai_service.read().await;
    ai_service
        .fix_network_issues(&network_problem, &network_config)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_fix_permissions(
    permission_error: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let file_context = utils::analyze_file_permissions(&file_path).await.map_err(|e| e.to_string())?;
    let ai_service = state.ai_service.read().await;
    ai_service
        .fix_permission_issues(&permission_error, &file_context)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_auto_fix(
    issue_type: String,
    context: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let ai_service = state.ai_service.read().await;
    ai_service
        .auto_fix_system(&issue_type, &context)
        .await
        .map_err(|e| e.to_string())
}

// Template execution commands
#[tauri::command]
async fn execute_template_command(
    command: String,
    working_directory: Option<String>,
) -> Result<serde_json::Value, String> {
    use tokio::process::Command;
    
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(["/C", &command]);
        c
    } else {
        let mut c = Command::new("sh");
        c.arg("-c").arg(&command);
        c
    };
    
    if let Some(wd) = working_directory {
        cmd.current_dir(wd);
    }
    
    let output = cmd.output().await.map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "output": String::from_utf8_lossy(&output.stdout),
        "exitCode": output.status.code().unwrap_or(-1)
    }))
}

#[tauri::command]
async fn import_templates(file_path: String) -> Result<Vec<serde_json::Value>, String> {
    use tokio::fs;
    
    let content = fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let templates: Vec<serde_json::Value> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
    Ok(templates)
}

#[tauri::command]
async fn export_templates(
    templates: Vec<serde_json::Value>,
    file_path: String,
) -> Result<(), String> {
    use tokio::fs;
    
    let json_content = serde_json::to_string_pretty(&templates)
        .map_err(|e| format!("Failed to serialize templates: {}", e))?;
    
    fs::write(&file_path, json_content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

// Web scraping commands - fixed thread safety
#[tauri::command]
async fn start_web_scraping(
    _job_id: String,
    options: web_scraper::ScrapingOptions,
) -> Result<String, String> {
    // Clone the scraper to avoid holding mutex across await
    let scraper = {
        let guard = web_scraper::get_web_scraper().lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    let mut scraper = scraper;
    scraper.start_scraping(options).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_scraping_progress(job_id: String) -> Result<web_scraper::ScrapingResult, String> {
    let scraper = web_scraper::get_web_scraper().lock().map_err(|e| e.to_string())?;
    scraper.get_scraping_progress(&job_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn scrape_single_page(
    url: String,
    output_path: Option<String>,
) -> Result<web_scraper::DownloadedFile, String> {
    let scraper = {
        let guard = web_scraper::get_web_scraper().lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    scraper.scrape_single_page(&url, output_path).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn extract_links(url: String) -> Result<Vec<String>, String> {
    let scraper = {
        let guard = web_scraper::get_web_scraper().lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    scraper.extract_links(&url).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn generate_site_map(
    url: String,
    max_depth: u32,
) -> Result<web_scraper::SiteMap, String> {
    let scraper = {
        let guard = web_scraper::get_web_scraper().lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    scraper.generate_site_map(&url, max_depth).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_robots_txt(url: String) -> Result<web_scraper::RobotsTxtInfo, String> {
    let scraper = {
        let guard = web_scraper::get_web_scraper().lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    scraper.check_robots_txt(&url).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_website_metadata(url: String) -> Result<web_scraper::WebsiteMetadata, String> {
    let scraper = {
        let guard = web_scraper::get_web_scraper().lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    scraper.get_website_metadata(&url).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn estimate_scraping(
    options: web_scraper::ScrapingOptions,
) -> Result<web_scraper::ScrapingEstimate, String> {
    let scraper = {
        let guard = web_scraper::get_web_scraper().lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    scraper.estimate_scraping(&options).await.map_err(|e| e.to_string())
}

// Terminal broadcasting commands
#[tauri::command]
async fn register_broadcast_session(
    session: broadcast::TerminalSession,
) -> Result<(), String> {
    let manager = broadcast::get_broadcast_manager();
    manager.register_session(session).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn unregister_broadcast_session(session_id: String) -> Result<(), String> {
    let manager = broadcast::get_broadcast_manager();
    manager.unregister_session(&session_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_broadcast_sessions() -> Result<Vec<broadcast::TerminalSession>, String> {
    let manager = broadcast::get_broadcast_manager();
    manager.get_sessions().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_broadcast_session(session_id: String) -> Result<Option<broadcast::TerminalSession>, String> {
    let manager = broadcast::get_broadcast_manager();
    manager.get_session(&session_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_session_status(
    session_id: String,
    status: broadcast::SessionStatus,
) -> Result<(), String> {
    let manager = broadcast::get_broadcast_manager();
    manager.update_session_status(&session_id, status).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn execute_on_session(
    session_id: String,
    command: String,
) -> Result<broadcast::SessionResult, String> {
    let manager = broadcast::get_broadcast_manager();
    manager.execute_on_session(&session_id, &command).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn broadcast_command(
    session_ids: Vec<String>,
    command: String,
) -> Result<broadcast::BroadcastResult, String> {
    let manager = broadcast::get_broadcast_manager();
    manager.broadcast_command(&session_ids, &command).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn import_broadcast_sessions(
    sessions: Vec<broadcast::TerminalSession>,
) -> Result<usize, String> {
    let manager = broadcast::get_broadcast_manager();
    manager.import_sessions(sessions).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_broadcast_sessions() -> Result<Vec<broadcast::TerminalSession>, String> {
    let manager = broadcast::get_broadcast_manager();
    manager.export_sessions().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_local_session(name: String) -> Result<broadcast::TerminalSession, String> {
    Ok(broadcast::BroadcastManager::create_local_session(name))
}

#[tauri::command]
async fn get_active_broadcasts() -> Result<Vec<String>, String> {
    let manager = broadcast::get_broadcast_manager();
    manager.get_active_broadcasts().await.map_err(|e| e.to_string())
}

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Initialize application state
    let config = AppConfig::load().unwrap_or_else(|e| {
        eprintln!("Warning: Failed to load config, using defaults: {}", e);
        AppConfig::default()
    });
    
    // Ensure all configured directories exist
    if let Err(e) = config.ensure_directories() {
        eprintln!("Warning: Failed to create directories: {}", e);
    }
    let terminal_manager = TerminalManager::new();
    let ai_service = AIService::new(&config.ai).await.unwrap_or_else(|e| {
        eprintln!("Warning: Failed to initialize AI service: {}", e);
        AIService::default()
    });
    
    let mut ai_optimized_service = ai_optimized::OptimizedAIService::new();
    
    // Start background tasks for the optimized AI service
    if let Err(e) = ai_optimized_service.start_background_tasks().await {
        eprintln!("Warning: Failed to start background tasks for optimized AI service: {}", e);
    }

    let app_state = AppState {
        terminal_manager: Arc::new(RwLock::new(terminal_manager)),
        ai_service: Arc::new(RwLock::new(ai_service)),
        ai_optimized_service: Arc::new(RwLock::new(ai_optimized_service)),
        config: Arc::new(RwLock::new(config)),
    };

    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            // Initialize terminal app handle for event emission
            terminal::init_app_handle(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // AI commands
            ai_chat,
            ai_complete_command,
            ai_explain_error,
            ai_generate_code,
            ai_analyze_repository,
            ai_suggest_improvements,
            ai_explain_concept,
            check_ai_connection,
            get_current_model,
            send_ai_message,
            get_terminal_context,
            // AI System Diagnostic and Repair
            ai_diagnose_system,
            ai_fix_compilation,
            ai_fix_packages,
            ai_fix_service,
            ai_fix_environment,
            ai_fix_display,
            ai_fix_network,
            ai_fix_permissions,
            ai_auto_fix,
            // Computer Vision commands (from vision_commands module)
            vision_commands::capture_screen,
            vision_commands::capture_screen_region,
            vision_commands::perform_ocr,
            vision_commands::detect_ui_elements,
            vision_commands::query_vision_ai,
            vision_commands::check_vision_dependencies,
            // Terminal commands
            create_terminal,
            create_simple_terminal,
            write_to_terminal,
            resize_terminal,
            kill_terminal,
            close_terminal,
            get_terminal_info,
            list_terminals,
            get_terminal_count,
            // Git commands
            git_status,
            git_generate_commit,
            git_get_branch_name,
            git_is_repo,
            git_get_recent_commits,
            git_get_remote_url,
            git_get_ahead_behind,
            git_get_branch_info,
            git_get_all_branches,
            git_get_stash_list,
            git_get_commit_changes,
            git_get_repository_stats,
            // Contextual suggestions commands
            get_contextual_suggestions,
            get_current_context,
            learn_from_command,
            // Config commands
            get_config,
            update_config,
            get_temp_file_path,
            get_cache_file_path,
            // System utilities
            get_system_info,
            search_files,
            execute_safe_system_command,
            // Window controls
            minimize_window,
            toggle_maximize,
            close_window,
            // Template commands
            execute_template_command,
            import_templates,
            export_templates,
            // Web scraping commands
            start_web_scraping,
            get_scraping_progress,
            scrape_single_page,
            extract_links,
            generate_site_map,
            check_robots_txt,
            get_website_metadata,
            estimate_scraping,
            // Terminal broadcasting commands
            register_broadcast_session,
            unregister_broadcast_session,
            get_broadcast_sessions,
            get_broadcast_session,
            update_session_status,
            execute_on_session,
            broadcast_command,
            import_broadcast_sessions,
            export_broadcast_sessions,
            create_local_session,
            get_active_broadcasts,
            // AI service management
            restart_ai_service,
            ai_clear_completed_requests,
            // Optimized AI service commands
            ai_submit_priority_request,
            ai_batch_process,
            ai_get_service_stats,
            ai_clear_completed,
            ai_analyze_critical_error,
            ai_chat_async,
            ai_submit_async_request,
            // Advanced AI Request Builder commands
            ai_create_simple_request,
            ai_create_custom_request,
            ai_increment_request_retry,
            ai_analyze_response,
            // Direct Vision Service commands
            vision_initialize_service,
            vision_capture_full_screen,
            vision_capture_region,
            vision_perform_ocr,
            vision_detect_ui_elements,
            vision_analyze_with_ai,
            vision_comprehensive_analysis,
            vision_check_dependencies,
            // HTTP Client Pool Management
            ai_create_optimized_service,
            ai_get_pool_stats,
        ])
        .run(tauri::generate_context!())
        .map_err(|e| {
            eprintln!("Failed to run Tauri application: {}", e);
            std::process::exit(1);
        })
        .unwrap();
}
