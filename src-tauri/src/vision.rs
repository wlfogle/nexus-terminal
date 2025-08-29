use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::{Result, anyhow};
use chrono::Utc;
use std::io::Cursor;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenCapture {
    pub id: String,
    pub timestamp: String,
    pub data: Vec<u8>,
    pub format: String,
    pub width: u32,
    pub height: u32,
    pub region: Option<CaptureRegion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureRegion {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRResult {
    pub text: String,
    pub confidence: f64,
    pub bounding_box: BoundingBox,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualElement {
    pub element_type: String,
    pub text: Option<String>,
    pub bounding_box: BoundingBox,
    pub confidence: f64,
    pub attributes: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenAnalysis {
    pub capture_id: String,
    pub timestamp: String,
    pub ocr_results: Vec<OCRResult>,
    pub visual_elements: Vec<VisualElement>,
    pub detected_context: DetectedContext,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedContext {
    pub window_type: String,
    pub primary_content: String,
    pub code_language: Option<String>,
    pub terminal_commands: Option<Vec<String>>,
    pub error_messages: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionQuery {
    pub prompt: String,
    pub include_ocr: bool,
    pub include_elements: bool,
}

pub struct VisionService {
    initialized: bool,
}

impl VisionService {
    pub fn new() -> Self {
        Self {
            initialized: false,
        }
    }

    /// Initialize computer vision dependencies
    pub async fn initialize(&mut self) -> Result<()> {
        // Check for required dependencies
        self.check_vision_dependencies().await?;
        self.initialized = true;
        Ok(())
    }

    /// Capture full screen
    pub async fn capture_full_screen(&self) -> Result<ScreenCapture> {
        if !self.initialized {
            return Err(anyhow!("Vision service not initialized"));
        }

        // Use screenshots crate for screen capture
        match screenshots::Screen::all() {
            Ok(screens) => {
                if let Some(screen) = screens.first() {
                    match screen.capture() {
                        Ok(image) => {
                            let capture_id = uuid::Uuid::new_v4().to_string();
                            
                            // Convert image to PNG bytes  
                            let mut png_data = Vec::new();
                            {
                                let mut cursor = Cursor::new(&mut png_data);
                                image.write_to(&mut cursor, screenshots::image::ImageFormat::Png)
                                    .map_err(|e| anyhow!("Failed to encode image: {}", e))?;
                            }

                            Ok(ScreenCapture {
                                id: capture_id,
                                timestamp: Utc::now().to_rfc3339(),
                                data: png_data,
                                format: "png".to_string(),
                                width: image.width(),
                                height: image.height(),
                                region: None,
                            })
                        }
                        Err(e) => Err(anyhow!("Failed to capture screen: {}", e)),
                    }
                } else {
                    Err(anyhow!("No screens found"))
                }
            }
            Err(e) => Err(anyhow!("Failed to get screens: {}", e)),
        }
    }

    /// Capture specific region of screen
    pub async fn capture_screen_region(&self, x: u32, y: u32, width: u32, height: u32) -> Result<ScreenCapture> {
        if !self.initialized {
            return Err(anyhow!("Vision service not initialized"));
        }

        // For now, capture full screen and crop
        // In a real implementation, we'd capture just the region for efficiency
        let full_capture = self.capture_full_screen().await?;
        
        // TODO: Implement actual region cropping
        // For now, return full capture with region metadata
        Ok(ScreenCapture {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now().to_rfc3339(),
            data: full_capture.data,
            format: "png".to_string(),
            width,
            height,
            region: Some(CaptureRegion { x, y, width, height }),
        })
    }

    /// Perform OCR on captured image
    pub async fn perform_ocr(&self, _image_path: &str, _engine: &str) -> Result<Vec<OCRResult>> {
        if !self.initialized {
            return Err(anyhow!("Vision service not initialized"));
        }

        // This is a stub implementation
        // Real implementation would use tesseract-rs or similar OCR engine
        
        // For demonstration, return some mock OCR results
        Ok(vec![
            OCRResult {
                text: "Sample detected text".to_string(),
                confidence: 0.85,
                bounding_box: BoundingBox {
                    x: 100,
                    y: 50,
                    width: 200,
                    height: 25,
                },
            },
            OCRResult {
                text: "Another line of text".to_string(),
                confidence: 0.92,
                bounding_box: BoundingBox {
                    x: 100,
                    y: 80,
                    width: 220,
                    height: 25,
                },
            },
        ])
    }

    /// Detect UI elements in captured image
    pub async fn detect_ui_elements(&self, _image_path: &str) -> Result<Vec<VisualElement>> {
        if !self.initialized {
            return Err(anyhow!("Vision service not initialized"));
        }

        // This is a stub implementation
        // Real implementation would use computer vision models to detect UI elements
        
        // For demonstration, return some mock UI elements
        Ok(vec![
            VisualElement {
                element_type: "button".to_string(),
                text: Some("OK".to_string()),
                bounding_box: BoundingBox {
                    x: 300,
                    y: 400,
                    width: 80,
                    height: 30,
                },
                confidence: 0.9,
                attributes: {
                    let mut attrs = HashMap::new();
                    attrs.insert("clickable".to_string(), "true".to_string());
                    attrs.insert("color".to_string(), "blue".to_string());
                    attrs
                },
            },
            VisualElement {
                element_type: "text_field".to_string(),
                text: None,
                bounding_box: BoundingBox {
                    x: 100,
                    y: 200,
                    width: 250,
                    height: 25,
                },
                confidence: 0.85,
                attributes: {
                    let mut attrs = HashMap::new();
                    attrs.insert("editable".to_string(), "true".to_string());
                    attrs
                },
            },
        ])
    }

    /// Analyze screen with AI
    pub async fn analyze_screen_with_ai(
        &self, 
        _image_data: Vec<u8>, 
        prompt: String, 
        context: String,
        _ollama_host: String,
        _ollama_port: String,
    ) -> Result<String> {
        if !self.initialized {
            return Err(anyhow!("Vision service not initialized"));
        }

        // This is a stub implementation for AI vision analysis
        // Real implementation would:
        // 1. Convert image to base64
        // 2. Send to vision-capable AI model (like LLaVA)
        // 3. Return AI analysis of the image
        
        // For demonstration, return mock analysis
        Ok(format!(
            "AI Analysis of screen capture:\n\
            Prompt: {}\n\
            Context: {}\n\
            \n\
            Based on the screen capture, I can see a terminal/desktop interface. \
            The image appears to contain various UI elements and text content. \
            This is a mock response - real implementation would use actual AI vision models.",
            prompt, context
        ))
    }

    /// Check if computer vision dependencies are available
    pub async fn check_vision_dependencies(&self) -> Result<()> {
        // Check if screen capture is available
        match screenshots::Screen::all() {
            Ok(_) => {},
            Err(e) => return Err(anyhow!("Screen capture not available: {}", e)),
        }

        // Check if OCR engine is available (stub)
        // Real implementation would check for tesseract or other OCR engines
        
        // Check if AI model endpoint is reachable (stub)
        // Real implementation would ping Ollama or other AI service
        
        Ok(())
    }

    /// Generate comprehensive screen analysis
    pub async fn analyze_screen_comprehensive(&self, capture_id: &str, image_data: Vec<u8>) -> Result<ScreenAnalysis> {
        if !self.initialized {
            return Err(anyhow!("Vision service not initialized"));
        }

        // Save image to temp file for processing
        let temp_dir = std::env::var("TEMP_DIR")
            .unwrap_or_else(|_| "./temp".to_string());
        let temp_path = format!("{}/capture_{}.png", temp_dir, capture_id);
        tokio::fs::write(&temp_path, &image_data).await?;

        // Perform OCR and element detection (in parallel eventually)
        let ocr_results = self.perform_ocr(&temp_path, "tesseract").await?;
        let visual_elements = self.detect_ui_elements(&temp_path).await?;

        // Analyze context
        let detected_context = self.analyze_context(&ocr_results, &visual_elements).await?;
        
        // Generate summary
        let summary = self.generate_summary(&ocr_results, &visual_elements, &detected_context).await?;

        // Clean up temp file
        let _ = tokio::fs::remove_file(&temp_path).await;

        Ok(ScreenAnalysis {
            capture_id: capture_id.to_string(),
            timestamp: Utc::now().to_rfc3339(),
            ocr_results,
            visual_elements,
            detected_context,
            summary,
        })
    }

    // Private helper methods

    async fn analyze_context(&self, ocr_results: &[OCRResult], _visual_elements: &[VisualElement]) -> Result<DetectedContext> {
        let all_text: String = ocr_results.iter()
            .map(|r| r.text.to_lowercase())
            .collect::<Vec<_>>()
            .join(" ");

        // Detect window type
        let window_type = if all_text.contains("$") || all_text.contains("bash") || all_text.contains("command") {
            "terminal"
        } else if all_text.contains("function") || all_text.contains("import") || all_text.contains("class") {
            "editor"
        } else if all_text.contains("http") || all_text.contains("www") {
            "browser"
        } else {
            "unknown"
        }.to_string();

        // Detect programming language
        let code_language = if all_text.contains("function") && all_text.contains("const") {
            Some("javascript".to_string())
        } else if all_text.contains("def") && all_text.contains("import") {
            Some("python".to_string())
        } else if all_text.contains("fn") && all_text.contains("struct") {
            Some("rust".to_string())
        } else {
            None
        };

        // Extract terminal commands (simplified)
        let terminal_commands = if window_type == "terminal" {
            Some(vec!["ls".to_string(), "cd".to_string(), "pwd".to_string()])
        } else {
            None
        };

        // Detect error messages
        let error_messages = ocr_results.iter()
            .filter(|r| r.text.to_lowercase().contains("error") || r.text.to_lowercase().contains("failed"))
            .map(|r| r.text.clone())
            .collect::<Vec<_>>();
        
        let error_messages = if error_messages.is_empty() { None } else { Some(error_messages) };

        Ok(DetectedContext {
            window_type,
            primary_content: all_text.chars().take(500).collect(),
            code_language,
            terminal_commands,
            error_messages,
        })
    }

    async fn generate_summary(&self, ocr_results: &[OCRResult], visual_elements: &[VisualElement], context: &DetectedContext) -> Result<String> {
        let mut summary = format!("Screen shows a {} window", context.window_type);
        
        if let Some(ref lang) = context.code_language {
            summary.push_str(&format!(" with {} code", lang));
        }
        
        if let Some(ref commands) = context.terminal_commands {
            summary.push_str(&format!(". Commands available: {}", commands.join(", ")));
        }
        
        if let Some(ref errors) = context.error_messages {
            summary.push_str(&format!(". Errors detected: {} error(s)", errors.len()));
        }
        
        summary.push_str(&format!(". Contains {} text elements and {} UI elements.", 
                                ocr_results.len(), visual_elements.len()));
        
        Ok(summary)
    }
}

impl Default for VisionService {
    fn default() -> Self {
        Self::new()
    }
}

/// Global vision service instance
static VISION_SERVICE: once_cell::sync::Lazy<std::sync::Mutex<VisionService>> = 
    once_cell::sync::Lazy::new(|| std::sync::Mutex::new(VisionService::new()));

pub fn get_vision_service() -> &'static std::sync::Mutex<VisionService> {
    &VISION_SERVICE
}
