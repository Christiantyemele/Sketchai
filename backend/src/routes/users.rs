use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;
use chrono::{Utc, Datelike};

use crate::{
    middleware::auth::Auth,
    AppState,
};

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub data: T,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub user: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: Uuid,
    pub email: String,
    pub plan: String,
    pub usage: UsageInfoJson,
}

#[derive(Debug, Serialize)]
pub struct UsageInfoJson {
    pub month: String,
    pub diagrams_generated: i32,
    pub limit: Option<i32>,
}

/// GET /users/me - Get current user info
pub async fn get_current_user(
    State(state): State<Arc<AppState>>,
    Auth(user): Auth,
) -> Result<Json<ApiResponse<UserResponse>>, (StatusCode, Json<crate::routes::diagrams::ApiError>)> {
    let user_id = Uuid::parse_str(&user.id).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::routes::diagrams::ApiError {
                error: crate::routes::diagrams::ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Invalid user ID",
                    upgrade_url: None,
                },
            }),
        )
    })?;

    // Ensure profile exists
    let profile = state.supabase.upsert_profile(&user_id, "free")
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(crate::routes::diagrams::ApiError {
                    error: crate::routes::diagrams::ErrorBody {
                        code: "INTERNAL_ERROR",
                        message: "Failed to create user profile",
                        upgrade_url: None,
                    },
                }),
            )
        })?;

    let plan = profile.plan.clone();

    // Get usage info
    let month = format!("{}-{:02}", Utc::now().year(), Utc::now().month());
    let usage = state.supabase.get_usage(&user_id, &month).await.map_err(|e| {
        tracing::error!("Failed to get usage: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::routes::diagrams::ApiError {
                error: crate::routes::diagrams::ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Failed to get usage info",
                    upgrade_url: None,
                },
            }),
        )
    })?;

    let diagrams_generated = usage.map(|u| u.count).unwrap_or(0);
    let limit = if plan == "pro" || plan == "team" {
        None
    } else {
        Some(state.usage_service.free_tier_limit() as i32)
    };

    Ok(Json(ApiResponse {
        data: UserResponse {
            user: UserInfo {
                id: user_id,
                email: user.email,
                plan,
                usage: UsageInfoJson {
                    month,
                    diagrams_generated,
                    limit,
                },
            },
        },
    }))
}
