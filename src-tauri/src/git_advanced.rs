use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Command, Stdio};
use chrono::{DateTime, Utc};
use tokio::process::Command as TokioCommand;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitNode {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub date: DateTime<Utc>,
    pub parents: Vec<String>,
    pub children: Vec<String>,
    pub refs: Vec<String>,
    pub x: f64,
    pub y: f64,
    pub branch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitEdge {
    pub from: String,
    pub to: String,
    pub branch: Option<String>,
    pub merge: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitGraph {
    pub nodes: HashMap<String, GitNode>,
    pub edges: Vec<GitEdge>,
    pub branches: Vec<BranchInfo>,
    pub current_branch: String,
    pub head_commit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub commit: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub last_commit_date: DateTime<Utc>,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitTimeTravel {
    pub commit: String,
    pub timestamp: DateTime<Utc>,
    pub message: String,
    pub author: String,
    pub changes: Vec<FileChange>,
    pub branch_state: BranchState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub path: String,
    pub status: ChangeStatus,
    pub additions: u32,
    pub deletions: u32,
    pub content_diff: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChangeStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchState {
    pub active_branches: Vec<String>,
    pub merged_branches: Vec<String>,
    pub tags: Vec<String>,
    pub stashes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitVisualization {
    pub graph: GitGraph,
    pub timeline: Vec<GitTimeTravel>,
    pub statistics: GitStatistics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatistics {
    pub total_commits: u32,
    pub total_branches: u32,
    pub total_contributors: u32,
    pub lines_added: u32,
    pub lines_deleted: u32,
    pub files_changed: u32,
    pub commit_frequency: HashMap<String, u32>, // date -> count
    pub author_stats: HashMap<String, AuthorStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorStats {
    pub commits: u32,
    pub lines_added: u32,
    pub lines_deleted: u32,
    pub files_touched: u32,
    pub first_commit: DateTime<Utc>,
    pub last_commit: DateTime<Utc>,
}

pub struct GitAdvanced {
    pub repo_path: String,
}

impl GitAdvanced {
    pub fn new(repo_path: &str) -> Self {
        Self {
            repo_path: repo_path.to_string(),
        }
    }

    /// Generate a complete visual git graph with positioned nodes
    pub async fn generate_visual_graph(&self, max_commits: Option<u32>) -> Result<GitGraph> {
        let limit = max_commits.unwrap_or(100);
        
        // Get commit history with formatting
        let output = TokioCommand::new("git")
            .args([
                "log", 
                &format!("--max-count={}", limit),
                "--graph",
                "--pretty=format:%H|%h|%P|%s|%an|%ae|%ai|%D",
                "--all"
            ])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!("Git log failed: {}", String::from_utf8_lossy(&output.stderr)));
        }

        let log_output = String::from_utf8(output.stdout)?;
        let mut nodes = HashMap::new();
        let mut edges = Vec::new();

        // Parse commits and create nodes
        for line in log_output.lines() {
            if line.contains('|') && !line.trim().starts_with('*') && !line.trim().starts_with('\\') {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 7 {
                    let hash = parts[0].trim().to_string();
                    let short_hash = parts[1].trim().to_string();
                    let parents: Vec<String> = if !parts[2].trim().is_empty() {
                        parts[2].trim().split_whitespace().map(|s| s.to_string()).collect()
                    } else {
                        Vec::new()
                    };
                    let message = parts[3].trim().to_string();
                    let author = parts[4].trim().to_string();
                    let author_email = parts[5].trim().to_string();
                    let date = DateTime::parse_from_rfc3339(parts[6].trim())?.with_timezone(&Utc);
                    let refs_str = if parts.len() > 7 { parts[7].trim() } else { "" };
                    let refs: Vec<String> = if !refs_str.is_empty() {
                        refs_str.split(", ").map(|s| s.to_string()).collect()
                    } else {
                        Vec::new()
                    };

                    let node = GitNode {
                        hash: hash.clone(),
                        short_hash,
                        message,
                        author,
                        author_email,
                        date,
                        parents: parents.clone(),
                        children: Vec::new(),
                        refs,
                        x: 0.0,
                        y: 0.0,
                        branch: None,
                    };

                    nodes.insert(hash.clone(), node);

                    // Create edges
                    for parent in parents {
                        edges.push(GitEdge {
                            from: parent,
                            to: hash.clone(),
                            branch: None,
                            merge: false,
                        });
                    }
                }
            }
        }

        // Fill in children
        for edge in &edges {
            if let Some(parent) = nodes.get_mut(&edge.from) {
                parent.children.push(edge.to.clone());
            }
        }

        // Position nodes using a simple layout algorithm
        self.position_nodes(&mut nodes);

        // Get branches
        let branches = self.get_branch_info().await?;
        let current_branch = self.get_current_branch().await?;
        let head_commit = self.get_head_commit().await?;

        Ok(GitGraph {
            nodes,
            edges,
            branches,
            current_branch,
            head_commit,
        })
    }

    /// Position nodes in the graph using a layered approach
    fn position_nodes(&self, nodes: &mut HashMap<String, GitNode>) {
        let mut y_pos = 0.0;
        let mut visited = std::collections::HashSet::new();
        let mut roots = Vec::new();

        // Find root nodes (commits with no parents)
        for (hash, node) in nodes.iter() {
            if node.parents.is_empty() {
                roots.push(hash.clone());
            }
        }

        // Topological sort and positioning
        let mut queue = std::collections::VecDeque::new();
        for root in roots {
            queue.push_back(root);
        }

        while let Some(hash) = queue.pop_front() {
            if !visited.insert(hash.clone()) {
                continue;
            }

            if let Some(node) = nodes.get_mut(&hash) {
                node.y = y_pos;
                node.x = self.calculate_x_position(&node.refs, &node.parents);
                y_pos += 1.0;

                // Add children to queue
                for child in &node.children {
                    if !visited.contains(child) {
                        queue.push_back(child.clone());
                    }
                }
            }
        }
    }

    /// Calculate X position based on branch information
    fn calculate_x_position(&self, refs: &[String], parents: &[String]) -> f64 {
        // Simple branch-based positioning
        let mut x = 0.0;
        
        // Check if this is a merge commit
        if parents.len() > 1 {
            x += 0.5;
        }

        // Position based on branch references
        for ref_name in refs {
            if ref_name.contains("origin/") {
                x += 0.2;
            } else if ref_name.contains("HEAD") {
                x += 0.1;
            }
        }

        x
    }

    /// Get detailed branch information
    pub async fn get_branch_info(&self) -> Result<Vec<BranchInfo>> {
        let output = TokioCommand::new("git")
            .args(["branch", "-vv", "--all"])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!("Git branch failed: {}", String::from_utf8_lossy(&output.stderr)));
        }

        let branch_output = String::from_utf8(output.stdout)?;
        let mut branches = Vec::new();

        for line in branch_output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            let is_current = line.starts_with('*');
            let is_remote = line.contains("remotes/");
            
            // Parse branch name and commit
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let name = if is_current {
                    parts[1].to_string()
                } else {
                    parts[0].to_string()
                };
                
                let commit = if is_current {
                    parts[2].to_string()
                } else {
                    parts[1].to_string()
                };

                // Get additional branch details
                let (ahead, behind) = self.get_branch_ahead_behind(&name).await.unwrap_or((0, 0));
                let (last_commit_date, author) = self.get_branch_last_commit(&name).await
                    .unwrap_or_else(|_| (Utc::now(), "Unknown".to_string()));

                branches.push(BranchInfo {
                    name: name.clone(),
                    commit,
                    is_current,
                    is_remote,
                    upstream: None, // TODO: Parse upstream from -vv output
                    ahead,
                    behind,
                    last_commit_date,
                    author,
                });
            }
        }

        Ok(branches)
    }

    /// Get current branch name
    async fn get_current_branch(&self) -> Result<String> {
        let output = TokioCommand::new("git")
            .args(["branch", "--show-current"])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!("Git branch --show-current failed"));
        }

        Ok(String::from_utf8(output.stdout)?.trim().to_string())
    }

    /// Get HEAD commit hash
    async fn get_head_commit(&self) -> Result<String> {
        let output = TokioCommand::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!("Git rev-parse HEAD failed"));
        }

        Ok(String::from_utf8(output.stdout)?.trim().to_string())
    }

    /// Get ahead/behind count for a branch
    async fn get_branch_ahead_behind(&self, branch: &str) -> Result<(u32, u32)> {
        let output = TokioCommand::new("git")
            .args(["rev-list", "--count", "--left-right", &format!("{}...HEAD", branch)])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Ok((0, 0));
        }

        let counts = String::from_utf8(output.stdout)?;
        let parts: Vec<&str> = counts.trim().split_whitespace().collect();
        if parts.len() == 2 {
            let behind = parts[0].parse::<u32>().unwrap_or(0);
            let ahead = parts[1].parse::<u32>().unwrap_or(0);
            Ok((ahead, behind))
        } else {
            Ok((0, 0))
        }
    }

    /// Get last commit date and author for a branch
    async fn get_branch_last_commit(&self, branch: &str) -> Result<(DateTime<Utc>, String)> {
        let output = TokioCommand::new("git")
            .args(["log", "-1", "--pretty=format:%ai|%an", branch])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!("Git log failed for branch {}", branch));
        }

        let result = String::from_utf8(output.stdout)?;
        let parts: Vec<&str> = result.trim().split('|').collect();
        if parts.len() == 2 {
            let date = DateTime::parse_from_rfc3339(parts[0])?.with_timezone(&Utc);
            let author = parts[1].to_string();
            Ok((date, author))
        } else {
            Err(anyhow!("Failed to parse branch commit info"))
        }
    }

    /// Generate time travel information for a specific commit
    pub async fn generate_time_travel(&self, commit: &str) -> Result<GitTimeTravel> {
        // Get commit information
        let output = TokioCommand::new("git")
            .args(["show", "--pretty=format:%ai|%s|%an", "--name-status", commit])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!("Git show failed: {}", String::from_utf8_lossy(&output.stderr)));
        }

        let show_output = String::from_utf8(output.stdout)?;
        let lines: Vec<&str> = show_output.lines().collect();
        
        if lines.is_empty() {
            return Err(anyhow!("No commit information found"));
        }

        let commit_info: Vec<&str> = lines[0].split('|').collect();
        if commit_info.len() != 3 {
            return Err(anyhow!("Failed to parse commit info"));
        }

        let timestamp = DateTime::parse_from_rfc3339(commit_info[0])?.with_timezone(&Utc);
        let message = commit_info[1].to_string();
        let author = commit_info[2].to_string();

        // Parse file changes
        let mut changes = Vec::new();
        for line in &lines[1..] {
            if line.is_empty() {
                continue;
            }
            
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let status_char = parts[0].chars().next().unwrap_or(' ');
                let status = match status_char {
                    'A' => ChangeStatus::Added,
                    'M' => ChangeStatus::Modified,
                    'D' => ChangeStatus::Deleted,
                    'R' => ChangeStatus::Renamed,
                    'C' => ChangeStatus::Copied,
                    _ => ChangeStatus::Modified,
                };

                let path = parts[1].to_string();
                
                // Get diff stats for this file
                let (additions, deletions) = self.get_file_diff_stats(commit, &path).await
                    .unwrap_or((0, 0));

                changes.push(FileChange {
                    path,
                    status,
                    additions,
                    deletions,
                    content_diff: None, // TODO: Get actual diff content if needed
                });
            }
        }

        // Get branch state at this commit
        let branch_state = self.get_branch_state_at_commit(commit).await?;

        Ok(GitTimeTravel {
            commit: commit.to_string(),
            timestamp,
            message,
            author,
            changes,
            branch_state,
        })
    }

    /// Get diff stats for a specific file in a commit
    async fn get_file_diff_stats(&self, commit: &str, file_path: &str) -> Result<(u32, u32)> {
        let output = TokioCommand::new("git")
            .args(["diff", "--numstat", &format!("{}^", commit), commit, "--", file_path])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Ok((0, 0));
        }

        let numstat = String::from_utf8(output.stdout)?;
        let parts: Vec<&str> = numstat.trim().split_whitespace().collect();
        if parts.len() >= 2 {
            let additions = parts[0].parse::<u32>().unwrap_or(0);
            let deletions = parts[1].parse::<u32>().unwrap_or(0);
            Ok((additions, deletions))
        } else {
            Ok((0, 0))
        }
    }

    /// Get branch state at a specific commit
    async fn get_branch_state_at_commit(&self, commit: &str) -> Result<BranchState> {
        // Get branches that contain this commit
        let output = TokioCommand::new("git")
            .args(["branch", "--contains", commit])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        let active_branches = if output.status.success() {
            String::from_utf8(output.stdout)?
                .lines()
                .map(|line| line.trim().trim_start_matches("* ").to_string())
                .filter(|branch| !branch.is_empty())
                .collect()
        } else {
            Vec::new()
        };

        // Get tags at this commit
        let tag_output = TokioCommand::new("git")
            .args(["tag", "--points-at", commit])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        let tags = if tag_output.status.success() {
            String::from_utf8(tag_output.stdout)?
                .lines()
                .map(|line| line.trim().to_string())
                .filter(|tag| !tag.is_empty())
                .collect()
        } else {
            Vec::new()
        };

        Ok(BranchState {
            active_branches,
            merged_branches: Vec::new(), // TODO: Implement merged branch detection
            tags,
            stashes: Vec::new(), // TODO: Implement stash detection
        })
    }

    /// Generate comprehensive git statistics
    pub async fn generate_statistics(&self) -> Result<GitStatistics> {
        // Get total commits
        let total_commits = self.get_total_commits().await?;
        
        // Get total branches
        let branches = self.get_branch_info().await?;
        let total_branches = branches.len() as u32;
        
        // Get contributors
        let contributors = self.get_contributors().await?;
        let total_contributors = contributors.len() as u32;
        
        // Get line statistics
        let (lines_added, lines_deleted, files_changed) = self.get_line_statistics().await?;
        
        // Get commit frequency
        let commit_frequency = self.get_commit_frequency().await?;
        
        // Get author statistics
        let author_stats = self.get_author_statistics().await?;

        Ok(GitStatistics {
            total_commits,
            total_branches,
            total_contributors,
            lines_added,
            lines_deleted,
            files_changed,
            commit_frequency,
            author_stats,
        })
    }

    /// Get total number of commits
    async fn get_total_commits(&self) -> Result<u32> {
        let output = TokioCommand::new("git")
            .args(["rev-list", "--count", "HEAD"])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Ok(0);
        }

        let count = String::from_utf8(output.stdout)?.trim().parse::<u32>()?;
        Ok(count)
    }

    /// Get list of contributors
    async fn get_contributors(&self) -> Result<Vec<String>> {
        let output = TokioCommand::new("git")
            .args(["shortlog", "-sn", "HEAD"])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Ok(Vec::new());
        }

        let contributors = String::from_utf8(output.stdout)?
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.trim().splitn(2, ' ').collect();
                if parts.len() == 2 {
                    Some(parts[1].to_string())
                } else {
                    None
                }
            })
            .collect();

        Ok(contributors)
    }

    /// Get overall line statistics
    async fn get_line_statistics(&self) -> Result<(u32, u32, u32)> {
        let output = TokioCommand::new("git")
            .args(["diff", "--shortstat", "4b825dc642cb6eb9a060e54bf8d69288fbee4904", "HEAD"])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Ok((0, 0, 0));
        }

        let shortstat = String::from_utf8(output.stdout)?;
        let mut files_changed = 0;
        let mut lines_added = 0;
        let mut lines_deleted = 0;

        // Parse shortstat output
        for word in shortstat.split_whitespace() {
            if let Ok(num) = word.parse::<u32>() {
                if shortstat.contains("files changed") && files_changed == 0 {
                    files_changed = num;
                } else if shortstat.contains("insertions") && lines_added == 0 {
                    lines_added = num;
                } else if shortstat.contains("deletions") && lines_deleted == 0 {
                    lines_deleted = num;
                }
            }
        }

        Ok((lines_added, lines_deleted, files_changed))
    }

    /// Get commit frequency by date
    async fn get_commit_frequency(&self) -> Result<HashMap<String, u32>> {
        let output = TokioCommand::new("git")
            .args(["log", "--pretty=format:%ai"])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Ok(HashMap::new());
        }

        let mut frequency = HashMap::new();
        let log_output = String::from_utf8(output.stdout)?;
        
        for line in log_output.lines() {
            if let Ok(date) = DateTime::parse_from_rfc3339(line.trim()) {
                let date_str = date.format("%Y-%m-%d").to_string();
                *frequency.entry(date_str).or_insert(0) += 1;
            }
        }

        Ok(frequency)
    }

    /// Get detailed author statistics
    async fn get_author_statistics(&self) -> Result<HashMap<String, AuthorStats>> {
        let output = TokioCommand::new("git")
            .args(["log", "--pretty=format:%an|%ai", "--numstat"])
            .current_dir(&self.repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Ok(HashMap::new());
        }

        let mut author_stats = HashMap::new();
        let log_output = String::from_utf8(output.stdout)?;
        let lines: Vec<&str> = log_output.lines().collect();
        
        let mut current_author = String::new();
        let mut current_date = Utc::now();
        
        for line in lines {
            if line.contains('|') && !line.chars().next().unwrap_or(' ').is_ascii_digit() {
                // This is a commit line
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() == 2 {
                    current_author = parts[0].to_string();
                    current_date = DateTime::parse_from_rfc3339(parts[1])
                        .unwrap_or_else(|_| Utc::now().into())
                        .with_timezone(&Utc);
                    
                    let stats = author_stats.entry(current_author.clone()).or_insert(AuthorStats {
                        commits: 0,
                        lines_added: 0,
                        lines_deleted: 0,
                        files_touched: 0,
                        first_commit: current_date,
                        last_commit: current_date,
                    });
                    
                    stats.commits += 1;
                    if current_date < stats.first_commit {
                        stats.first_commit = current_date;
                    }
                    if current_date > stats.last_commit {
                        stats.last_commit = current_date;
                    }
                }
            } else if !line.is_empty() && !current_author.is_empty() {
                // This is a file change line
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    if let (Ok(added), Ok(deleted)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                        if let Some(stats) = author_stats.get_mut(&current_author) {
                            stats.lines_added += added;
                            stats.lines_deleted += deleted;
                            stats.files_touched += 1;
                        }
                    }
                }
            }
        }

        Ok(author_stats)
    }

    /// Generate complete visualization data
    pub async fn generate_visualization(&self, max_commits: Option<u32>) -> Result<GitVisualization> {
        let graph = self.generate_visual_graph(max_commits).await?;
        let statistics = self.generate_statistics().await?;
        
        // Generate timeline with key commits
        let mut timeline = Vec::new();
        let mut processed_commits = std::collections::HashSet::new();
        
        // Add important commits to timeline
        for (hash, node) in &graph.nodes {
            if processed_commits.len() >= 20 {
                break; // Limit timeline entries
            }
            
            // Include commits with multiple parents (merges), refs (tags/branches), or every nth commit
            let is_important = node.parents.len() > 1 || 
                              !node.refs.is_empty() || 
                              processed_commits.len() % 5 == 0;
                              
            if is_important && !processed_commits.contains(hash) {
                if let Ok(time_travel) = self.generate_time_travel(hash).await {
                    timeline.push(time_travel);
                    processed_commits.insert(hash.clone());
                }
            }
        }
        
        // Sort timeline by date
        timeline.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        Ok(GitVisualization {
            graph,
            timeline,
            statistics,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;

    #[tokio::test]
    async fn test_git_advanced_basic_functionality() {
        // Create a temporary git repository for testing
        let temp_dir = TempDir::new().unwrap();
        let repo_path = temp_dir.path().to_str().unwrap();
        
        // Initialize git repo
        std::process::Command::new("git")
            .args(["init"])
            .current_dir(repo_path)
            .output()
            .unwrap();
            
        // Configure git
        std::process::Command::new("git")
            .args(["config", "user.email", "test@example.com"])
            .current_dir(repo_path)
            .output()
            .unwrap();
            
        std::process::Command::new("git")
            .args(["config", "user.name", "Test User"])
            .current_dir(repo_path)
            .output()
            .unwrap();
        
        // Create and commit a file
        fs::write(format!("{}/test.txt", repo_path), "Hello, world!").unwrap();
        std::process::Command::new("git")
            .args(["add", "test.txt"])
            .current_dir(repo_path)
            .output()
            .unwrap();
            
        std::process::Command::new("git")
            .args(["commit", "-m", "Initial commit"])
            .current_dir(repo_path)
            .output()
            .unwrap();

        let git_advanced = GitAdvanced::new(repo_path);
        
        // Test basic functionality
        let graph = git_advanced.generate_visual_graph(Some(10)).await;
        assert!(graph.is_ok());
        
        let stats = git_advanced.generate_statistics().await;
        assert!(stats.is_ok());
        
        let visualization = git_advanced.generate_visualization(Some(10)).await;
        assert!(visualization.is_ok());
    }
}
