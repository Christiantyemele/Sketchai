use reqwest::Client;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct SupabaseClient {
    url: String,
    service_key: String,
    client: Client,
}

impl SupabaseClient {
    pub fn new(url: String, service_key: String) -> Self {
        Self {
            url,
            service_key,
            client: Client::new(),
        }
    }

    /// Get the base URL for REST API
    fn rest_url(&self) -> String {
        format!("{}/rest/v1", self.url)
    }

    /// Get the storage URL
    pub fn storage_url(&self) -> String {
        format!("{}/storage/v1", self.url)
    }

    /// Build authenticated request
    fn request(&self, method: reqwest::Method, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}/{}", self.rest_url(), path);
        self.client
            .request(method, url)
            .header("apikey", &self.service_key)
            .header("Authorization", format!("Bearer {}", self.service_key))
            .header("Content-Type", "application/json")
    }

    // ==================== PROFILES ====================

    /// Get user profile
    pub async fn get_profile(&self, user_id: &Uuid) -> Result<Option<Profile>, SupabaseError> {
        let response = self
            .request(reqwest::Method::GET, "profiles")
            .query(&[("id", &format!("eq.{}", user_id))])
            .header("Prefer", "return=representation")
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to get profile: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        let profiles: Vec<Profile> = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse profile response: {}", e);
            SupabaseError::ParseError
        })?;

        Ok(profiles.into_iter().next())
    }

    /// Create or update profile
    pub async fn upsert_profile(&self, user_id: &Uuid, plan: &str) -> Result<Profile, SupabaseError> {
        let now = chrono::Utc::now();
        let profile = ProfileUpsert {
            id: *user_id,
            plan: plan.to_string(),
            updated_at: now,
        };

        let response = self
            .request(reqwest::Method::POST, "profiles")
            .header("Prefer", "return=representation,resolution=merge-duplicates")
            .json(&profile)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to upsert profile: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        let profiles: Vec<Profile> = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse upsert response: {}", e);
            SupabaseError::ParseError
        })?;

        profiles.into_iter().next().ok_or(SupabaseError::NotFound)
    }

    /// Update profile plan
    pub async fn update_profile_plan(&self, user_id: &Uuid, plan: &str) -> Result<(), SupabaseError> {
        let now = chrono::Utc::now();
        let update = serde_json::json!({
            "plan": plan,
            "updated_at": now
        });

        let response = self
            .request(reqwest::Method::PATCH, "profiles")
            .query(&[("id", &format!("eq.{}", user_id))])
            .json(&update)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to update profile plan: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        Ok(())
    }

    // ==================== USAGE ====================

    /// Get usage for current month
    pub async fn get_usage(&self, user_id: &Uuid, month: &str) -> Result<Option<Usage>, SupabaseError> {
        let response = self
            .request(reqwest::Method::GET, "usage")
            .query(&[
                ("user_id", &format!("eq.{}", user_id)),
                ("month", &format!("eq.{}", month)),
            ])
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to get usage: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        let usage: Vec<Usage> = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse usage response: {}", e);
            SupabaseError::ParseError
        })?;

        Ok(usage.into_iter().next())
    }

    /// Increment usage count (upsert)
    pub async fn increment_usage(&self, user_id: &Uuid, month: &str) -> Result<i32, SupabaseError> {
        let now = chrono::Utc::now();
        
        // First, try to get current usage
        let current = self.get_usage(user_id, month).await?;
        
        let count = match current {
            Some(usage) => usage.count + 1,
            None => 1,
        };

        let usage_data = serde_json::json!({
            "id": Uuid::new_v4(),
            "user_id": user_id,
            "month": month,
            "count": count,
            "updated_at": now
        });

        let response = self
            .request(reqwest::Method::POST, "usage")
            .header("Prefer", "return=representation,resolution=merge-duplicates")
            .json(&usage_data)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to increment usage: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        Ok(count)
    }

    // ==================== DIAGRAMS ====================

    /// Save diagram
    pub async fn save_diagram(&self, diagram: &DiagramInsert) -> Result<Diagram, SupabaseError> {
        let response = self
            .request(reqwest::Method::POST, "diagrams")
            .header("Prefer", "return=representation")
            .json(diagram)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to save diagram: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        let diagrams: Vec<Diagram> = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse diagram response: {}", e);
            SupabaseError::ParseError
        })?;

        diagrams.into_iter().next().ok_or(SupabaseError::NotFound)
    }

    /// List diagrams for user
    pub async fn list_diagrams(
        &self,
        user_id: &Uuid,
        limit: i32,
        offset: i32,
        diagram_type: Option<&str>,
    ) -> Result<Vec<Diagram>, SupabaseError> {
        let mut request = self
            .request(reqwest::Method::GET, "diagrams")
            .query(&[
                ("user_id", &format!("eq.{}", user_id)),
                ("order", &"created_at.desc".to_string()),
                ("limit", &limit.to_string()),
                ("offset", &offset.to_string()),
            ]);

        if let Some(dtype) = diagram_type {
            request = request.query(&[("diagram_type", &format!("eq.{}", dtype))]);
        }

        let response = request.send().await.map_err(|e| {
            tracing::error!("Failed to list diagrams: {}", e);
            SupabaseError::RequestFailed
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        response.json().await.map_err(|e| {
            tracing::error!("Failed to parse diagrams response: {}", e);
            SupabaseError::ParseError
        })
    }

    /// Count diagrams for user
    pub async fn count_diagrams(&self, user_id: &Uuid, diagram_type: Option<&str>) -> Result<i64, SupabaseError> {
        let mut request = self
            .request(reqwest::Method::GET, "diagrams")
            .query(&[
                ("user_id", &format!("eq.{}", user_id)),
                ("select", &"id".to_string()),
            ]);

        if let Some(dtype) = diagram_type {
            request = request.query(&[("diagram_type", &format!("eq.{}", dtype))]);
        }

        // Get total count from content-range header
        let response = request
            .header("Prefer", "count=exact")
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to count diagrams: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        // Parse content-range header for total count
        let content_range = response.headers()
            .get("content-range")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("0-0/0");

        let total: i64 = content_range
            .split('/')
            .last()
            .unwrap_or("0")
            .parse()
            .unwrap_or(0);

        Ok(total)
    }

    /// Get single diagram
    pub async fn get_diagram(&self, diagram_id: &Uuid, user_id: &Uuid) -> Result<Option<Diagram>, SupabaseError> {
        let response = self
            .request(reqwest::Method::GET, "diagrams")
            .query(&[
                ("id", &format!("eq.{}", diagram_id)),
                ("user_id", &format!("eq.{}", user_id)),
            ])
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to get diagram: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        let diagrams: Vec<Diagram> = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse diagram response: {}", e);
            SupabaseError::ParseError
        })?;

        Ok(diagrams.into_iter().next())
    }

    /// Delete diagram
    pub async fn delete_diagram(&self, diagram_id: &Uuid, user_id: &Uuid) -> Result<bool, SupabaseError> {
        let response = self
            .request(reqwest::Method::DELETE, "diagrams")
            .query(&[
                ("id", &format!("eq.{}", diagram_id)),
                ("user_id", &format!("eq.{}", user_id)),
            ])
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to delete diagram: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        // Check if anything was deleted
        let body = response.text().await.unwrap_or_default();
        Ok(!body.is_empty())
    }

    // ==================== SUBSCRIPTIONS ====================

    /// Get subscription for user
    pub async fn get_subscription(&self, user_id: &Uuid) -> Result<Option<Subscription>, SupabaseError> {
        let response = self
            .request(reqwest::Method::GET, "subscriptions")
            .query(&[("user_id", &format!("eq.{}", user_id))])
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to get subscription: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        let subs: Vec<Subscription> = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse subscription response: {}", e);
            SupabaseError::ParseError
        })?;

        Ok(subs.into_iter().next())
    }

    /// Upsert subscription
    pub async fn upsert_subscription(&self, sub: &SubscriptionInsert) -> Result<Subscription, SupabaseError> {
        let response = self
            .request(reqwest::Method::POST, "subscriptions")
            .header("Prefer", "return=representation,resolution=merge-duplicates")
            .json(sub)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to upsert subscription: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        let subs: Vec<Subscription> = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse subscription response: {}", e);
            SupabaseError::ParseError
        })?;

        subs.into_iter().next().ok_or(SupabaseError::NotFound)
    }

    /// Cancel subscription by customer ID
    pub async fn cancel_subscription_by_customer(&self, customer_id: &str) -> Result<(), SupabaseError> {
        let now = chrono::Utc::now();
        let update = serde_json::json!({
            "status": "canceled",
            "updated_at": now
        });

        let response = self
            .request(reqwest::Method::PATCH, "subscriptions")
            .query(&[("provider_customer", &format!("eq.{}", customer_id))])
            .json(&update)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to cancel subscription: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        Ok(())
    }

    /// Get Stripe customer ID for user
    pub async fn get_stripe_customer(&self, user_id: &Uuid) -> Result<Option<String>, SupabaseError> {
        let response = self
            .request(reqwest::Method::GET, "subscriptions")
            .query(&[
                ("user_id", &format!("eq.{}", user_id)),
                ("provider", &"eq.stripe".to_string()),
                ("select", &"provider_customer".to_string()),
            ])
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to get Stripe customer: {}", e);
                SupabaseError::RequestFailed
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!("Supabase error: {} - {}", status, body);
            return Err(SupabaseError::ApiError(status.to_string()));
        }

        #[derive(Deserialize)]
        struct CustomerResult {
            provider_customer: Option<String>,
        }

        let results: Vec<CustomerResult> = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse customer response: {}", e);
            SupabaseError::ParseError
        })?;

        Ok(results.into_iter().next().and_then(|r| r.provider_customer))
    }
}

// ==================== MODELS ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: Uuid,
    pub plan: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
struct ProfileUpsert {
    id: Uuid,
    plan: String,
    updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub id: Uuid,
    pub user_id: Uuid,
    pub month: String,
    pub count: i32,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagram {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: Option<String>,
    pub prompt: String,
    pub diagram_type: String,
    pub canvas_json: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct DiagramInsert {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: Option<String>,
    pub prompt: String,
    pub diagram_type: String,
    pub canvas_json: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: Uuid,
    pub user_id: Uuid,
    pub provider: String,
    pub provider_customer: Option<String>,
    pub provider_sub_id: Option<String>,
    pub plan: String,
    pub status: String,
    pub current_period_end: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct SubscriptionInsert {
    pub id: Uuid,
    pub user_id: Uuid,
    pub provider: String,
    pub provider_customer: Option<String>,
    pub provider_sub_id: Option<String>,
    pub plan: String,
    pub status: String,
    pub current_period_end: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, thiserror::Error)]
pub enum SupabaseError {
    #[error("Request failed")]
    RequestFailed,
    #[error("API error: {0}")]
    ApiError(String),
    #[error("Parse error")]
    ParseError,
    #[error("Not found")]
    NotFound,
}
