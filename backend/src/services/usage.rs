use sqlx::PgPool;
use uuid::Uuid;
use chrono::{Utc, Datelike};

#[derive(Debug, Clone)]
pub struct UsageService {
    free_tier_limit: u32,
}

#[derive(Debug, Clone)]
pub struct UsageInfo {
    pub month: String,
    pub diagrams_generated: i32,
    pub limit: Option<i32>,
}

impl UsageService {
    pub fn new(free_tier_limit: u32) -> Self {
        Self { free_tier_limit }
    }

    /// Get the free tier limit
    pub fn free_tier_limit(&self) -> u32 {
        self.free_tier_limit
    }

    /// Get current month string in format "YYYY-MM"
    fn current_month() -> String {
        let now = Utc::now();
        format!("{}-{:02}", now.year(), now.month())
    }

    /// Check if user can generate a diagram (free tier enforcement)
    pub async fn can_generate(
        &self,
        db: &PgPool,
        user_id: &Uuid,
        plan: &str,
    ) -> Result<bool, UsageError> {
        // Pro and Team have unlimited access
        if plan == "pro" || plan == "team" {
            return Ok(true);
        }

        let month = Self::current_month();
        
        let count: Option<i32> = sqlx::query_scalar(
            "SELECT count FROM usage WHERE user_id = $1 AND month = $2"
        )
        .bind(user_id)
        .bind(&month)
        .fetch_optional(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check usage: {}", e);
            UsageError::DatabaseError
        })?;

        Ok(count.unwrap_or(0) < self.free_tier_limit as i32)
    }

    /// Increment usage count for the current month
    pub async fn increment(
        &self,
        db: &PgPool,
        user_id: &Uuid,
    ) -> Result<i32, UsageError> {
        let month = Self::current_month();
        let now = Utc::now();

        let count: i32 = sqlx::query_scalar(
            r#"
            INSERT INTO usage (id, user_id, month, count, updated_at)
            VALUES (gen_random_uuid(), $1, $2, 1, $3)
            ON CONFLICT (user_id, month)
            DO UPDATE SET 
                count = usage.count + 1,
                updated_at = $3
            RETURNING count
            "#
        )
        .bind(user_id)
        .bind(&month)
        .bind(now)
        .fetch_one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to increment usage: {}", e);
            UsageError::DatabaseError
        })?;

        Ok(count)
    }

    /// Get usage info for a user
    pub async fn get_usage(
        db: &PgPool,
        user_id: &Uuid,
        plan: &str,
        free_tier_limit: u32,
    ) -> Result<UsageInfo, UsageError> {
        let month = Self::current_month();
        
        let diagrams_generated: Option<i32> = sqlx::query_scalar(
            "SELECT count FROM usage WHERE user_id = $1 AND month = $2"
        )
        .bind(user_id)
        .bind(&month)
        .fetch_optional(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get usage: {}", e);
            UsageError::DatabaseError
        })?;

        let limit = if plan == "pro" || plan == "team" {
            None // Unlimited
        } else {
            Some(free_tier_limit as i32)
        };

        Ok(UsageInfo {
            month,
            diagrams_generated: diagrams_generated.unwrap_or(0),
            limit,
        })
    }

    /// Get user's plan from profiles table
    pub async fn get_user_plan(
        db: &PgPool,
        user_id: &Uuid,
    ) -> Result<String, UsageError> {
        let plan: Option<String> = sqlx::query_scalar(
            "SELECT plan FROM profiles WHERE id = $1"
        )
        .bind(user_id)
        .fetch_optional(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get user plan: {}", e);
            UsageError::DatabaseError
        })?;

        Ok(plan.unwrap_or_else(|| "free".to_string()))
    }

    /// Create or update user profile
    pub async fn ensure_profile(
        db: &PgPool,
        user_id: &Uuid,
        _email: &str,
    ) -> Result<(), UsageError> {
        let now = Utc::now();
        
        sqlx::query(
            r#"
            INSERT INTO profiles (id, plan, created_at, updated_at)
            VALUES ($1, 'free', $2, $2)
            ON CONFLICT (id) DO UPDATE SET updated_at = $2
            "#
        )
        .bind(user_id)
        .bind(now)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to ensure profile: {}", e);
            UsageError::DatabaseError
        })?;

        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum UsageError {
    #[error("Database error")]
    DatabaseError,
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
}
