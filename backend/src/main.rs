mod config;
mod middleware;
mod routes;
mod services;

use std::sync::Arc;
use std::net::SocketAddr;

use axum::{
    routing::{get, post, delete},
    Router,
};
use tower_http::cors::{CorsLayer, Any};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::middleware::auth::AuthState;
use crate::middleware::rate_limit::RateLimitState;
use crate::services::supabase::SupabaseClient;
use crate::services::diagram::DiagramService;
use crate::services::usage::UsageService;
use crate::services::billing::BillingService;

pub struct AppState {
    pub config: Config,
    pub supabase: SupabaseClient,
    pub auth: AuthState,
    pub rate_limit: RateLimitState,
    pub diagram_service: DiagramService,
    pub usage_service: UsageService,
    pub billing_service: BillingService,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        let supabase = SupabaseClient::new(
            config.supabase_url.clone(),
            config.supabase_service_key.clone(),
        );
        let auth = AuthState::new(&config.supabase_jwks_url);
        let rate_limit = RateLimitState::new(config.ip_rate_limit_per_minute);
        let diagram_service = DiagramService::new(
            config.anthropic_api_key.clone(),
            config.anthropic_api_url.clone(),
        );
        let usage_service = UsageService::new(config.free_tier_monthly_limit);
        let billing_service = BillingService::new(
            config.stripe_api_key.clone(),
            config.stripe_webhook_secret.clone(),
            config.stripe_pro_price_id.clone(),
            config.stripe_team_price_id.clone(),
            config.nowpayments_api_key.clone(),
            config.nowpayments_ipn_secret.clone(),
            config.nowpayments_api_url.clone(),
        );

        Self {
            config,
            supabase,
            auth,
            rate_limit,
            diagram_service,
            usage_service,
            billing_service,
        }
    }
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "sketchai_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables (try current dir, then parent dir)
    if dotenvy::dotenv().is_err() {
        // Try parent directory
        let parent_env = std::path::Path::new("../.env");
        if parent_env.exists() {
            dotenvy::from_path(parent_env).ok();
        }
    }

    // Load config
    let config = Config::from_env().expect("Failed to load configuration");
    tracing::info!("Configuration loaded successfully");

    // Create app state
    let state = Arc::new(AppState::new(config.clone()));

    // Build router
    let app = Router::new()
        // Health check (no auth required)
        .route("/health", get(routes::health::health_check))
        // Diagram routes (auth required)
        .route("/diagrams/generate", post(routes::diagrams::generate_diagram))
        .route("/diagrams", get(routes::diagrams::list_diagrams))
        .route("/diagrams/:id", get(routes::diagrams::get_diagram))
        .route("/diagrams/:id", delete(routes::diagrams::delete_diagram))
        // User routes (auth required)
        .route("/users/me", get(routes::users::get_current_user))
        // Billing routes - Stripe
        .route("/billing/stripe/create-checkout", post(routes::billing::create_stripe_checkout))
        .route("/billing/stripe/portal", post(routes::billing::create_stripe_portal))
        .route("/billing/stripe/webhook", post(routes::billing::stripe_webhook))
        // Billing routes - Crypto
        .route("/billing/crypto/create-payment", post(routes::billing::create_crypto_payment))
        .route("/billing/crypto/webhook", post(routes::billing::crypto_webhook))
        // Add middleware layers
        .layer(
            tower::ServiceBuilder::new()
                .layer(
                    CorsLayer::new()
                        .allow_origin(Any)
                        .allow_methods(Any)
                        .allow_headers(Any)
                        .max_age(std::time::Duration::from_secs(3600))
                )
        )
        .with_state(state);

    // Start server
    let addr: SocketAddr = format!("[::]:{}", config.port)
        .parse()
        .expect("Invalid address");

    tracing::info!("Server starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.expect("Failed to bind");
    axum::serve(listener, app).await.expect("Failed to start server");
}
