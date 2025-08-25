// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::{Manager, State};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use anyhow::Result;

mod ai;
mod terminal;
mod git;
mod config;
mod utils;

use ai::AIService;
use terminal::TerminalManager;
use config::AppConfig;

#[derive(Debug, Serialize, Deserialize)]
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

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Initialize application state
    let config = AppConfig::load().unwrap_or_default();
    let terminal_manager = TerminalManager::new();
    let ai_service = AIService::new(&config.ai).await.expect("Failed to initialize AI service");

    let app_state = AppState {
        terminal_manager: Arc::new(RwLock::new(terminal_manager)),
        ai_service: Arc::new(RwLock::new(ai_service)),
        config: Arc::new(RwLock::new(config)),
    };

    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            // Setup system tray
            let handle = app.handle();
            
            // Auto-updater setup
            #[cfg(desktop)]
            {
                let handle = handle.clone();
                tokio::spawn(async move {
                    let _ = tauri::updater::builder(handle).check().await;
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // AI commands
            ai_chat,
            ai_complete_command,
            ai_explain_error,
            ai_generate_code,
            // Terminal commands
            create_terminal,
            write_to_terminal,
            resize_terminal,
            kill_terminal,
            // Git commands
            git_status,
            git_generate_commit,
            // Config commands
            get_config,
            update_config,
            // System utilities
            get_system_info,
            search_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
