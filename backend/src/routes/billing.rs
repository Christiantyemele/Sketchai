use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    middleware::auth::Auth,
    services::{
        billing::{
            BillingService, CryptoPaymentRequest, CryptoPaymentResponse,
            StripeCheckoutRequest, StripeCheckoutResponse,
            StripePortalRequest, StripePortalResponse,
        },
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
}

/// POST /billing/stripe/create-checkout - Create Stripe checkout session
pub async fn create_stripe_checkout(
    State(state): State<Arc<AppState>>,
    Auth(user): Auth,
    Json(body): Json<StripeCheckoutRequest>,
) -> Result<Json<ApiResponse<StripeCheckoutResponse>>, (StatusCode, Json<ApiError>)> {
    let user_id = Uuid::parse_str(&user.id).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Invalid user ID",
                },
            }),
        )
    })?;

    // Validate plan
    if body.plan != "pro" && body.plan != "team" {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ApiError {
                error: ErrorBody {
                    code: "VALIDATION_ERROR",
                    message: "Invalid plan. Must be 'pro' or 'team'.",
                },
            }),
        ));
    }

    let response = state.billing_service
        .create_stripe_checkout(
            &state.supabase,
            &user_id,
            &user.email,
            &body.plan,
            &body.success_url,
            &body.cancel_url,
        )
        .await
        .map_err(|e| {
            let (code, message) = match e {
                crate::services::billing::BillingError::InvalidPlan => {
                    ("VALIDATION_ERROR", "Invalid plan selected.")
                }
                _ => ("INTERNAL_ERROR", "Failed to create checkout session."),
            };
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError {
                    error: ErrorBody { code, message },
                }),
            )
        })?;

    Ok(Json(ApiResponse { data: response }))
}

/// POST /billing/stripe/portal - Create Stripe customer portal session
pub async fn create_stripe_portal(
    State(state): State<Arc<AppState>>,
    Auth(user): Auth,
    Json(body): Json<StripePortalRequest>,
) -> Result<Json<ApiResponse<StripePortalResponse>>, (StatusCode, Json<ApiError>)> {
    let user_id = Uuid::parse_str(&user.id).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Invalid user ID",
                },
            }),
        )
    })?;

    // Get customer ID
    let customer_id = state.supabase.get_stripe_customer(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get Stripe customer: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError {
                    error: ErrorBody {
                        code: "INTERNAL_ERROR",
                        message: "Failed to get customer info.",
                    },
                }),
            )
        })?;

    let customer_id = match customer_id {
        Some(id) => id,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ApiError {
                    error: ErrorBody {
                        code: "NOT_FOUND",
                        message: "No Stripe customer found for this user.",
                    },
                }),
            ));
        }
    };

    let response = state.billing_service
        .create_stripe_portal(&customer_id, &body.return_url)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError {
                    error: ErrorBody {
                        code: "INTERNAL_ERROR",
                        message: "Failed to create portal session.",
                    },
                }),
            )
        })?;

    Ok(Json(ApiResponse { data: response }))
}

/// POST /billing/stripe/webhook - Handle Stripe webhooks
pub async fn stripe_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: String,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let sig_header = headers
        .get("Stripe-Signature")
        .and_then(|h| h.to_str().ok())
        .ok_or((
            StatusCode::BAD_REQUEST,
            Json(ApiError {
                error: ErrorBody {
                    code: "PAYMENT_VERIFICATION_FAILED",
                    message: "Missing Stripe signature header.",
                },
            }),
        ))?;

    let event = state.billing_service
        .verify_stripe_webhook(body.as_bytes(), sig_header)
        .map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(ApiError {
                    error: ErrorBody {
                        code: "PAYMENT_VERIFICATION_FAILED",
                        message: "Webhook signature verification failed.",
                    },
                }),
            )
        })?;

    state.billing_service
        .handle_stripe_webhook(&state.supabase, event)
        .await
        .map_err(|e| {
            tracing::error!("Failed to process Stripe webhook: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError {
                    error: ErrorBody {
                        code: "INTERNAL_ERROR",
                        message: "Failed to process webhook.",
                    },
                }),
            )
        })?;

    Ok(StatusCode::OK)
}

/// POST /billing/crypto/create-payment - Create crypto payment
pub async fn create_crypto_payment(
    State(state): State<Arc<AppState>>,
    Auth(user): Auth,
    Json(body): Json<CryptoPaymentRequest>,
) -> Result<Json<ApiResponse<CryptoPaymentResponse>>, (StatusCode, Json<ApiError>)> {
    let user_id = Uuid::parse_str(&user.id).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: "Invalid user ID",
                },
            }),
        )
    })?;

    // Validate plan
    if body.plan != "pro" && body.plan != "team" {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ApiError {
                error: ErrorBody {
                    code: "VALIDATION_ERROR",
                    message: "Invalid plan. Must be 'pro' or 'team'.",
                },
            }),
        ));
    }

    // Validate currency
    let valid_currencies = ["btc", "eth", "usdc", "usdt", "bnb", "sol"];
    if !valid_currencies.contains(&body.currency.to_lowercase().as_str()) {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ApiError {
                error: ErrorBody {
                    code: "VALIDATION_ERROR",
                    message: "Invalid currency. Supported: btc, eth, usdc, usdt, bnb, sol.",
                },
            }),
        ));
    }

    // Validate period
    if body.period != "monthly" && body.period != "annual" {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ApiError {
                error: ErrorBody {
                    code: "VALIDATION_ERROR",
                    message: "Invalid period. Must be 'monthly' or 'annual'.",
                },
            }),
        ));
    }

    let response = state.billing_service
        .create_crypto_payment(&state.supabase, &user_id, &body.plan, &body.currency, &body.period)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create crypto payment: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError {
                    error: ErrorBody {
                        code: "INTERNAL_ERROR",
                        message: "Failed to create crypto payment.",
                    },
                }),
            )
        })?;

    Ok(Json(ApiResponse { data: response }))
}

/// POST /billing/crypto/webhook - Handle NOWPayments webhooks
pub async fn crypto_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: String,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let sig_header = headers
        .get("x-nowpayments-sig")
        .and_then(|h| h.to_str().ok())
        .ok_or((
            StatusCode::BAD_REQUEST,
            Json(ApiError {
                error: ErrorBody {
                    code: "PAYMENT_VERIFICATION_FAILED",
                    message: "Missing NOWPayments signature header.",
                },
            }),
        ))?;

    let event = state.billing_service
        .verify_crypto_webhook(body.as_bytes(), sig_header)
        .map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(ApiError {
                    error: ErrorBody {
                        code: "PAYMENT_VERIFICATION_FAILED",
                        message: "Webhook signature verification failed.",
                    },
                }),
            )
        })?;

    state.billing_service
        .handle_crypto_webhook(&state.supabase, event)
        .await
        .map_err(|e| {
            tracing::error!("Failed to process crypto webhook: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError {
                    error: ErrorBody {
                        code: "INTERNAL_ERROR",
                        message: "Failed to process webhook.",
                    },
                }),
            )
        })?;

    Ok(StatusCode::OK)
}
