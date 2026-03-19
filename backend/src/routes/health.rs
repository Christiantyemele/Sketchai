use axum::{extract::State, Json};
use std::sync::Arc;

use crate::AppState;

#[derive(serde::Serialize)]
pub struct HealthResponse {
    status: &'static str,
    version: &'static str,
}

/// GET /health - Health check endpoint
pub async fn health_check(
    State(_state): State<Arc<AppState>>,
) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}
