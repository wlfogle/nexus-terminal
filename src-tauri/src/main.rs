// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;
use anyhow::Result;

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
use terminal::TerminalManager;
use config::AppConfig;
use vision::VisionService;
use ai_optimized::OptimizedAIService;

#[derive(Debug)]
struct AppState {
    terminal_manager: Arc<RwLock<TerminalManager>>,
    ai_service: Arc<RwLock<AIService>>,
    optimized_ai_service: Arc<RwLock<OptimizedAIService>>,
    vision_service: Arc<RwLock<VisionService>>,
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

// OptimizedAIService commands
#[tauri::command]
async fn optimized_ai_chat(
    message: String,
    context: Option<String>,
    priority: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    use ai_optimized::{AIRequest, RequestPriority};
    
    let optimized_service = state.optimized_ai_service.read().await;
    
    let priority_level = match priority.as_deref() {
        Some("critical") => RequestPriority::Critical,
        Some("high") => RequestPriority::High,
        Some("background") => RequestPriority::Background,
        _ => RequestPriority::Normal,
    };
    
    let request = AIRequest::new(message)
        .with_priority(priority_level);
    
    let request = if let Some(ctx) = context {
        request.with_context(ctx)
    } else {
        request
    };
    
    let response = optimized_service.chat_async(&request.prompt, request.context.as_deref()).await
        .map_err(|e| e.to_string())?;
    
    Ok(response.content)
}

#[tauri::command]
async fn get_ai_service_stats(
    state: State<'_, AppState>,
) -> Result<ai_optimized::PoolStats, String> {
    let optimized_service = state.optimized_ai_service.read().await;
    Ok(optimized_service.get_stats().await)
}

#[tauri::command]
async fn force_ai_cleanup(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let optimized_service = state.optimized_ai_service.read().await;
    optimized_service.force_cleanup().await;
    Ok(())
}

#[tauri::command]
async fn submit_ai_request(
    message: String,
    priority: String,
    timeout_seconds: Option<u64>,
    context: Option<String>,
    model: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    use ai_optimized::{AIRequest, RequestPriority};
    use std::time::Duration;
    
    let priority_level = match priority.as_str() {
        "critical" => RequestPriority::Critical,
        "high" => RequestPriority::High,
        "background" => RequestPriority::Background,
        _ => RequestPriority::Normal,
    };
    
    let mut request = AIRequest::new(message).with_priority(priority_level);
    
    if let Some(timeout) = timeout_seconds {
        request = request.with_timeout(Duration::from_secs(timeout));
    }
    
    if let Some(ctx) = context {
        request = request.with_context(ctx);
    }
    
    if let Some(mdl) = model {
        request = request.with_model(mdl);
    }
    
    let optimized_service = state.optimized_ai_service.read().await;
    let mut response_rx = optimized_service.submit_request(request).await.map_err(|e| e.to_string())?;
    
    // Wait for response
    match response_rx.recv().await {
        Some(response) => {
            if response.success {
                Ok(response.content)
            } else {
                Err(response.error.unwrap_or_else(|| "Unknown error".to_string()))
            }
        }
        None => Err("No response received".to_string()),
    }
}

// Vision service commands
#[tauri::command]
async fn analyze_screen_with_ai(
    image_data: Vec<u8>,
    _prompt: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let vision_service = state.vision_service.read().await;
    let capture_id = uuid::Uuid::new_v4().to_string();
    vision_service
        .analyze_screen_comprehensive(&capture_id, image_data)
        .await
        .map(|analysis| analysis.summary)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn capture_and_analyze_screen(
    state: State<'_, AppState>,
) -> Result<vision::ScreenAnalysis, String> {
    let vision_service = state.vision_service.read().await;
    let capture = vision_service.capture_full_screen().await.map_err(|e| e.to_string())?;
    let capture_id = uuid::Uuid::new_v4().to_string();
    vision_service
        .analyze_screen_comprehensive(&capture_id, capture.data)
        .await
        .map_err(|e| e.to_string())
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
    
    let optimized_ai_service = match OptimizedAIService::new(&config.ai).await {
        Ok(service) => service,
        Err(e) => {
            eprintln!("Warning: Failed to initialize OptimizedAIService: {}", e);
            // Try creating a fallback service
            match OptimizedAIService::new(&config.ai).await {
                Ok(service) => service,
                Err(e2) => {
                    eprintln!("Fatal: Could not initialize fallback AI service: {}", e2);
                    std::process::exit(1);
                }
            }
        }
    };
    
    let mut vision_service = VisionService::new();
    if let Err(e) = vision_service.initialize().await {
        eprintln!("Warning: Failed to initialize vision service: {}", e);
    }

    let app_state = AppState {
        terminal_manager: Arc::new(RwLock::new(terminal_manager)),
        ai_service: Arc::new(RwLock::new(ai_service)),
        optimized_ai_service: Arc::new(RwLock::new(optimized_ai_service)),
        vision_service: Arc::new(RwLock::new(vision_service)),
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
            // Vision service direct commands
            analyze_screen_with_ai,
            capture_and_analyze_screen,
            // Enhanced vision service commands
            vision_commands::capture_screen_enhanced,
            vision_commands::capture_region_enhanced,
            vision_commands::perform_ocr_enhanced,
            vision_commands::analyze_screenshot,
            vision_commands::get_vision_stats,
            vision_commands::check_vision_service_status,
            // Terminal commands
            create_terminal,
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
            // Config commands
            get_config,
            update_config,
            // System utilities
            get_system_info,
            search_files,
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
            // AI service management
            restart_ai_service,
        ])
        .run(tauri::generate_context!())
        .map_err(|e| {
            eprintln!("Failed to run Tauri application: {}", e);
            std::process::exit(1);
        })
        .unwrap();
}
