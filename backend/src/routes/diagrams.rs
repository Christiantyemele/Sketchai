use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use chrono::{Utc, Datelike};

use crate::{
    middleware::auth::Auth,
    services::{
        diagram::{DiagramError, GenerateDiagramRequest},
        supabase::DiagramInsert,
    },
    AppState,
};

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub data: T,
}

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: ErrorBody,
}

#[derive(Debug, Serialize)]
pub struct ErrorBody {
    pub code: &'static str,
    pub message: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upgrade_url: Option<&'static str>,
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default = "default_limit")]
    pub limit: i32,
    #[serde(default)]
    pub offset: i32,
    #[serde(rename = "type")]
    pub diagram_type: Option<String>,
}

fn default_limit() -> i32 {
    20
}

#[derive(Debug, Serialize)]
pub struct DiagramResponse {
    pub diagram: DiagramJson,
}

#[derive(Debug, Serialize)]
pub struct DiagramListItemResponse {
    pub diagrams: Vec<DiagramListItemJson>,
    pub total: i64,
    pub limit: i32,
    pub offset: i32,
}

#[derive(Debug, Serialize)]
pub struct DiagramJson {
    pub id: Uuid,
    pub title: Option<String>,
    pub prompt: String,
    pub diagram_type: String,
    pub canvas_json: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct DiagramListItemJson {
    pub id: Uuid,
    pub title: Option<String>,
    pub diagram_type: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl From<crate::services::supabase::Diagram> for DiagramJson {
    fn from(d: crate::services::supabase::Diagram) -> Self {
        Self {
            id: d.id,
            title: d.title,
            prompt: d.prompt,
            diagram_type: d.diagram_type,
            canvas_json: d.canvas_json,
            created_at: d.created_at,
        }
    }
}

impl From<crate::services::supabase::Diagram> for DiagramListItemJson {
    fn from(d: crate::services::supabase::Diagram) -> Self {
        Self {
            id: d.id,
            title: d.title,
            diagram_type: d.diagram_type,
            created_at: d.created_at,
        }
    }
}

/// POST /diagrams/generate - Generate a new diagram
pub async fn generate_diagram(
    State(state): State<Arc<AppState>>,
    Auth(user): Auth,
    Json(body): Json<GenerateDiagramRequest>,
) -> Result<Json<ApiResponse<DiagramResponse>>, (StatusCode, Json<ApiError>)> {
    let user_id = Uuid::parse_str(&user.id).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Invalid user ID",
                    upgrade_url: None,
                },
            }),
        )
    })?;

    // Ensure user profile exists
    state.supabase.upsert_profile(&user_id, "free")
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError {
                    error: ErrorBody {
                        code: "INTERNAL_ERROR",
                        message: "Failed to create user profile",
                        upgrade_url: None,
                    },
                }),
            )
        })?;

    // Get user plan
    let profile = state.supabase.get_profile(&user_id).await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Failed to get user profile",
                    upgrade_url: None,
                },
            }),
        )
    })?;

    let plan = profile.map(|p| p.plan).unwrap_or_else(|| "free".to_string());

    // Check usage limit for free tier
    if plan == "free" {
        let month = format!("{}-{:02}", Utc::now().year(), Utc::now().month());
        let usage = state.supabase.get_usage(&user_id, &month).await.map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError {
                    error: ErrorBody {
                        code: "INTERNAL_ERROR",
                        message: "Failed to check usage",
                        upgrade_url: None,
                    },
                }),
            )
        })?;

        let count = usage.map(|u| u.count).unwrap_or(0);
        if count >= state.usage_service.free_tier_limit() as i32 {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(ApiError {
                    error: ErrorBody {
                        code: "RATE_LIMIT_EXCEEDED",
                        message: "Free tier limit of 15 diagrams per month reached.",
                        upgrade_url: Some("/pricing"),
                    },
                }),
            ));
        }
    }

    // Validate diagram type
    let valid_types = ["flowchart", "architecture", "sequence", "component", "erd", "c4"];
    if !valid_types.contains(&body.diagram_type.as_str()) {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ApiError {
                error: ErrorBody {
                    code: "VALIDATION_ERROR",
                    message: "Invalid diagram type. Must be one of: flowchart, architecture, sequence, component, erd, c4",
                    upgrade_url: None,
                },
            }),
        ));
    }

    // Generate diagram using Claude
    let canvas_json = state
        .diagram_service
        .generate(&body.prompt, &body.diagram_type)
        .await
        .map_err(|e| {
            let (status, code, message) = match e {
                DiagramError::ApiRequestFailed | DiagramError::ApiError(_) => {
                    (StatusCode::BAD_GATEWAY, "AI_GENERATION_FAILED", "Failed to generate diagram. Please try again.")
                }
                DiagramError::InvalidResponse | DiagramError::EmptyResponse |
                DiagramError::InvalidJson | DiagramError::MissingElements |
                DiagramError::EmptyElements => {
                    (StatusCode::BAD_GATEWAY, "AI_GENERATION_FAILED", "AI returned an invalid diagram. Please try again.")
                }
                _ => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "An error occurred."),
            };
            (status, Json(ApiError {
                error: ErrorBody {
                    code,
                    message,
                    upgrade_url: None,
                },
            }))
        })?;

    // Save diagram
    let diagram = state.supabase.save_diagram(&DiagramInsert {
        id: Uuid::new_v4(),
        user_id,
        title: body.title.clone(),
        prompt: body.prompt.clone(),
        diagram_type: body.diagram_type.clone(),
        canvas_json: canvas_json.clone(),
        created_at: Utc::now(),
    }).await.map_err(|e| {
        tracing::error!("Failed to save diagram: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Failed to save diagram",
                    upgrade_url: None,
                },
            }),
        )
    })?;

    // Increment usage
    let month = format!("{}-{:02}", Utc::now().year(), Utc::now().month());
    state.supabase.increment_usage(&user_id, &month).await.map_err(|e| {
        tracing::error!("Failed to increment usage: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Failed to update usage",
                    upgrade_url: None,
                },
            }),
        )
    })?;

    Ok(Json(ApiResponse {
        data: DiagramResponse {
            diagram: diagram.into(),
        },
    }))
}

/// GET /diagrams - List user's diagrams
pub async fn list_diagrams(
    State(state): State<Arc<AppState>>,
    Auth(user): Auth,
    Query(query): Query<ListQuery>,
) -> Result<Json<ApiResponse<DiagramListItemResponse>>, (StatusCode, Json<ApiError>)> {
    let user_id = Uuid::parse_str(&user.id).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Invalid user ID",
                    upgrade_url: None,
                },
            }),
        )
    })?;

    // Validate limit
    let limit = query.limit.min(50).max(1);

    let diagrams = state.supabase.list_diagrams(
        &user_id,
        limit,
        query.offset,
        query.diagram_type.as_deref(),
    ).await.map_err(|e| {
        tracing::error!("Failed to list diagrams: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Failed to list diagrams",
                    upgrade_url: None,
                },
            }),
        )
    })?;

    let total = state.supabase.count_diagrams(&user_id, query.diagram_type.as_deref())
        .await
        .unwrap_or(0);

    Ok(Json(ApiResponse {
        data: DiagramListItemResponse {
            diagrams: diagrams.into_iter().map(|d| d.into()).collect(),
            total,
            limit,
            offset: query.offset,
        },
    }))
}

/// GET /diagrams/:id - Get a single diagram
pub async fn get_diagram(
    State(state): State<Arc<AppState>>,
    Auth(user): Auth,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<DiagramResponse>>, (StatusCode, Json<ApiError>)> {
    let user_id = Uuid::parse_str(&user.id).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Invalid user ID",
                    upgrade_url: None,
                },
            }),
        )
    })?;

    let diagram = state.supabase.get_diagram(&id, &user_id).await.map_err(|e| {
        tracing::error!("Failed to get diagram: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Failed to get diagram",
                    upgrade_url: None,
                },
            }),
        )
    })?;

    match diagram {
        Some(d) => Ok(Json(ApiResponse {
            data: DiagramResponse {
                diagram: d.into(),
            },
        })),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ApiError {
                error: ErrorBody {
                    code: "NOT_FOUND",
                    message: "Diagram not found",
                    upgrade_url: None,
                },
            }),
        )),
    }
}

/// DELETE /diagrams/:id - Delete a diagram
pub async fn delete_diagram(
    State(state): State<Arc<AppState>>,
    Auth(user): Auth,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let user_id = Uuid::parse_str(&user.id).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Invalid user ID",
                    upgrade_url: None,
                },
            }),
        )
    })?;

    let deleted = state.supabase.delete_diagram(&id, &user_id).await.map_err(|e| {
        tracing::error!("Failed to delete diagram: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Failed to delete diagram",
                    upgrade_url: None,
                },
            }),
        )
    })?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(ApiError {
                error: ErrorBody {
                    code: "NOT_FOUND",
                    message: "Diagram not found",
                    upgrade_url: None,
                },
            }),
        ))
    }
}
