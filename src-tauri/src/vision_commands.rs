use tauri::command;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use image::{DynamicImage};
use screenshots::Screen;
use tesseract::Tesseract;
use reqwest::Client;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct ScreenCaptureData {
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OCRResult {
    pub text: String,
    pub confidence: f32,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UIElement {
    pub element_type: String,
    pub text: Option<String>,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub confidence: f32,
    pub attributes: HashMap<String, serde_json::Value>,
}

/// Capture the entire screen
#[command]
pub async fn capture_screen() -> Result<ScreenCaptureData, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    
    if screens.is_empty() {
        return Err("No screens found".to_string());
    }
    
    let screen = &screens[0]; // Use primary screen
    let image = screen
        .capture()
        .map_err(|e| format!("Failed to capture screen: {}", e))?;
    
    let mut buffer = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut buffer);
    image
        .write_to(&mut cursor, screenshots::image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode image: {}", e))?;
    
    Ok(ScreenCaptureData {
        data: buffer,
        width: image.width(),
        height: image.height(),
    })
}

/// Capture a specific region of the screen
#[command]
pub async fn capture_screen_region(
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<ScreenCaptureData, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    
    if screens.is_empty() {
        return Err("No screens found".to_string());
    }
    
    let screen = &screens[0];
    let full_image = screen
        .capture()
        .map_err(|e| format!("Failed to capture screen: {}", e))?;
    
    // Convert screenshots image to image crate format and crop
    let rgba_buf = full_image.to_vec();
    let img_buf = image::ImageBuffer::from_raw(full_image.width(), full_image.height(), rgba_buf)
        .ok_or_else(|| "Failed to create image buffer".to_string())?;
    let mut dynamic_img = image::DynamicImage::ImageRgba8(img_buf);
    let cropped = dynamic_img.crop(x as u32, y as u32, width as u32, height as u32);
    
    let mut buffer = std::io::Cursor::new(Vec::new());
    cropped
        .write_to(&mut buffer, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode image: {}", e))?;
    let buffer = buffer.into_inner();
    
    Ok(ScreenCaptureData {
        data: buffer,
        width: width as u32,
        height: height as u32,
    })
}

/// Perform OCR on an image file
#[command]
pub async fn perform_ocr(image_path: String, engine: String) -> Result<Vec<OCRResult>, String> {
    let path = PathBuf::from(image_path);
    
    match engine.as_str() {
        "tesseract" => perform_tesseract_ocr(path).await,
        "easyocr" => perform_easyocr_ocr(path).await,
        _ => Err(format!("Unsupported OCR engine: {}", engine)),
    }
}

/// Perform OCR using Tesseract
async fn perform_tesseract_ocr(image_path: PathBuf) -> Result<Vec<OCRResult>, String> {
    let path_str = image_path.to_str()
        .ok_or_else(|| "Invalid image path encoding".to_string())?;
    let mut tesseract = Tesseract::new(None, Some("eng"))
        .map_err(|e| format!("Failed to initialize Tesseract: {}", e))?
        .set_image(path_str)
        .map_err(|e| format!("Failed to set image: {}", e))?;
    
    // Get text from the image
    let text = tesseract
        .get_text()
        .map_err(|e| format!("Failed to extract text: {}", e))?;
    
    let mut results = Vec::new();
    
    // Split text into lines and create OCRResult for each non-empty line
    for (i, line) in text.lines().enumerate() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            results.push(OCRResult {
                text: trimmed.to_string(),
                confidence: 0.8, // Default confidence since Tesseract API doesn't provide easy per-word confidence
                x: 0,     // Default position - would need more complex API usage for actual bounds
                y: i as i32 * 20, // Approximate line spacing
                width: trimmed.len() as i32 * 10, // Approximate character width
                height: 18, // Approximate line height
            });
        }
    }
    
    Ok(results)
}

/// Perform OCR using EasyOCR (via Python subprocess)
async fn perform_easyocr_ocr(image_path: PathBuf) -> Result<Vec<OCRResult>, String> {
    use std::process::Command;
    
    let output = Command::new("python3")
        .arg("-c")
        .arg(format!(
            r#"
import easyocr
import json

reader = easyocr.Reader(['en'])
results = reader.readtext('{}', detail=1)

formatted_results = []
for (bbox, text, confidence) in results:
    x1, y1 = int(bbox[0][0]), int(bbox[0][1])
    x2, y2 = int(bbox[2][0]), int(bbox[2][1])
    formatted_results.append({{
        'text': text,
        'confidence': float(confidence),
        'x': x1,
        'y': y1,
        'width': x2 - x1,
        'height': y2 - y1
    }})

print(json.dumps(formatted_results))
            "#,
            image_path.display()
        ))
        .output()
        .map_err(|e| format!("Failed to run EasyOCR: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("EasyOCR failed: {}", stderr));
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let results: Vec<OCRResult> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse EasyOCR output: {}", e))?;
    
    Ok(results)
}

/// Detect UI elements in an image
#[command]
pub async fn detect_ui_elements(image_path: String) -> Result<Vec<UIElement>, String> {
    let path = PathBuf::from(image_path);
    
    // Load and analyze image
    let image = image::open(&path)
        .map_err(|e| format!("Failed to load image: {}", e))?;
    
    let mut elements = Vec::new();
    
    // Simple element detection based on image analysis
    // This is a basic implementation - in production, you'd use ML models
    
    // Detect potential terminal windows (dark backgrounds)
    if is_likely_terminal(&image) {
        elements.push(UIElement {
            element_type: "terminal".to_string(),
            text: None,
            x: 0,
            y: 0,
            width: image.width() as i32,
            height: image.height() as i32,
            confidence: 0.8,
            attributes: HashMap::from([
                ("background".to_string(), serde_json::Value::String("dark".to_string())),
            ]),
        });
    }
    
    // Detect code editor patterns (syntax highlighting colors)
    if is_likely_code_editor(&image) {
        elements.push(UIElement {
            element_type: "code".to_string(),
            text: None,
            x: 0,
            y: 0,
            width: image.width() as i32,
            height: image.height() as i32,
            confidence: 0.7,
            attributes: HashMap::from([
                ("syntax_highlighting".to_string(), serde_json::Value::Bool(true)),
            ]),
        });
    }
    
    // Detect buttons and clickable elements
    let button_candidates = detect_button_candidates(&image);
    elements.extend(button_candidates);
    
    Ok(elements)
}

/// Query AI with vision capabilities
#[command]
pub async fn query_vision_ai(
    prompt: String,
    image: String, // base64 encoded image
    _focus_region: Option<serde_json::Value>,
    ollama_host: Option<String>,
    ollama_port: Option<String>,
) -> Result<String, String> {
    let client = Client::new();
    
    let host = ollama_host.unwrap_or_else(|| std::env::var("OLLAMA_HOST").unwrap_or_else(|_| "localhost".to_string()));
    let port = ollama_port.unwrap_or_else(|| std::env::var("OLLAMA_PORT").unwrap_or_else(|_| "11434".to_string()));
    
    let request_body = serde_json::json!({
        "model": "llava", // LLaVA model for vision + language
        "prompt": prompt,
        "images": [image],
        "stream": false,
        "options": {
            "temperature": 0.7,
            "top_p": 0.9
        }
    });
    
    let ollama_url = format!("http://{}:{}/api/generate", host, port);
    
    let response = client
        .post(&ollama_url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to send request to Ollama: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!(
            "Ollama API error: {} - {}",
            response.status(),
            response.text().await.unwrap_or_default()
        ));
    }
    
    let response_data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;
    
    let ai_response = response_data["response"]
        .as_str()
        .unwrap_or("No response from AI")
        .to_string();
    
    Ok(ai_response)
}

/// Check if required vision dependencies are available
#[command]
pub async fn check_vision_dependencies() -> Result<(), String> {
    // Check if Tesseract is available
    match Tesseract::new(None, Some("eng")) {
        Ok(_) => {},
        Err(_) => return Err("Tesseract OCR not available. Please install tesseract-ocr.".to_string()),
    }
    
    // Check if screenshots library works
    match Screen::all() {
        Ok(screens) if !screens.is_empty() => {},
        _ => return Err("Screen capture not available.".to_string()),
    }
    
    // Check if Python and EasyOCR are available (optional)
    let python_check = std::process::Command::new("python3")
        .arg("-c")
        .arg("import easyocr; print('EasyOCR available')")
        .output();
    
    match python_check {
        Ok(output) if output.status.success() => {
            tracing::info!("EasyOCR is available as fallback OCR engine");
        },
        _ => {
            tracing::debug!("EasyOCR not available, using Tesseract only");
        },
    }
    
    Ok(())
}

/// Simple heuristic to detect if image likely contains a terminal
fn is_likely_terminal(image: &DynamicImage) -> bool {
    let rgba_image = image.to_rgba8();
    let pixels = rgba_image.pixels();
    
    let mut dark_pixel_count = 0;
    let mut total_pixels = 0;
    
    // Sample pixels to determine if background is predominantly dark
    for pixel in pixels.step_by(100) { // Sample every 100th pixel for performance
        total_pixels += 1;
        let brightness = (pixel[0] as f32 + pixel[1] as f32 + pixel[2] as f32) / 3.0;
        
        if brightness < 50.0 { // Dark pixel threshold
            dark_pixel_count += 1;
        }
    }
    
    if total_pixels == 0 {
        return false;
    }
    
    let dark_ratio = dark_pixel_count as f32 / total_pixels as f32;
    dark_ratio > 0.6 // If more than 60% of pixels are dark, likely a terminal
}

/// Simple heuristic to detect if image likely contains code editor
fn is_likely_code_editor(image: &DynamicImage) -> bool {
    let rgba_image = image.to_rgba8();
    let pixels = rgba_image.pixels();
    
    let mut color_variety = std::collections::HashSet::new();
    
    // Sample pixels to check for syntax highlighting variety
    for pixel in pixels.step_by(200) { // Sample pixels
        // Quantize colors to reduce noise
        let r = (pixel[0] / 32) * 32;
        let g = (pixel[1] / 32) * 32;
        let b = (pixel[2] / 32) * 32;
        
        color_variety.insert((r, g, b));
        
        if color_variety.len() > 10 {
            break; // Enough variety detected
        }
    }
    
    // Code editors typically have more color variety due to syntax highlighting
    color_variety.len() > 6
}

/// Detect potential button candidates in the image
fn detect_button_candidates(image: &DynamicImage) -> Vec<UIElement> {
    let mut buttons = Vec::new();
    
    // This is a simplified button detection
    // In practice, you'd use computer vision techniques or ML models
    
    let width = image.width() as i32;
    let height = image.height() as i32;
    
    // Look for common button regions (simplified)
    let common_button_regions = vec![
        (10, 10, 80, 30),           // Top-left button area
        (width - 90, 10, 80, 30),   // Top-right button area
        (10, height - 40, 80, 30),  // Bottom-left button area
        (width - 90, height - 40, 80, 30), // Bottom-right button area
    ];
    
    for (x, y, w, h) in common_button_regions {
        if x >= 0 && y >= 0 && x + w <= width && y + h <= height {
            buttons.push(UIElement {
                element_type: "button".to_string(),
                text: None,
                x,
                y,
                width: w,
                height: h,
                confidence: 0.5, // Low confidence for heuristic detection
                attributes: HashMap::from([
                    ("detection_method".to_string(), serde_json::Value::String("heuristic".to_string())),
                ]),
            });
        }
    }
    
    buttons
}
