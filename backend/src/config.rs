use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    // Server
    pub port: u16,
    pub frontend_url: String,

    // Supabase
    pub supabase_url: String,
    pub supabase_service_key: String,
    pub supabase_jwt_secret: String,
    pub supabase_jwks_url: String,

    // Storage buckets
    pub supabase_bucket_public: String,
    pub supabase_bucket_private: String,

    // Anthropic
    pub anthropic_api_key: String,
    pub anthropic_api_url: String,

    // Stripe
    pub stripe_api_key: String,
    pub stripe_webhook_secret: String,
    pub stripe_pro_price_id: String,
    pub stripe_team_price_id: String,

    // NOWPayments
    pub nowpayments_api_key: String,
    pub nowpayments_ipn_secret: String,
    pub nowpayments_api_url: String,

    // Rate limits
    pub ip_rate_limit_per_minute: u32,
    pub free_tier_monthly_limit: u32,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        // Load Supabase URL first (needed for deriving other values)
        let supabase_url = env::var("SUPABASE_URL")
            .map_err(|_| "SUPABASE_URL is required".to_string())?;

        Ok(Self {
            // Server
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .map_err(|e| format!("Invalid PORT: {}", e))?,
            frontend_url: env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:5173".to_string()),

            // Supabase
            supabase_jwks_url: env::var("SUPABASE_JWKS_URL")
                .unwrap_or_else(|_| format!("{}/.well-known/jwks.json", supabase_url)),
            supabase_service_key: env::var("SUPABASE_SERVICE_KEY")
                .map_err(|_| "SUPABASE_SERVICE_KEY is required".to_string())?,
            supabase_jwt_secret: env::var("SUPABASE_JWT_SECRET")
                .map_err(|_| "SUPABASE_JWT_SECRET is required".to_string())?,
            supabase_bucket_public: env::var("SUPABASE_BUCKET_PUBLIC")
                .unwrap_or_else(|_| "diagrams".to_string()),
            supabase_bucket_private: env::var("SUPABASE_BUCKET_PRIVATE")
                .unwrap_or_else(|_| "private".to_string()),
            supabase_url,

            // Anthropic
            anthropic_api_key: env::var("ANTHROPIC_API_KEY")
                .map_err(|_| "ANTHROPIC_API_KEY is required".to_string())?,
            anthropic_api_url: env::var("ANTHROPIC_API_URL")
                .unwrap_or_else(|_| "https://api.anthropic.com/v1/messages".to_string()),

            // Stripe
            stripe_api_key: env::var("STRIPE_API_KEY")
                .map_err(|_| "STRIPE_API_KEY is required".to_string())?,
            stripe_webhook_secret: env::var("STRIPE_WEBHOOK_SECRET")
                .map_err(|_| "STRIPE_WEBHOOK_SECRET is required".to_string())?,
            stripe_pro_price_id: env::var("STRIPE_PRO_PRICE_ID")
                .map_err(|_| "STRIPE_PRO_PRICE_ID is required".to_string())?,
            stripe_team_price_id: env::var("STRIPE_TEAM_PRICE_ID")
                .map_err(|_| "STRIPE_TEAM_PRICE_ID is required".to_string())?,

            // NOWPayments
            nowpayments_api_key: env::var("NOWPAYMENTS_API_KEY")
                .map_err(|_| "NOWPAYMENTS_API_KEY is required".to_string())?,
            nowpayments_ipn_secret: env::var("NOWPAYMENTS_IPN_SECRET")
                .map_err(|_| "NOWPAYMENTS_IPN_SECRET is required".to_string())?,
            nowpayments_api_url: env::var("NOWPAYMENTS_API_URL")
                .unwrap_or_else(|_| "https://api.nowpayments.io/v1".to_string()),

            // Rate limits
            ip_rate_limit_per_minute: env::var("IP_RATE_LIMIT_PER_MINUTE")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .map_err(|e| format!("Invalid IP_RATE_LIMIT_PER_MINUTE: {}", e))?,
            free_tier_monthly_limit: env::var("FREE_TIER_MONTHLY_LIMIT")
                .unwrap_or_else(|_| "15".to_string())
                .parse()
                .map_err(|e| format!("Invalid FREE_TIER_MONTHLY_LIMIT: {}", e))?,
        })
    }
}
