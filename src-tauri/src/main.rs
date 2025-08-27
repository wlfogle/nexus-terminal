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

use ai::AIService;
use terminal::TerminalManager;
use config::AppConfig;

#[derive(Debug)]
struct AppState {
    terminal_manager: Arc<RwLock<TerminalManager>>,
    ai_service: Arc<RwLock<AIService>>,
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
    let terminal_manager = TerminalManager::new();
    let ai_service = AIService::new(&config.ai).await.unwrap_or_else(|e| {
        eprintln!("Warning: Failed to initialize AI service: {}", e);
        AIService::default()
    });

    let app_state = AppState {
        terminal_manager: Arc::new(RwLock::new(terminal_manager)),
        ai_service: Arc::new(RwLock::new(ai_service)),
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
            // Computer Vision commands
            vision_commands::capture_screen,
            vision_commands::capture_screen_region,
            vision_commands::perform_ocr,
            vision_commands::detect_ui_elements,
            vision_commands::query_vision_ai,
            vision_commands::check_vision_dependencies,
            // Terminal commands
            create_terminal,
            write_to_terminal,
            resize_terminal,
            kill_terminal,
            close_terminal,
            // Git commands
            git_status,
            git_generate_commit,
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
