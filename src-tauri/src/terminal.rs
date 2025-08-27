use anyhow::{Context, Result};
use portable_pty::{Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use tracing::{debug, error, info};
use uuid::Uuid;
use tauri::AppHandle;

// Global app handle for event emission
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

/// Initialize the global app handle for event emission
pub fn init_app_handle(app_handle: AppHandle) {
    let _ = APP_HANDLE.set(app_handle);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub id: String,
    pub shell: String,
    pub cwd: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

struct Terminal {
    _child: Box<dyn Child + Send + Sync>,
    master: Box<dyn MasterPty + Send + Sync>,
    info: TerminalInfo,
}

#[derive(Debug)]
pub struct TerminalManager {
    terminals: Arc<Mutex<HashMap<String, Terminal>>>,
    pty_system: Box<dyn portable_pty::PtySystem>,
}

impl TerminalManager {
    pub fn new() -> Self {
        let pty_system = portable_pty::native_pty_system();
        
        Self {
            terminals: Arc::new(Mutex::new(HashMap::new())),
            pty_system,
        }
    }

    pub async fn create_terminal(&mut self, shell: Option<String>) -> Result<String> {
        let terminal_id = Uuid::new_v4().to_string();
        
        // Determine shell
        let shell_cmd = shell.unwrap_or_else(|| {
            std::env::var("SHELL").unwrap_or_else(|_| {
                if cfg!(windows) {
                    "powershell.exe".to_string()
                } else {
                    "/bin/bash".to_string()
                }
            })
        });

        // Get current working directory
        let cwd = std::env::current_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("/"))
            .to_string_lossy()
            .to_string();

        // Create PTY
        let pty_pair = self.pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("Failed to create PTY")?;

        // Build command
        let mut cmd = CommandBuilder::new(&shell_cmd);
        if !cfg!(windows) {
            cmd.env("TERM", "xterm-256color");
        }
        cmd.cwd(&cwd);

        // Spawn process
        let child = pty_pair.slave
            .spawn_command(cmd)
            .context("Failed to spawn shell process")?;

        let terminal_info = TerminalInfo {
            id: terminal_id.clone(),
            shell: shell_cmd,
            cwd,
            created_at: chrono::Utc::now(),
        };

        let terminal = Terminal {
            _child: child,
            master: pty_pair.master,
            info: terminal_info,
        };

        // Store terminal
        {
            let mut terminals = self.terminals.lock().unwrap();
            terminals.insert(terminal_id.clone(), terminal);
        }

        // Start reading output in a separate thread
        self.start_output_reader(&terminal_id).await?;

        info!("Created terminal with ID: {}", terminal_id);
        Ok(terminal_id)
    }

    async fn start_output_reader(&self, terminal_id: &str) -> Result<()> {
        let terminals = Arc::clone(&self.terminals);
        let terminal_id = terminal_id.to_string();

        tokio::spawn(async move {
            let mut reader = {
                let terminals_guard = terminals.lock().unwrap();
                if let Some(terminal) = terminals_guard.get(&terminal_id) {
                    terminal.master.try_clone_reader().unwrap()
                } else {
                    error!("Terminal {} not found when starting output reader", terminal_id);
                    return;
                }
            };

            let mut buffer = [0u8; 8192];
            loop {
                match reader.read(&mut buffer) {
                    Ok(n) if n > 0 => {
                        let output = String::from_utf8_lossy(&buffer[..n]);
                        debug!("Terminal {} output: {}", terminal_id, output);
                        
                        // Emit output to frontend via Tauri events
                        if let Some(app_handle) = APP_HANDLE.get() {
                            let event = TerminalOutputEvent {
                                terminal_id: terminal_id.clone(),
                                data: output.to_string(),
                            };
                            if let Err(e) = app_handle.emit_all("terminal-output", &event) {
                                error!("Failed to emit terminal output: {}", e);
                            }
                        }
                    }
                    Ok(_) => {
                        debug!("No data read from terminal {}", terminal_id);
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(e) => {
                        error!("Error reading from terminal {}: {}", terminal_id, e);
                        break;
                    }
                }
            }

            info!("Output reader for terminal {} terminated", terminal_id);
        });

        Ok(())
    }

    pub async fn write_to_terminal(&self, terminal_id: &str, data: &str) -> Result<()> {
        let terminals = self.terminals.lock().unwrap();
        
        if let Some(terminal) = terminals.get(terminal_id) {
            let mut writer = terminal.master.take_writer()
                .context("Failed to get terminal writer")?;
            
            writer.write_all(data.as_bytes())
                .context("Failed to write to terminal")?;
            
            writer.flush()
                .context("Failed to flush terminal writer")?;
            
            debug!("Wrote {} bytes to terminal {}", data.len(), terminal_id);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Terminal {} not found", terminal_id))
        }
    }

    pub async fn resize_terminal(&self, terminal_id: &str, cols: u16, rows: u16) -> Result<()> {
        let terminals = self.terminals.lock().unwrap();
        
        if let Some(terminal) = terminals.get(terminal_id) {
            let new_size = PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            };
            
            terminal.master.resize(new_size)
                .context("Failed to resize terminal")?;
            
            debug!("Resized terminal {} to {}x{}", terminal_id, cols, rows);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Terminal {} not found", terminal_id))
        }
    }

    pub async fn kill_terminal(&mut self, terminal_id: &str) -> Result<()> {
        let mut terminals = self.terminals.lock().unwrap();
        
        if let Some(_terminal) = terminals.remove(terminal_id) {
            // Terminal will be dropped and cleaned up automatically
            info!("Killed terminal {}", terminal_id);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Terminal {} not found", terminal_id))
        }
    }

    pub fn get_terminal_info(&self, terminal_id: &str) -> Option<TerminalInfo> {
        let terminals = self.terminals.lock().unwrap();
        terminals.get(terminal_id).map(|t| t.info.clone())
    }

    pub fn list_terminals(&self) -> Vec<TerminalInfo> {
        let terminals = self.terminals.lock().unwrap();
        terminals.values().map(|t| t.info.clone()).collect()
    }

    pub fn get_terminal_count(&self) -> usize {
        let terminals = self.terminals.lock().unwrap();
        terminals.len()
    }
}

// Events for frontend communication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutputEvent {
    pub terminal_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalExitEvent {
    pub terminal_id: String,
    pub exit_code: Option<i32>,
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}
