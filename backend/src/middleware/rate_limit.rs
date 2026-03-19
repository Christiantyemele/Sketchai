use axum::{
    extract::{ConnectInfo, FromRef},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use dashmap::DashMap;
use std::{
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};

use crate::AppState;

/// IP-based rate limiter using DashMap (in-memory)
pub struct RateLimitState {
    requests: DashMap<String, Vec<Instant>>,
    limit: u32,
    window: Duration,
}

impl RateLimitState {
    pub fn new(limit: u32) -> Self {
        Self {
            requests: DashMap::new(),
            limit,
            window: Duration::from_secs(60), // 1 minute window
        }
    }

    /// Check if an IP is rate limited
    pub fn check(&self, ip: &str) -> Result<(), RateLimitError> {
        let now = Instant::now();
        let window_start = now - self.window;

        // Get or create entry for this IP
        let mut timestamps = self.requests.entry(ip.to_string()).or_insert_with(Vec::new);

        // Remove old timestamps outside the window
        timestamps.retain(|&t| t > window_start);

        // Check if limit exceeded
        if timestamps.len() >= self.limit as usize {
            return Err(RateLimitError::LimitExceeded);
        }

        // Add current request timestamp
        timestamps.push(now);

        Ok(())
    }

    /// Clean up old entries (call periodically)
    pub fn cleanup(&self) {
        let now = Instant::now();
        let window_start = now - self.window;

        self.requests.retain(|_, timestamps| {
            timestamps.retain(|&t| t > window_start);
            !timestamps.is_empty()
        });
    }
}

#[derive(Debug)]
pub enum RateLimitError {
    LimitExceeded,
}

impl IntoResponse for RateLimitError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            RateLimitError::LimitExceeded => {
                (StatusCode::TOO_MANY_REQUESTS, "Too many requests. Please try again later.")
            }
        };

        let body = Json(serde_json::json!({
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": message
            }
        }));

        (status, body).into_response()
    }
}

/// Rate limit extractor (can be used as middleware)
pub struct RateLimitGuard;

#[async_trait::async_trait]
impl<S> axum::extract::FromRequestParts<S> for RateLimitGuard
where
    Arc<AppState>: axum::extract::FromRef<S>,
    S: Send + Sync + 'static,
{
    type Rejection = RateLimitError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = Arc::<AppState>::from_ref(state);

        // Get client IP
        let ip = parts
            .extensions
            .get::<ConnectInfo<SocketAddr>>()
            .map(|addr| addr.ip().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        app_state.rate_limit.check(&ip)?;

        Ok(RateLimitGuard)
    }
}
