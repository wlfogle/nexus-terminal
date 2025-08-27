use anyhow::{Context, Result};
use git2::{Repository, StatusOptions};

pub fn get_status(path: &str) -> Result<String> {
    let repo = Repository::open(path)
        .context("Failed to open git repository")?;
    
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    
    let statuses = repo.statuses(Some(&mut opts))
        .context("Failed to get git status")?;
    
    let mut result = String::new();
    
    for entry in statuses.iter() {
        let status = entry.status();
        let path = entry.path().unwrap_or("<unknown>");
        
        let status_str = match status {
            s if s.is_wt_new() => "??",
            s if s.is_wt_modified() => " M",
            s if s.is_wt_deleted() => " D",
            s if s.is_wt_renamed() => " R",
            s if s.is_index_new() => "A ",
            s if s.is_index_modified() => "M ",
            s if s.is_index_deleted() => "D ",
            s if s.is_index_renamed() => "R ",
            _ => "  ",
        };
        
        result.push_str(&format!("{} {}\n", status_str, path));
    }
    
    Ok(result)
}

pub fn get_diff(path: &str) -> Result<String> {
    let repo = Repository::open(path)
        .context("Failed to open git repository")?;
    
    let head = repo.head()?.peel_to_tree()?;
    let diff = repo.diff_tree_to_workdir(Some(&head), None)?;
    
    let mut result = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        match line.origin() {
            '+' | '-' | ' ' => result.push(line.origin()),
            _ => {}
        }
        result.push_str(std::str::from_utf8(line.content()).unwrap_or(""));
        true
    })?;
    
    Ok(result)
}

pub fn get_branch_name(path: &str) -> Result<String> {
    let repo = Repository::open(path)
        .context("Failed to open git repository")?;
    
    let head = repo.head()?;
    if let Some(name) = head.shorthand() {
        Ok(name.to_string())
    } else {
        Ok("HEAD".to_string())
    }
}

pub fn is_repo(path: &str) -> bool {
    Repository::open(path).is_ok()
}

pub fn get_recent_commits(path: &str, limit: usize) -> Result<Vec<String>> {
    let repo = Repository::open(path)
        .context("Failed to open git repository")?;
    
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    revwalk.set_sorting(git2::Sort::TIME)?;
    
    let mut commits = Vec::new();
    
    for (i, oid) in revwalk.enumerate() {
        if i >= limit {
            break;
        }
        
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        
        let message = commit.message().unwrap_or("<invalid utf8>");
        let author = commit.author();
        let time = commit.time();
        let timestamp = chrono::DateTime::<chrono::Utc>::from_timestamp(time.seconds(), 0)
            .unwrap_or_default()
            .format("%Y-%m-%d %H:%M:%S")
            .to_string();
        
        let commit_info = format!(
            "{} - {} ({}) [{}]",
            &oid.to_string()[..8],
            message.lines().next().unwrap_or(""),
            author.name().unwrap_or("Unknown"),
            timestamp
        );
        
        commits.push(commit_info);
    }
    
    Ok(commits)
}

pub fn get_remote_url(path: &str) -> Result<Option<String>> {
    let repo = Repository::open(path)
        .context("Failed to open git repository")?;
    
    // Try to get the origin remote first
    if let Ok(remote) = repo.find_remote("origin") {
        if let Some(url) = remote.url() {
            return Ok(Some(url.to_string()));
        }
    }
    
    // If no origin, try to get the first remote
    let remotes = repo.remotes()?;
    if let Some(remote_name) = remotes.get(0) {
        if let Ok(remote) = repo.find_remote(remote_name) {
            if let Some(url) = remote.url() {
                return Ok(Some(url.to_string()));
            }
        }
    }
    
    Ok(None)
}
