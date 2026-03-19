use axum::{
    extract::{FromRef, FromRequestParts},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};

use crate::AppState;

/// Supabase JWT claims
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupabaseClaims {
    pub sub: String,        // User ID
    pub email: String,
    pub role: String,
    pub aud: String,
    pub iat: i64,
    pub exp: i64,
}

/// Cached JWKS from Supabase
#[derive(Debug, Clone, Deserialize)]
pub struct Jwks {
    pub keys: Vec<Jwk>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Jwk {
    pub kid: String,
    pub n: String,
    pub e: String,
    pub kty: String,
    pub alg: String,
    #[serde(rename = "use")]
    pub use_: String,
}

/// Auth state for JWT verification
pub struct AuthState {
    jwks_url: String,
    jwks: Arc<RwLock<Option<Jwks>>>,
    last_fetch: Arc<RwLock<Option<DateTime<Utc>>>>,
}

impl AuthState {
    pub fn new(jwks_url: &str) -> Self {
        Self {
            jwks_url: jwks_url.to_string(),
            jwks: Arc::new(RwLock::new(None)),
            last_fetch: Arc::new(RwLock::new(None)),
        }
    }

    /// Fetch JWKS from Supabase (with caching)
    pub async fn get_decoding_key(&self, kid: &str) -> Result<DecodingKey, AuthError> {
        // Check if we need to refresh JWKS (cache for 1 hour)
        let should_refresh = {
            let last_fetch = self.last_fetch.read().await;
            match *last_fetch {
                None => true,
                Some(time) => {
                    let now = Utc::now();
                    (now - time).num_hours() >= 1
                }
            }
        };

        if should_refresh {
            self.fetch_jwks().await?;
        }

        let jwks = self.jwks.read().await;
        let jwks = jwks.as_ref().ok_or(AuthError::JwksNotFound)?;

        // Find the key with matching kid
        let jwk = jwks.keys.iter()
            .find(|k| k.kid == kid)
            .ok_or(AuthError::KeyNotFound)?;

        // Create decoding key from RSA public key components
        DecodingKey::from_rsa_components(&jwk.n, &jwk.e)
            .map_err(|_| AuthError::InvalidKey)
    }

    async fn fetch_jwks(&self) -> Result<(), AuthError> {
        let client = reqwest::Client::new();
        let response = client
            .get(&self.jwks_url)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch JWKS: {}", e);
                AuthError::JwksFetchFailed
            })?;

        let jwks: Jwks = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse JWKS: {}", e);
            AuthError::JwksParseFailed
        })?;

        *self.jwks.write().await = Some(jwks);
        *self.last_fetch.write().await = Some(Utc::now());

        tracing::info!("JWKS fetched and cached successfully");
        Ok(())
    }

    /// Verify a JWT token and extract claims
    pub async fn verify_token(&self, token: &str) -> Result<SupabaseClaims, AuthError> {
        // Decode header to get kid
        let header = jsonwebtoken::decode_header(token)
            .map_err(|e| {
                tracing::error!("Failed to decode JWT header: {}", e);
                AuthError::InvalidToken
            })?;

        let kid = header.kid.ok_or(AuthError::MissingKeyId)?;

        // Get the decoding key
        let decoding_key = self.get_decoding_key(&kid).await?;

        // Create validation
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&["authenticated"]);

        // Decode and verify
        let claims = decode::<SupabaseClaims>(token, &decoding_key, &validation)
            .map_err(|e| {
                tracing::error!("JWT verification failed: {}", e);
                AuthError::InvalidToken
            })?;

        Ok(claims.claims)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: String,
    pub email: String,
}

#[derive(Debug)]
pub enum AuthError {
    MissingToken,
    InvalidToken,
    JwksNotFound,
    JwksFetchFailed,
    JwksParseFailed,
    KeyNotFound,
    InvalidKey,
    MissingKeyId,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "Missing authorization token"),
            AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "Invalid or expired token"),
            AuthError::JwksNotFound => (StatusCode::INTERNAL_SERVER_ERROR, "JWKS not loaded"),
            AuthError::JwksFetchFailed => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch JWKS"),
            AuthError::JwksParseFailed => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to parse JWKS"),
            AuthError::KeyNotFound => (StatusCode::UNAUTHORIZED, "Signing key not found"),
            AuthError::InvalidKey => (StatusCode::INTERNAL_SERVER_ERROR, "Invalid signing key"),
            AuthError::MissingKeyId => (StatusCode::UNAUTHORIZED, "Missing key ID in token"),
        };

        let body = Json(serde_json::json!({
            "error": {
                "code": "UNAUTHORIZED",
                "message": message
            }
        }));

        (status, body).into_response()
    }
}

/// Extract authenticated user from request (optional for development)
#[derive(Debug, Clone)]
pub struct Auth(pub AuthUser);

#[async_trait::async_trait]
impl<S> FromRequestParts<S> for Auth
where
    Arc<AppState>: FromRef<S>,
    S: Send + Sync + 'static,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = Arc::<AppState>::from_ref(state);

        // Extract Authorization header (optional for development)
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|h| h.to_str().ok());

        // If no auth header, return a dev user (bypass auth for development)
        let Some(auth_header) = auth_header else {
            tracing::warn!("No auth token provided - using dev user");
            return Ok(Auth(AuthUser {
                id: "00000000-0000-0000-0000-000000000001".to_string(),
                email: "dev@sketchai.local".to_string(),
            }));
        };

        // Check Bearer prefix
        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AuthError::MissingToken)?;

        // Verify token
        let claims = app_state.auth.verify_token(token).await?;

        Ok(Auth(AuthUser {
            id: claims.sub,
            email: claims.email,
        }))
    }
}
