use anyhow::{Context, Result};
use std::collections::HashMap;
use tokio::process::Command;
use walkdir::WalkDir;
use ignore::WalkBuilder;

pub fn get_system_info() -> Result<HashMap<String, String>> {
    let mut info = HashMap::new();
    
    // OS Information
    info.insert("os".to_string(), std::env::consts::OS.to_string());
    info.insert("arch".to_string(), std::env::consts::ARCH.to_string());
    
    // Hostname
    if let Ok(hostname) = std::process::Command::new("hostname").output() {
        if let Ok(hostname_str) = String::from_utf8(hostname.stdout) {
            info.insert("hostname".to_string(), hostname_str.trim().to_string());
        }
    }
    
    // User
    if let Ok(user) = std::env::var("USER") {
        info.insert("user".to_string(), user);
    } else if let Ok(user) = std::env::var("USERNAME") {
        info.insert("user".to_string(), user);
    }
    
    // Shell
    if let Ok(shell) = std::env::var("SHELL") {
        info.insert("shell".to_string(), shell);
    }
    
    // Current directory
    if let Ok(cwd) = std::env::current_dir() {
        info.insert("cwd".to_string(), cwd.display().to_string());
    }
    
    Ok(info)
}

pub async fn search_files(query: &str, path: &str, include_content: bool) -> Result<Vec<String>> {
    let mut results = Vec::new();
    
    let walker = WalkBuilder::new(path)
        .hidden(false)
        .git_ignore(true)
        .build();
    
    for entry in walker {
        let entry = entry.context("Failed to read directory entry")?;
        let path = entry.path();
        
        if path.is_file() {
            let path_str = path.display().to_string();
            
            // Search in filename
            if path_str.to_lowercase().contains(&query.to_lowercase()) {
                results.push(format!("file:{}", path_str));
                continue;
            }
            
            // Search in file content if requested
            if include_content {
                if let Ok(content) = tokio::fs::read_to_string(path).await {
                    if content.to_lowercase().contains(&query.to_lowercase()) {
                        results.push(format!("content:{}", path_str));
                    }
                }
            }
        }
    }
    
    Ok(results)
}

pub fn get_file_tree(path: &str, max_depth: Option<usize>) -> Result<String> {
    let mut tree = String::new();
    let walker = WalkDir::new(path);
    
    let walker = if let Some(depth) = max_depth {
        walker.max_depth(depth)
    } else {
        walker
    };
    
    for entry in walker {
        let entry = entry.context("Failed to read directory entry")?;
        let path = entry.path();
        let depth = entry.depth();
        
        // Create indentation based on depth
        let indent = "  ".repeat(depth);
        let name = path.file_name()
            .map(|n| n.to_string_lossy())
            .unwrap_or_else(|| "?".into());
        
        if path.is_dir() {
            tree.push_str(&format!("{}📁 {}/\n", indent, name));
        } else {
            let icon = get_file_icon(&name);
            tree.push_str(&format!("{}{} {}\n", indent, icon, name));
        }
    }
    
    Ok(tree)
}

fn get_file_icon(filename: &str) -> &'static str {
    let ext = std::path::Path::new(filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    
    match ext.to_lowercase().as_str() {
        "rs" => "🦀",
        "js" | "ts" => "📜",
        "vue" => "💚",
        "py" => "🐍",
        "go" => "🐹",
        "java" => "☕",
        "cpp" | "c" => "⚡",
        "html" => "🌐",
        "css" => "🎨",
        "md" => "📝",
        "json" => "📋",
        "toml" | "yaml" | "yml" => "⚙️",
        "sh" | "bash" => "📟",
        "git" => "🌿",
        "lock" => "🔒",
        _ => "📄",
    }
}

pub async fn execute_safe_command(command: &str) -> Result<String> {
    let safe_commands = [
        "ls", "pwd", "whoami", "date", "uname", "df", "free", "ps", "top",
        "git status", "git log", "git branch", "git diff",
        "npm list", "cargo --version", "rustc --version",
        "node --version", "python --version"
    ];
    
    // Check if command is in safe list
    let is_safe = safe_commands.iter().any(|&safe_cmd| {
        command.trim().starts_with(safe_cmd)
    });
    
    if !is_safe {
        return Err(anyhow::anyhow!("Command not in safe list: {}", command));
    }
    
    // Parse command and arguments
    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return Err(anyhow::anyhow!("Empty command"));
    }
    
    let mut cmd = Command::new(parts[0]);
    if parts.len() > 1 {
        cmd.args(&parts[1..]);
    }
    
    let output = cmd.output().await
        .context("Failed to execute command")?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(anyhow::anyhow!("Command failed: {}", error))
    }
}
