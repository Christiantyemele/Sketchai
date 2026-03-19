use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagramType {
    #[serde(rename = "type")]
    pub type_: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateDiagramRequest {
    pub prompt: String,
    pub diagram_type: String,
    #[serde(default)]
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Diagram {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: Option<String>,
    pub prompt: String,
    pub diagram_type: String,
    pub canvas_json: serde_json::Value,
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DiagramListItem {
    pub id: Uuid,
    pub title: Option<String>,
    pub diagram_type: String,
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct DiagramService {
    anthropic_api_key: String,
    anthropic_api_url: String,
    client: Client,
}

impl DiagramService {
    pub fn new(anthropic_api_key: String, anthropic_api_url: String) -> Self {
        Self {
            anthropic_api_key,
            anthropic_api_url,
            client: Client::new(),
        }
    }

    /// Generate diagram using Claude API
    pub async fn generate(
        &self,
        prompt: &str,
        diagram_type: &str,
    ) -> Result<serde_json::Value, DiagramError> {
        let system_prompt = self.build_system_prompt(diagram_type);
        
        let request_body = serde_json::json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        });

        let response = self.client
            .post(&self.anthropic_api_url)
            .header("x-api-key", &self.anthropic_api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Claude API request failed: {}", e);
                DiagramError::ApiRequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Claude API error: {} - {}", status, body);
            return Err(DiagramError::ApiError(status.to_string()));
        }

        let response_body: ClaudeResponse = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse Claude response: {}", e);
            DiagramError::InvalidResponse
        })?;

        // Extract the content from Claude's response
        let content = response_body.content.first()
            .ok_or(DiagramError::EmptyResponse)?;

        let text = &content.text;

        // Parse the Excalidraw JSON from the response
        let canvas_json = self.parse_excalidraw_json(text)?;

        // Validate the JSON has required fields
        self.validate_excalidraw_json(&canvas_json)?;

        Ok(canvas_json)
    }

    fn build_system_prompt(&self, diagram_type: &str) -> String {
        let diagram_instructions = match diagram_type {
            "flowchart" => "Create a flowchart with rectangles for processes, diamonds for decisions, and arrows connecting them. Flow should be top-to-bottom or left-to-right.",
            "architecture" => "Create a system architecture diagram showing components as rectangles, databases as cylinders, and connections as arrows. Group related components together.",
            "sequence" => "Create a sequence diagram with actors at the top, lifelines extending down, and horizontal arrows showing messages between actors. Time flows downward.",
            "component" => "Create a component diagram showing modules as rectangles with interfaces as circles/lollipops. Show dependencies with dashed arrows.",
            "erd" => "Create an entity-relationship diagram with tables as rectangles, columns listed inside, and relationships shown with lines including cardinality notation.",
            "c4" => "Create a C4 model diagram showing context, containers, or components as rounded rectangles with clear hierarchy and relationships.",
            _ => "Create a clear diagram with appropriate shapes and connections for the content.",
        };

        format!(
            r###"You are an expert diagram generator. You MUST respond with ONLY valid Excalidraw JSON format. No markdown, no code fences, no explanations - just the raw JSON.

CRITICAL REQUIREMENTS:
1. Output must be valid JSON parseable by JSON.parse()
2. Use hand-drawn style: roughness: 1, strokeSharpness: "round"
3. Use the "hand-drawn" font family for text
4. Include meaningful labels, not placeholder text
5. Keep diagrams readable at standard zoom

{}

EXCALIDRAW JSON STRUCTURE:
{{
  "type": "excalidraw",
  "version": 2,
  "elements": [
    {{
      "type": "rectangle" | "ellipse" | "diamond" | "arrow" | "line" | "text",
      "version": 1,
      "versionNonce": <random number>,
      "isDeleted": false,
      "id": <unique string id>,
      "fillStyle": "hachure",
      "strokeWidth": 1,
      "strokeStyle": "solid",
      "roughness": 1,
      "opacity": 100,
      "angle": 0,
      "x": <number>,
      "y": <number>,
      "strokeColor": "#1e1e1e",
      "backgroundColor": "transparent",
      "width": <number>,
      "height": <number>,
      "seed": <random number>,
      "groupIds": [],
      "frameId": null,
      "roundness": null,
      "boundElements": [],
      "updated": <timestamp>,
      "link": null,
      "locked": false,
      "fontSize": 16,
      "fontFamily": 1,
      "text": <string for text elements>,
      "textAlign": "center",
      "verticalAlign": "middle",
      "containerId": null,
      "originalText": <string>,
      "lineHeight": 1.25,
      "startBinding": null,
      "endBinding": null,
      "startArrowhead": null,
      "endArrowhead": "arrow",
      "points": <array for lines/arrows>
    }}
  ],
  "appState": {{
    "gridSize": null,
    "viewBackgroundColor": "#ffffff"
  }},
  "files": {{}}
}}

Generate a complete, valid Excalidraw diagram now. NO other text."###,
            diagram_instructions
        )
    }

    fn parse_excalidraw_json(&self, text: &str) -> Result<serde_json::Value, DiagramError> {
        // Try to extract JSON from markdown code fences if present
        let json_text = if text.contains("```json") {
            text.split("```json")
                .nth(1)
                .and_then(|s| s.split("```").next())
                .map(|s| s.trim())
                .unwrap_or(text)
        } else if text.contains("```") {
            text.split("```")
                .nth(1)
                .and_then(|s| s.split("```").next())
                .map(|s| s.trim())
                .unwrap_or(text)
        } else {
            text.trim()
        };

        serde_json::from_str(json_text).map_err(|e| {
            tracing::error!("Failed to parse Excalidraw JSON: {}", e);
            tracing::debug!("Response text: {}", text);
            DiagramError::InvalidJson
        })
    }

    fn validate_excalidraw_json(&self, json: &serde_json::Value) -> Result<(), DiagramError> {
        let elements = json.get("elements")
            .and_then(|e| e.as_array())
            .ok_or(DiagramError::MissingElements)?;

        if elements.is_empty() {
            return Err(DiagramError::EmptyElements);
        }

        Ok(())
    }

    /// Save diagram to database
    pub async fn save(
        &self,
        db: &PgPool,
        user_id: &Uuid,
        prompt: &str,
        diagram_type: &str,
        title: Option<&str>,
        canvas_json: &serde_json::Value,
    ) -> Result<Diagram, DiagramError> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO diagrams (id, user_id, title, prompt, diagram_type, canvas_json, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#
        )
        .bind(id)
        .bind(user_id)
        .bind(title)
        .bind(prompt)
        .bind(diagram_type)
        .bind(canvas_json)
        .bind(now)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to save diagram: {}", e);
            DiagramError::DatabaseError
        })?;

        Ok(Diagram {
            id,
            user_id: *user_id,
            title: title.map(|s| s.to_string()),
            prompt: prompt.to_string(),
            diagram_type: diagram_type.to_string(),
            canvas_json: canvas_json.clone(),
            created_at: now,
        })
    }

    /// List diagrams for a user
    pub async fn list(
        db: &PgPool,
        user_id: &Uuid,
        limit: i32,
        offset: i32,
        diagram_type: Option<&str>,
    ) -> Result<(Vec<DiagramListItem>, i64), DiagramError> {
        let diagrams = if let Some(dtype) = diagram_type {
            sqlx::query_as::<_, DiagramListItem>(
                r#"
                SELECT id, title, diagram_type, created_at
                FROM diagrams
                WHERE user_id = $1 AND diagram_type = $2
                ORDER BY created_at DESC
                LIMIT $3 OFFSET $4
                "#
            )
            .bind(user_id)
            .bind(dtype)
            .bind(limit)
            .bind(offset)
            .fetch_all(db)
            .await
        } else {
            sqlx::query_as::<_, DiagramListItem>(
                r#"
                SELECT id, title, diagram_type, created_at
                FROM diagrams
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                "#
            )
            .bind(user_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(db)
            .await
        }
        .map_err(|e| {
            tracing::error!("Failed to list diagrams: {}", e);
            DiagramError::DatabaseError
        })?;

        // Get total count
        let total: i64 = if let Some(dtype) = diagram_type {
            sqlx::query_scalar(
                "SELECT COUNT(*)::bigint FROM diagrams WHERE user_id = $1 AND diagram_type = $2"
            )
            .bind(user_id)
            .bind(dtype)
            .fetch_one(db)
            .await
        } else {
            sqlx::query_scalar(
                "SELECT COUNT(*)::bigint FROM diagrams WHERE user_id = $1"
            )
            .bind(user_id)
            .fetch_one(db)
            .await
        }
        .map_err(|e| {
            tracing::error!("Failed to count diagrams: {}", e);
            DiagramError::DatabaseError
        })?;

        Ok((diagrams, total))
    }

    /// Get a single diagram
    pub async fn get(
        db: &PgPool,
        diagram_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<Diagram>, DiagramError> {
        let result = sqlx::query_as::<_, Diagram>(
            r#"
            SELECT id, user_id, title, prompt, diagram_type, canvas_json, created_at
            FROM diagrams
            WHERE id = $1 AND user_id = $2
            "#
        )
        .bind(diagram_id)
        .bind(user_id)
        .fetch_optional(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get diagram: {}", e);
            DiagramError::DatabaseError
        })?;

        Ok(result)
    }

    /// Delete a diagram
    pub async fn delete(
        db: &PgPool,
        diagram_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<bool, DiagramError> {
        let result = sqlx::query(
            "DELETE FROM diagrams WHERE id = $1 AND user_id = $2"
        )
        .bind(diagram_id)
        .bind(user_id)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete diagram: {}", e);
            DiagramError::DatabaseError
        })?;

        Ok(result.rows_affected() > 0)
    }
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
}

#[derive(Debug, Deserialize)]
struct ClaudeContent {
    text: String,
    #[serde(rename = "type")]
    type_: String,
}

#[derive(Debug, thiserror::Error)]
pub enum DiagramError {
    #[error("API request failed")]
    ApiRequestFailed,
    #[error("API error: {0}")]
    ApiError(String),
    #[error("Invalid response from API")]
    InvalidResponse,
    #[error("Empty response from API")]
    EmptyResponse,
    #[error("Invalid JSON in response")]
    InvalidJson,
    #[error("Missing elements in diagram")]
    MissingElements,
    #[error("Empty elements array")]
    EmptyElements,
    #[error("Database error")]
    DatabaseError,
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
}

impl From<DiagramError> for (axum::http::StatusCode, serde_json::Value) {
    fn from(err: DiagramError) -> Self {
        match err {
            DiagramError::ApiRequestFailed | DiagramError::ApiError(_) => {
                (
                    axum::http::StatusCode::BAD_GATEWAY,
                    serde_json::json!({
                        "error": {
                            "code": "AI_GENERATION_FAILED",
                            "message": "Failed to generate diagram. Please try again."
                        }
                    }),
                )
            }
            DiagramError::InvalidResponse | DiagramError::EmptyResponse | 
            DiagramError::InvalidJson | DiagramError::MissingElements | 
            DiagramError::EmptyElements => {
                (
                    axum::http::StatusCode::BAD_GATEWAY,
                    serde_json::json!({
                        "error": {
                            "code": "AI_GENERATION_FAILED",
                            "message": "AI returned an invalid diagram. Please try again."
                        }
                    }),
                )
            }
            DiagramError::DatabaseError => {
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    serde_json::json!({
                        "error": {
                            "code": "INTERNAL_ERROR",
                            "message": "Database error occurred."
                        }
                    }),
                )
            }
            DiagramError::RateLimitExceeded => {
                (
                    axum::http::StatusCode::TOO_MANY_REQUESTS,
                    serde_json::json!({
                        "error": {
                            "code": "RATE_LIMIT_EXCEEDED",
                            "message": "Free tier limit reached.",
                            "upgrade_url": "/pricing"
                        }
                    }),
                )
            }
        }
    }
}
