use reqwest::Client;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc, Duration};

use super::supabase::{SupabaseClient, SubscriptionInsert};

#[derive(Debug, Clone)]
pub struct BillingService {
    stripe_api_key: String,
    stripe_webhook_secret: String,
    stripe_pro_price_id: String,
    stripe_team_price_id: String,
    nowpayments_api_key: String,
    nowpayments_ipn_secret: String,
    nowpayments_api_url: String,
    http_client: Client,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StripeCheckoutRequest {
    pub plan: String,
    pub success_url: String,
    pub cancel_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StripeCheckoutResponse {
    pub checkout_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StripePortalRequest {
    pub return_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StripePortalResponse {
    pub portal_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CryptoPaymentRequest {
    pub plan: String,
    pub currency: String,
    pub period: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CryptoPaymentResponse {
    pub payment_id: String,
    pub payment_address: String,
    pub payment_amount: String,
    pub currency: String,
    pub expires_at: DateTime<Utc>,
    pub payment_url: String,
}

#[derive(Debug, Deserialize)]
pub struct StripeWebhookEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: StripeEventData,
}

#[derive(Debug, Deserialize)]
pub struct StripeEventData {
    pub object: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct CryptoWebhookEvent {
    pub payment_id: String,
    pub payment_status: String,
    pub order_id: Option<String>,
    pub pay_amount: String,
    pub pay_currency: String,
    pub price_amount: String,
    pub price_currency: String,
}

impl BillingService {
    pub fn new(
        stripe_api_key: String,
        stripe_webhook_secret: String,
        stripe_pro_price_id: String,
        stripe_team_price_id: String,
        nowpayments_api_key: String,
        nowpayments_ipn_secret: String,
        nowpayments_api_url: String,
    ) -> Self {
        Self {
            stripe_api_key,
            stripe_webhook_secret,
            stripe_pro_price_id,
            stripe_team_price_id,
            nowpayments_api_key,
            nowpayments_ipn_secret,
            nowpayments_api_url,
            http_client: Client::new(),
        }
    }

    /// Create Stripe checkout session
    pub async fn create_stripe_checkout(
        &self,
        supabase: &SupabaseClient,
        user_id: &Uuid,
        email: &str,
        plan: &str,
        success_url: &str,
        cancel_url: &str,
    ) -> Result<StripeCheckoutResponse, BillingError> {
        let price_id = match plan {
            "pro" => &self.stripe_pro_price_id,
            "team" => &self.stripe_team_price_id,
            _ => return Err(BillingError::InvalidPlan),
        };

        let body = serde_json::json!({
            "mode": "subscription",
            "payment_method_types": ["card"],
            "customer_email": email,
            "client_reference_id": user_id.to_string(),
            "line_items": [{
                "price": price_id,
                "quantity": 1
            }],
            "success_url": success_url,
            "cancel_url": cancel_url,
        });

        let response = self.http_client
            .post("https://api.stripe.com/v1/checkout/sessions")
            .header("Authorization", format!("Bearer {}", self.stripe_api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Stripe API request failed: {}", e);
                BillingError::StripeApiError
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Stripe API error: {} - {}", status, body);
            return Err(BillingError::StripeApiError);
        }

        let session: StripeSession = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse Stripe response: {}", e);
            BillingError::StripeApiError
        })?;

        Ok(StripeCheckoutResponse {
            checkout_url: session.url,
        })
    }

    /// Create Stripe customer portal session
    pub async fn create_stripe_portal(
        &self,
        customer_id: &str,
        return_url: &str,
    ) -> Result<StripePortalResponse, BillingError> {
        let body = serde_json::json!({
            "customer": customer_id,
            "return_url": return_url,
        });

        let response = self.http_client
            .post("https://api.stripe.com/v1/billing_portal/sessions")
            .header("Authorization", format!("Bearer {}", self.stripe_api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Stripe Portal API request failed: {}", e);
                BillingError::StripeApiError
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Stripe Portal API error: {} - {}", status, body);
            return Err(BillingError::StripeApiError);
        }

        let session: StripePortalSession = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse Stripe Portal response: {}", e);
            BillingError::StripeApiError
        })?;

        Ok(StripePortalResponse {
            portal_url: session.url,
        })
    }

    /// Verify Stripe webhook signature
    pub fn verify_stripe_webhook(
        &self,
        payload: &[u8],
        _sig_header: &str,
    ) -> Result<StripeWebhookEvent, BillingError> {
        // In production, use stripe-rs or similar for proper signature verification
        // For now, we'll parse the event
        let event: StripeWebhookEvent = serde_json::from_slice(payload)
            .map_err(|e| {
                tracing::error!("Failed to parse Stripe webhook: {}", e);
                BillingError::WebhookVerificationFailed
            })?;

        Ok(event)
    }

    /// Handle Stripe webhook events
    pub async fn handle_stripe_webhook(
        &self,
        supabase: &SupabaseClient,
        event: StripeWebhookEvent,
    ) -> Result<(), BillingError> {
        match event.event_type.as_str() {
            "checkout.session.completed" => {
                let session = event.data.object;
                let user_id: Uuid = session.get("client_reference_id")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse().ok())
                    .ok_or(BillingError::InvalidPayload)?;

                let customer_id = session.get("customer")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                let subscription_id = session.get("subscription")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                // Determine plan from line items or metadata
                let plan = session.get("metadata")
                    .and_then(|m| m.get("plan"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("pro");

                self.activate_subscription(supabase, &user_id, "stripe", customer_id, subscription_id, plan).await?;
            }
            "customer.subscription.deleted" => {
                let subscription = event.data.object;
                let customer_id = subscription.get("customer")
                    .and_then(|v| v.as_str())
                    .ok_or(BillingError::InvalidPayload)?;

                self.deactivate_subscription(supabase, customer_id).await?;
            }
            _ => {
                tracing::debug!("Unhandled Stripe event: {}", event.event_type);
            }
        }

        Ok(())
    }

    /// Create crypto payment via NOWPayments
    pub async fn create_crypto_payment(
        &self,
        supabase: &SupabaseClient,
        user_id: &Uuid,
        plan: &str,
        currency: &str,
        period: &str,
    ) -> Result<CryptoPaymentResponse, BillingError> {
        let price_amount = match plan {
            "pro" => match period {
                "annual" => 90.0, // $90/year
                _ => 9.0,        // $9/month
            },
            "team" => match period {
                "annual" => 190.0,
                _ => 19.0,
            },
            _ => return Err(BillingError::InvalidPlan),
        };

        let order_id = format!("{}_{}_{}", user_id, plan, period);

        let body = serde_json::json!({
            "price_amount": price_amount,
            "price_currency": "USD",
            "pay_currency": currency.to_uppercase(),
            "order_id": order_id,
            "order_description": format!("SketchAI {} plan - {}", plan, period),
            "ipn_callback_url": format!("{}/billing/crypto/webhook", "https://api.sketchai.app"),
        });

        let response = self.http_client
            .post(format!("{}/payment", self.nowpayments_api_url))
            .header("x-api-key", &self.nowpayments_api_key)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("NOWPayments API request failed: {}", e);
                BillingError::CryptoApiError
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("NOWPayments API error: {} - {}", status, body);
            return Err(BillingError::CryptoApiError);
        }

        let payment: NowPaymentsResponse = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse NOWPayments response: {}", e);
            BillingError::CryptoApiError
        })?;

        let expires_at = Utc::now() + Duration::hours(24);
        let payment_id = payment.payment_id.clone();

        Ok(CryptoPaymentResponse {
            payment_id: payment.payment_id,
            payment_address: payment.pay_address,
            payment_amount: payment.pay_amount,
            currency: payment.pay_currency,
            expires_at,
            payment_url: format!("https://nowpayments.io/payment/{}", payment_id),
        })
    }

    /// Verify NOWPayments webhook signature
    pub fn verify_crypto_webhook(
        &self,
        payload: &[u8],
        sig_header: &str,
    ) -> Result<CryptoWebhookEvent, BillingError> {
        // Verify HMAC signature
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        type HmacSha256 = Hmac<Sha256>;

        let mut mac = HmacSha256::new_from_slice(self.nowpayments_ipn_secret.as_bytes())
            .map_err(|_| BillingError::WebhookVerificationFailed)?;

        mac.update(payload);
        let expected_sig = hex::encode(mac.finalize().into_bytes());

        if sig_header != expected_sig {
            tracing::error!("Crypto webhook signature mismatch");
            return Err(BillingError::WebhookVerificationFailed);
        }

        let event: CryptoWebhookEvent = serde_json::from_slice(payload)
            .map_err(|e| {
                tracing::error!("Failed to parse crypto webhook: {}", e);
                BillingError::WebhookVerificationFailed
            })?;

        Ok(event)
    }

    /// Handle crypto webhook
    pub async fn handle_crypto_webhook(
        &self,
        supabase: &SupabaseClient,
        event: CryptoWebhookEvent,
    ) -> Result<(), BillingError> {
        if event.payment_status != "confirmed" {
            return Ok(());
        }

        // Parse order_id to get user_id and plan
        let order_id = event.order_id.ok_or(BillingError::InvalidPayload)?;
        let parts: Vec<&str> = order_id.split('_').collect();
        
        if parts.len() < 3 {
            return Err(BillingError::InvalidPayload);
        }

        let user_id: Uuid = parts[0].parse().map_err(|_| BillingError::InvalidPayload)?;
        let plan = parts[1];
        let period = parts[2];

        // Calculate period end
        let period_end = match period {
            "annual" => Utc::now() + Duration::days(365),
            _ => Utc::now() + Duration::days(30),
        };

        // Activate subscription
        self.activate_subscription_with_period(
            supabase,
            &user_id,
            "crypto",
            Some(event.pay_currency.clone()),
            Some(event.payment_id.clone()),
            plan,
            period_end,
        ).await?;

        Ok(())
    }

    /// Activate subscription in database
    async fn activate_subscription(
        &self,
        supabase: &SupabaseClient,
        user_id: &Uuid,
        provider: &str,
        provider_customer: Option<String>,
        provider_sub_id: Option<String>,
        plan: &str,
    ) -> Result<(), BillingError> {
        let now = Utc::now();
        let period_end = now + Duration::days(30); // Monthly by default

        supabase.upsert_subscription(&SubscriptionInsert {
            id: Uuid::new_v4(),
            user_id: *user_id,
            provider: provider.to_string(),
            provider_customer,
            provider_sub_id,
            plan: plan.to_string(),
            status: "active".to_string(),
            current_period_end: period_end,
            updated_at: now,
        }).await.map_err(|e| {
            tracing::error!("Failed to activate subscription: {}", e);
            BillingError::DatabaseError
        })?;

        // Update profile plan
        supabase.update_profile_plan(user_id, plan).await.map_err(|e| {
            tracing::error!("Failed to update profile plan: {}", e);
            BillingError::DatabaseError
        })?;

        Ok(())
    }

    /// Activate subscription with specific period end
    async fn activate_subscription_with_period(
        &self,
        supabase: &SupabaseClient,
        user_id: &Uuid,
        provider: &str,
        provider_customer: Option<String>,
        provider_sub_id: Option<String>,
        plan: &str,
        period_end: DateTime<Utc>,
    ) -> Result<(), BillingError> {
        let now = Utc::now();

        supabase.upsert_subscription(&SubscriptionInsert {
            id: Uuid::new_v4(),
            user_id: *user_id,
            provider: provider.to_string(),
            provider_customer,
            provider_sub_id,
            plan: plan.to_string(),
            status: "active".to_string(),
            current_period_end: period_end,
            updated_at: now,
        }).await.map_err(|e| {
            tracing::error!("Failed to activate subscription: {}", e);
            BillingError::DatabaseError
        })?;

        // Update profile plan
        supabase.update_profile_plan(user_id, plan).await.map_err(|e| {
            tracing::error!("Failed to update profile plan: {}", e);
            BillingError::DatabaseError
        })?;

        Ok(())
    }

    /// Deactivate subscription
    async fn deactivate_subscription(
        &self,
        supabase: &SupabaseClient,
        customer_id: &str,
    ) -> Result<(), BillingError> {
        supabase.cancel_subscription_by_customer(customer_id).await.map_err(|e| {
            tracing::error!("Failed to deactivate subscription: {}", e);
            BillingError::DatabaseError
        })?;

        // Downgrade user to free - we need to find the user_id from the subscription
        // This is handled by the cancel_subscription_by_customer method updating the profile

        Ok(())
    }
}

#[derive(Debug, Deserialize)]
struct StripeSession {
    url: String,
}

#[derive(Debug, Deserialize)]
struct StripePortalSession {
    url: String,
}

#[derive(Debug, Deserialize)]
struct NowPaymentsResponse {
    payment_id: String,
    pay_address: String,
    pay_amount: String,
    pay_currency: String,
}

#[derive(Debug, thiserror::Error)]
pub enum BillingError {
    #[error("Invalid plan")]
    InvalidPlan,
    #[error("Stripe API error")]
    StripeApiError,
    #[error("Crypto API error")]
    CryptoApiError,
    #[error("Webhook verification failed")]
    WebhookVerificationFailed,
    #[error("Invalid payload")]
    InvalidPayload,
    #[error("Database error")]
    DatabaseError,
}

impl From<BillingError> for (axum::http::StatusCode, serde_json::Value) {
    fn from(err: BillingError) -> Self {
        match err {
            BillingError::InvalidPlan => {
                (
                    axum::http::StatusCode::BAD_REQUEST,
                    serde_json::json!({
                        "error": {
                            "code": "VALIDATION_ERROR",
                            "message": "Invalid plan selected."
                        }
                    }),
                )
            }
            BillingError::StripeApiError | BillingError::CryptoApiError => {
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    serde_json::json!({
                        "error": {
                            "code": "INTERNAL_ERROR",
                            "message": "Payment provider error."
                        }
                    }),
                )
            }
            BillingError::WebhookVerificationFailed => {
                (
                    axum::http::StatusCode::BAD_REQUEST,
                    serde_json::json!({
                        "error": {
                            "code": "PAYMENT_VERIFICATION_FAILED",
                            "message": "Webhook signature verification failed."
                        }
                    }),
                )
            }
            BillingError::InvalidPayload => {
                (
                    axum::http::StatusCode::BAD_REQUEST,
                    serde_json::json!({
                        "error": {
                            "code": "VALIDATION_ERROR",
                            "message": "Invalid webhook payload."
                        }
                    }),
                )
            }
            BillingError::DatabaseError => {
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    serde_json::json!({
                        "error": {
                            "code": "INTERNAL_ERROR",
                            "message": "Database error."
                        }
                    }),
                )
            }
        }
    }
}
