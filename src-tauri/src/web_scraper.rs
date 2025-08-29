use serde::{Deserialize, Serialize};
use reqwest::Client;
use scraper::{Html, Selector};
use url::Url;
use std::collections::{HashMap, HashSet};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::fs;
use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapingOptions {
    pub url: String,
    pub depth: u32,
    pub max_pages: u32,
    pub follow_external_links: bool,
    pub download_images: bool,
    pub download_css: bool,
    pub download_js: bool,
    pub delay_between_requests: u64,
    pub respect_robots_txt: bool,
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
    pub output_directory: String,
    pub structure_mirror: bool,
    pub convert_links: bool,
    pub timeout: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapingResult {
    pub id: String,
    pub status: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub total_pages: u32,
    pub scraped_pages: u32,
    pub total_size: u64,
    pub errors: Vec<ScrapingError>,
    pub downloaded_files: Vec<DownloadedFile>,
    pub current_url: Option<String>,
    pub estimated_time_remaining: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapingError {
    pub url: String,
    pub error: String,
    pub timestamp: DateTime<Utc>,
    pub status_code: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadedFile {
    pub url: String,
    pub local_path: String,
    pub size: u64,
    pub mime_type: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteMap {
    pub url: String,
    pub title: Option<String>,
    pub depth: u32,
    pub children: Vec<SiteMap>,
    pub links: Vec<String>,
    pub images: Vec<String>,
    pub assets: Vec<String>,
    pub last_modified: Option<DateTime<Utc>>,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebsiteMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub keywords: Vec<String>,
    pub author: Option<String>,
    pub language: Option<String>,
    pub charset: Option<String>,
    pub favicon: Option<String>,
    pub open_graph: HashMap<String, String>,
    pub twitter_card: HashMap<String, String>,
    pub canonical_url: Option<String>,
    pub last_modified: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RobotsTxtInfo {
    pub exists: bool,
    pub content: Option<String>,
    pub allowed_paths: Vec<String>,
    pub disallowed_paths: Vec<String>,
    pub crawl_delay: Option<u32>,
    pub sitemap_urls: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapingStats {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub average_response_time: u64,
    pub total_bytes_downloaded: u64,
    pub pages_per_second: f64,
    pub most_common_errors: Vec<ErrorCount>,
    pub downloads_by_type: HashMap<String, u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorCount {
    pub error: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapingEstimate {
    pub estimated_pages: u64,
    pub estimated_size: String,
    pub estimated_time: String,
    pub bandwidth_required: String,
    pub storage_required: String,
    pub warnings: Vec<String>,
}

pub struct WebScraper {
    client: Client,
    active_jobs: HashMap<String, ScrapingResult>,
}

impl WebScraper {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Nexus Terminal Web Scraper 1.0")
            .build()
            .unwrap();

        Self {
            client,
            active_jobs: HashMap::new(),
        }
    }

    /// Start web scraping job
    pub async fn start_scraping(&mut self, options: ScrapingOptions) -> Result<String> {
        let job_id = Uuid::new_v4().to_string();
        
        // Validate options
        self.validate_options(&options)?;
        
        // Check robots.txt if required
        if options.respect_robots_txt {
            let robots_info = self.check_robots_txt(&options.url).await?;
            if !robots_info.allowed_paths.is_empty() {
                // Check if our URL is allowed
                // This is a simplified check - proper implementation would be more comprehensive
            }
        }

        let result = ScrapingResult {
            id: job_id.clone(),
            status: "running".to_string(),
            start_time: Utc::now(),
            end_time: None,
            total_pages: 0,
            scraped_pages: 0,
            total_size: 0,
            errors: Vec::new(),
            downloaded_files: Vec::new(),
            current_url: Some(options.url.clone()),
            estimated_time_remaining: None,
        };

        self.active_jobs.insert(job_id.clone(), result);
        
        // Start scraping in background task
        let scraper = self.clone();
        let job_id_clone = job_id.clone();
        tokio::spawn(async move {
            if let Err(e) = scraper.run_scraping_job(job_id_clone, options).await {
                eprintln!("Scraping job failed: {}", e);
            }
        });

        Ok(job_id)
    }

    /// Get scraping job progress
    pub fn get_scraping_progress(&self, job_id: &str) -> Result<ScrapingResult> {
        self.active_jobs.get(job_id)
            .cloned()
            .ok_or_else(|| anyhow!("Job not found"))
    }

    /// Scrape a single page
    pub async fn scrape_single_page(&self, url: &str, output_path: Option<String>) -> Result<DownloadedFile> {
        let _parsed_url = Url::parse(url)?;
        let response = self.client.get(url).send().await?;
        
        let content = response.text().await?;
        let output_path = output_path.unwrap_or_else(|| {
            let temp_dir = std::env::var("TEMP_DIR")
                .unwrap_or_else(|_| "./temp".to_string());
            format!("{}/scraped_{}.html", temp_dir, SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs())
        });
        
        fs::write(&output_path, &content).await?;
        
        Ok(DownloadedFile {
            url: url.to_string(),
            local_path: output_path,
            size: content.len() as u64,
            mime_type: "text/html".to_string(),
            timestamp: Utc::now(),
        })
    }

    /// Extract links from a page
    pub async fn extract_links(&self, url: &str) -> Result<Vec<String>> {
        let response = self.client.get(url).send().await?;
        let content = response.text().await?;
        let document = Html::parse_document(&content);
        
        let link_selector = Selector::parse("a[href]").unwrap();
        let base_url = Url::parse(url)?;
        
        let mut links = Vec::new();
        for element in document.select(&link_selector) {
            if let Some(href) = element.value().attr("href") {
                match base_url.join(href) {
                    Ok(absolute_url) => links.push(absolute_url.to_string()),
                    Err(_) => continue, // Skip invalid URLs
                }
            }
        }
        
        Ok(links)
    }

    /// Generate site map
    pub async fn generate_site_map(&self, url: &str, max_depth: u32) -> Result<SiteMap> {
        self.build_site_map(url, 0, max_depth, &mut HashSet::new()).await
    }

    /// Check robots.txt
    pub async fn check_robots_txt(&self, url: &str) -> Result<RobotsTxtInfo> {
        let base_url = Url::parse(url)?;
        let robots_url = base_url.join("/robots.txt")?;
        
        match self.client.get(robots_url.as_str()).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    let content = response.text().await?;
                    Ok(self.parse_robots_txt(&content))
                } else {
                    Ok(RobotsTxtInfo {
                        exists: false,
                        content: None,
                        allowed_paths: Vec::new(),
                        disallowed_paths: Vec::new(),
                        crawl_delay: None,
                        sitemap_urls: Vec::new(),
                    })
                }
            }
            Err(_) => {
                Ok(RobotsTxtInfo {
                    exists: false,
                    content: None,
                    allowed_paths: Vec::new(),
                    disallowed_paths: Vec::new(),
                    crawl_delay: None,
                    sitemap_urls: Vec::new(),
                })
            }
        }
    }

    /// Get website metadata
    pub async fn get_website_metadata(&self, url: &str) -> Result<WebsiteMetadata> {
        let response = self.client.get(url).send().await?;
        let content = response.text().await?;
        let document = Html::parse_document(&content);
        
        let mut metadata = WebsiteMetadata {
            title: None,
            description: None,
            keywords: Vec::new(),
            author: None,
            language: None,
            charset: None,
            favicon: None,
            open_graph: HashMap::new(),
            twitter_card: HashMap::new(),
            canonical_url: None,
            last_modified: None,
        };

        // Extract title
        if let Some(title_element) = document.select(&Selector::parse("title").unwrap()).next() {
            metadata.title = Some(title_element.text().collect::<String>().trim().to_string());
        }

        // Extract meta tags
        let meta_selector = Selector::parse("meta").unwrap();
        for meta in document.select(&meta_selector) {
            let attrs = meta.value();
            
            if let Some(name) = attrs.attr("name") {
                if let Some(content) = attrs.attr("content") {
                    match name.to_lowercase().as_str() {
                        "description" => metadata.description = Some(content.to_string()),
                        "keywords" => metadata.keywords = content.split(',').map(|s| s.trim().to_string()).collect(),
                        "author" => metadata.author = Some(content.to_string()),
                        _ => {}
                    }
                }
            }
            
            // Open Graph tags
            if let Some(property) = attrs.attr("property") {
                if property.starts_with("og:") {
                    if let Some(content) = attrs.attr("content") {
                        metadata.open_graph.insert(property.to_string(), content.to_string());
                    }
                }
            }
            
            // Twitter Card tags
            if let Some(name) = attrs.attr("name") {
                if name.starts_with("twitter:") {
                    if let Some(content) = attrs.attr("content") {
                        metadata.twitter_card.insert(name.to_string(), content.to_string());
                    }
                }
            }
        }

        Ok(metadata)
    }

    /// Estimate scraping job requirements
    pub async fn estimate_scraping(&self, options: &ScrapingOptions) -> Result<ScrapingEstimate> {
        // This is a simplified estimation - real implementation would be more sophisticated
        let estimated_pages = std::cmp::min(options.max_pages as u64, 1000);
        let estimated_size_bytes = estimated_pages * 50_000; // Assume ~50KB per page
        
        let estimated_time_seconds = estimated_pages * (options.delay_between_requests + 1000) / 1000;
        
        Ok(ScrapingEstimate {
            estimated_pages,
            estimated_size: format!("{:.2} MB", estimated_size_bytes as f64 / 1_000_000.0),
            estimated_time: format!("{} minutes", estimated_time_seconds / 60),
            bandwidth_required: format!("{:.2} MB", estimated_size_bytes as f64 / 1_000_000.0),
            storage_required: format!("{:.2} MB", (estimated_size_bytes as f64 * 1.2) / 1_000_000.0),
            warnings: vec![
                "Estimates are approximate and may vary significantly".to_string(),
                "Large sites may take much longer than estimated".to_string(),
            ],
        })
    }

    // Private helper methods

    async fn run_scraping_job(&self, _job_id: String, _options: ScrapingOptions) -> Result<()> {
        // Implement the actual scraping logic here
        // This would involve:
        // 1. Crawling pages up to specified depth
        // 2. Downloading content and assets
        // 3. Updating job progress
        // 4. Handling errors and retries
        
        // For now, just mark as completed
        tokio::time::sleep(Duration::from_secs(5)).await;
        
        // Update job status to completed
        // (In real implementation, this would be done through shared state)
        
        Ok(())
    }

    async fn build_site_map(&self, url: &str, current_depth: u32, max_depth: u32, visited: &mut HashSet<String>) -> Result<SiteMap> {
        if current_depth >= max_depth || visited.contains(url) {
            return Ok(SiteMap {
                url: url.to_string(),
                title: None,
                depth: current_depth,
                children: Vec::new(),
                links: Vec::new(),
                images: Vec::new(),
                assets: Vec::new(),
                last_modified: None,
                size: None,
            });
        }
        
        visited.insert(url.to_string());
        
        let response = self.client.get(url).send().await?;
        let content = response.text().await?;
        
        // Extract title from content
        let title = {
            let document = Html::parse_document(&content);
            document.select(&Selector::parse("title").unwrap())
                .next()
                .map(|el| el.text().collect::<String>())
        };
        
        // Extract links
        let links = self.extract_links(url).await.unwrap_or_default();
        
        Ok(SiteMap {
            url: url.to_string(),
            title,
            depth: current_depth,
            children: Vec::new(), // Would build recursively in full implementation
            links,
            images: Vec::new(),
            assets: Vec::new(),
            last_modified: Some(Utc::now()),
            size: Some(content.len() as u64),
        })
    }

    fn parse_robots_txt(&self, content: &str) -> RobotsTxtInfo {
        let mut allowed_paths = Vec::new();
        let mut disallowed_paths = Vec::new();
        let mut sitemap_urls = Vec::new();
        let mut crawl_delay = None;
        
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("Allow:") {
                allowed_paths.push(line["Allow:".len()..].trim().to_string());
            } else if line.starts_with("Disallow:") {
                disallowed_paths.push(line["Disallow:".len()..].trim().to_string());
            } else if line.starts_with("Sitemap:") {
                sitemap_urls.push(line["Sitemap:".len()..].trim().to_string());
            } else if line.starts_with("Crawl-delay:") {
                if let Ok(delay) = line["Crawl-delay:".len()..].trim().parse() {
                    crawl_delay = Some(delay);
                }
            }
        }
        
        RobotsTxtInfo {
            exists: true,
            content: Some(content.to_string()),
            allowed_paths,
            disallowed_paths,
            crawl_delay,
            sitemap_urls,
        }
    }

    fn validate_options(&self, options: &ScrapingOptions) -> Result<()> {
        Url::parse(&options.url)?;
        
        if options.depth > 10 {
            return Err(anyhow!("Maximum depth is 10"));
        }
        
        if options.max_pages > 10000 {
            return Err(anyhow!("Maximum pages is 10000"));
        }
        
        Ok(())
    }
}

impl Clone for WebScraper {
    fn clone(&self) -> Self {
        Self {
            client: self.client.clone(),
            active_jobs: HashMap::new(), // Don't clone active jobs
        }
    }
}

/// Global web scraper instance
static WEB_SCRAPER: once_cell::sync::Lazy<std::sync::Mutex<WebScraper>> = 
    once_cell::sync::Lazy::new(|| std::sync::Mutex::new(WebScraper::new()));

pub fn get_web_scraper() -> &'static std::sync::Mutex<WebScraper> {
    &WEB_SCRAPER
}
