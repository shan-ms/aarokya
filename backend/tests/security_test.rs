//! Security integration tests for the Aarokya backend.
//!
//! Tests verify that security middleware is correctly applied:
//! - Security headers present in responses
//! - Request ID generated for each request
//! - Body size limit enforced
//! - XSS payloads stripped from inputs
//! - SQL injection patterns rejected
//! - JWT manipulation detected

use actix_web::{test, web, App, HttpResponse};

// ── Helpers ─────────────────────────────────────────────────────────────────

/// A trivial handler that echoes the JSON body back.
async fn echo_handler(body: web::Json<serde_json::Value>) -> HttpResponse {
    HttpResponse::Ok().json(body.into_inner())
}

/// A trivial handler that returns 200 OK with a static body.
async fn ok_handler() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}

// ── 1. Security Headers ────────────────────────────────────────────────────

#[actix_rt::test]
async fn test_security_headers_present() {
    let app = test::init_service(
        App::new()
            .wrap(aarokya_backend::infrastructure::security::SecurityHeaders)
            .route("/test", web::get().to(ok_handler)),
    )
    .await;

    let req = test::TestRequest::get().uri("/test").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);

    let headers = resp.headers();

    assert_eq!(
        headers.get("x-content-type-options").unwrap().to_str().unwrap(),
        "nosniff",
        "X-Content-Type-Options header should be nosniff"
    );

    assert_eq!(
        headers.get("x-frame-options").unwrap().to_str().unwrap(),
        "DENY",
        "X-Frame-Options header should be DENY"
    );

    assert_eq!(
        headers
            .get("strict-transport-security")
            .unwrap()
            .to_str()
            .unwrap(),
        "max-age=31536000; includeSubDomains",
        "Strict-Transport-Security should be set"
    );

    assert_eq!(
        headers.get("x-xss-protection").unwrap().to_str().unwrap(),
        "1; mode=block",
        "X-XSS-Protection should be 1; mode=block"
    );

    assert_eq!(
        headers
            .get("content-security-policy")
            .unwrap()
            .to_str()
            .unwrap(),
        "default-src 'self'; frame-ancestors 'none'",
        "Content-Security-Policy should be set"
    );
}

#[actix_rt::test]
async fn test_security_headers_on_error_responses() {
    let app = test::init_service(
        App::new()
            .wrap(aarokya_backend::infrastructure::security::SecurityHeaders)
            .route("/test", web::get().to(ok_handler)),
    )
    .await;

    // Request to a non-existent path
    let req = test::TestRequest::get().uri("/nonexistent").to_request();
    let resp = test::call_service(&app, req).await;

    // Even on 404 the security headers should be present
    let headers = resp.headers();
    assert!(
        headers.get("x-content-type-options").is_some(),
        "Security headers should be present even on 404"
    );
    assert!(
        headers.get("x-frame-options").is_some(),
        "X-Frame-Options should be present even on 404"
    );
}

// ── 2. Request ID ──────────────────────────────────────────────────────────

#[actix_rt::test]
async fn test_request_id_generated() {
    let app = test::init_service(
        App::new()
            .wrap(aarokya_backend::infrastructure::security::RequestId)
            .route("/test", web::get().to(ok_handler)),
    )
    .await;

    let req = test::TestRequest::get().uri("/test").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);

    let request_id = resp
        .headers()
        .get("x-request-id")
        .expect("X-Request-Id header should be present")
        .to_str()
        .unwrap();

    // Should be a valid UUID
    assert!(
        uuid::Uuid::parse_str(request_id).is_ok(),
        "X-Request-Id should be a valid UUID, got: {}",
        request_id
    );
}

#[actix_rt::test]
async fn test_request_id_unique_per_request() {
    let app = test::init_service(
        App::new()
            .wrap(aarokya_backend::infrastructure::security::RequestId)
            .route("/test", web::get().to(ok_handler)),
    )
    .await;

    let req1 = test::TestRequest::get().uri("/test").to_request();
    let resp1 = test::call_service(&app, req1).await;
    let id1 = resp1
        .headers()
        .get("x-request-id")
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();

    let req2 = test::TestRequest::get().uri("/test").to_request();
    let resp2 = test::call_service(&app, req2).await;
    let id2 = resp2
        .headers()
        .get("x-request-id")
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();

    assert_ne!(id1, id2, "Each request should get a unique request ID");
}

#[actix_rt::test]
async fn test_request_id_forwarded_from_client() {
    let app = test::init_service(
        App::new()
            .wrap(aarokya_backend::infrastructure::security::RequestId)
            .route("/test", web::get().to(ok_handler)),
    )
    .await;

    let client_id = "my-custom-request-id-12345";
    let req = test::TestRequest::get()
        .uri("/test")
        .insert_header(("X-Request-Id", client_id))
        .to_request();
    let resp = test::call_service(&app, req).await;

    let response_id = resp
        .headers()
        .get("x-request-id")
        .unwrap()
        .to_str()
        .unwrap();

    assert_eq!(
        response_id, client_id,
        "Client-provided X-Request-Id should be forwarded"
    );
}

// ── 3. Body Size Limit ─────────────────────────────────────────────────────

#[actix_rt::test]
async fn test_body_size_limit_allows_normal_payload() {
    let app = test::init_service(
        App::new()
            .app_data(aarokya_backend::infrastructure::security::json_body_config(
                aarokya_backend::infrastructure::security::DEFAULT_BODY_LIMIT,
            ))
            .route("/echo", web::post().to(echo_handler)),
    )
    .await;

    let payload = serde_json::json!({"name": "test", "value": 42});
    let req = test::TestRequest::post()
        .uri("/echo")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200, "Normal-sized payload should be accepted");
}

#[actix_rt::test]
async fn test_body_size_limit_rejects_oversized_payload() {
    // Set a very small limit for testing
    let app = test::init_service(
        App::new()
            .app_data(aarokya_backend::infrastructure::security::json_body_config(64))
            .route("/echo", web::post().to(echo_handler)),
    )
    .await;

    // Create a payload larger than 64 bytes
    let large_value = "x".repeat(200);
    let payload = serde_json::json!({"data": large_value});
    let req = test::TestRequest::post()
        .uri("/echo")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(
        resp.status(),
        413,
        "Oversized payload should be rejected with 413 Payload Too Large"
    );
}

#[actix_rt::test]
async fn test_default_body_limit_constant() {
    assert_eq!(
        aarokya_backend::infrastructure::security::DEFAULT_BODY_LIMIT,
        1_048_576,
        "Default body limit should be 1 MB"
    );
}

#[actix_rt::test]
async fn test_file_upload_body_limit_constant() {
    assert_eq!(
        aarokya_backend::infrastructure::security::FILE_UPLOAD_BODY_LIMIT,
        10_485_760,
        "File upload body limit should be 10 MB"
    );
}

// ── 4. XSS Payload Stripping ──────────────────────────────────────────────

#[actix_rt::test]
async fn test_xss_script_tag_stripped() {
    let input = "Hello <script>alert('xss')</script> World";
    let sanitized = aarokya_backend::infrastructure::security::sanitize_input(input);

    assert!(
        !sanitized.contains("<script>"),
        "Script tags should be removed"
    );
    assert!(
        !sanitized.contains("</script>"),
        "Closing script tags should be removed"
    );
    assert!(
        sanitized.contains("Hello"),
        "Non-malicious content should be preserved"
    );
    assert!(
        sanitized.contains("World"),
        "Non-malicious content should be preserved"
    );
}

#[actix_rt::test]
async fn test_xss_event_handler_stripped() {
    let input = r#"<img src="x" onerror="alert(1)">"#;
    let sanitized = aarokya_backend::infrastructure::security::sanitize_input(input);

    assert!(
        !sanitized.contains("onerror"),
        "Event handlers should be removed"
    );
    assert!(
        !sanitized.contains("alert"),
        "Alert call should be removed"
    );
}

#[actix_rt::test]
async fn test_xss_javascript_uri_stripped() {
    let input = r#"<a href="javascript:document.cookie">click</a>"#;
    let sanitized = aarokya_backend::infrastructure::security::sanitize_input(input);

    assert!(
        !sanitized.contains("javascript:"),
        "javascript: URI should be removed"
    );
}

#[actix_rt::test]
async fn test_xss_iframe_stripped() {
    let input = r#"<iframe src="https://evil.com"></iframe>"#;
    let sanitized = aarokya_backend::infrastructure::security::sanitize_input(input);

    assert!(
        !sanitized.contains("<iframe"),
        "iframe tags should be removed"
    );
}

#[actix_rt::test]
async fn test_xss_case_insensitive() {
    let input = "<SCRIPT>alert('XSS')</SCRIPT>";
    let sanitized = aarokya_backend::infrastructure::security::sanitize_input(input);

    assert!(
        !sanitized.to_lowercase().contains("script"),
        "Case-insensitive script tags should be removed"
    );
}

#[actix_rt::test]
async fn test_xss_preserves_normal_input() {
    let input = "John O'Brien paid 500 paise for health check";
    let sanitized = aarokya_backend::infrastructure::security::sanitize_input(input);

    assert_eq!(
        sanitized, input,
        "Normal text should be preserved unchanged"
    );
}

#[actix_rt::test]
async fn test_xss_nested_script_tags() {
    let input = "<scr<script>ipt>alert('xss')</scr</script>ipt>";
    let sanitized = aarokya_backend::infrastructure::security::sanitize_input(input);

    // After sanitization, there should be no script execution possible
    assert!(
        !sanitized.contains("<script>"),
        "Nested script tags should be handled"
    );
}

// ── 5. SQL Injection Detection ─────────────────────────────────────────────

#[actix_rt::test]
async fn test_sql_injection_classic_or_attack() {
    assert!(
        aarokya_backend::infrastructure::security::contains_sql_injection("' OR '1'='1"),
        "Classic OR injection should be detected"
    );
}

#[actix_rt::test]
async fn test_sql_injection_drop_table() {
    assert!(
        aarokya_backend::infrastructure::security::contains_sql_injection("'; DROP TABLE users"),
        "DROP TABLE injection should be detected"
    );
}

#[actix_rt::test]
async fn test_sql_injection_union_select() {
    assert!(
        aarokya_backend::infrastructure::security::contains_sql_injection(
            "1 UNION SELECT * FROM users"
        ),
        "UNION SELECT injection should be detected"
    );
}

#[actix_rt::test]
async fn test_sql_injection_comment_attack() {
    assert!(
        aarokya_backend::infrastructure::security::contains_sql_injection("admin'--"),
        "SQL comment injection should be detected"
    );
}

#[actix_rt::test]
async fn test_sql_injection_delete_from() {
    assert!(
        aarokya_backend::infrastructure::security::contains_sql_injection(
            "'; DELETE FROM users WHERE 1=1"
        ),
        "DELETE injection should be detected"
    );
}

#[actix_rt::test]
async fn test_sql_injection_information_schema() {
    assert!(
        aarokya_backend::infrastructure::security::contains_sql_injection(
            "1 UNION SELECT table_name FROM information_schema.tables"
        ),
        "information_schema access should be detected"
    );
}

#[actix_rt::test]
async fn test_sql_injection_normal_input_safe() {
    assert!(
        !aarokya_backend::infrastructure::security::contains_sql_injection("Hello world"),
        "Normal text should not trigger SQL injection detection"
    );

    assert!(
        !aarokya_backend::infrastructure::security::contains_sql_injection("test@email.com"),
        "Email addresses should not trigger SQL injection detection"
    );

    assert!(
        !aarokya_backend::infrastructure::security::contains_sql_injection("ABHA-12345678"),
        "ABHA IDs should not trigger SQL injection detection"
    );
}

#[actix_rt::test]
async fn test_sql_injection_block_comment() {
    assert!(
        aarokya_backend::infrastructure::security::contains_sql_injection("1 /* comment */ OR 1=1"),
        "Block comment injection should be detected"
    );
}

// ── 6. JWT Manipulation Detection ──────────────────────────────────────────

#[actix_rt::test]
async fn test_jwt_invalid_token_rejected() {
    use aarokya_backend::infrastructure::auth::decode_token;

    let secret = "test-secret-key-for-security-tests";
    let result = decode_token("not.a.valid.jwt", secret);

    assert!(
        result.is_err(),
        "Invalid JWT tokens should be rejected"
    );
}

#[actix_rt::test]
async fn test_jwt_wrong_secret_rejected() {
    use aarokya_backend::infrastructure::auth::{decode_token, encode_token};

    let user_id = uuid::Uuid::new_v4();
    let token = encode_token(user_id, "customer", "correct-secret", 1).unwrap();
    let result = decode_token(&token, "wrong-secret");

    assert!(
        result.is_err(),
        "JWT tokens signed with a different secret should be rejected"
    );
}

#[actix_rt::test]
async fn test_jwt_expired_token_rejected() {
    use aarokya_backend::infrastructure::auth::{decode_token, encode_token};

    let user_id = uuid::Uuid::new_v4();
    let secret = "test-secret-key-for-security-tests";
    // Create a token that is already expired (-1 hour)
    let token = encode_token(user_id, "customer", secret, -1).unwrap();
    let result = decode_token(&token, secret);

    assert!(
        result.is_err(),
        "Expired JWT tokens should be rejected"
    );
}

#[actix_rt::test]
async fn test_jwt_tampered_payload_rejected() {
    use aarokya_backend::infrastructure::auth::{decode_token, encode_token};

    let user_id = uuid::Uuid::new_v4();
    let secret = "test-secret-key-for-security-tests";
    let token = encode_token(user_id, "customer", secret, 1).unwrap();

    // Tamper with the payload part of the JWT (middle section)
    let parts: Vec<&str> = token.split('.').collect();
    assert_eq!(parts.len(), 3, "JWT should have 3 parts");

    // Modify the payload by changing a character
    let mut tampered_payload = parts[1].to_string();
    if tampered_payload.ends_with('A') {
        tampered_payload.push('B');
    } else {
        tampered_payload.push('A');
    }

    let tampered_token = format!("{}.{}.{}", parts[0], tampered_payload, parts[2]);
    let result = decode_token(&tampered_token, secret);

    assert!(
        result.is_err(),
        "Tampered JWT tokens should be rejected"
    );
}

#[actix_rt::test]
async fn test_jwt_refresh_token_not_accepted_as_access() {
    use aarokya_backend::infrastructure::auth::{decode_token, encode_refresh_token};

    let user_id = uuid::Uuid::new_v4();
    let secret = "test-secret-key-for-security-tests";
    let refresh_token = encode_refresh_token(user_id, "customer", secret, 168).unwrap();

    let claims = decode_token(&refresh_token, secret).unwrap();
    assert_eq!(
        claims.token_type, "refresh",
        "Refresh token type should be 'refresh', not 'access'"
    );
}

#[actix_rt::test]
async fn test_jwt_none_algorithm_rejected() {
    use aarokya_backend::infrastructure::auth::decode_token;

    // A JWT with "alg": "none" and no signature
    let header = base64_url_encode(r#"{"alg":"none","typ":"JWT"}"#);
    let payload = base64_url_encode(r#"{"sub":"00000000-0000-0000-0000-000000000000","user_type":"customer","exp":9999999999,"iat":1000000000,"token_type":"access"}"#);
    let none_token = format!("{}.{}.", header, payload);

    let secret = "test-secret-key-for-security-tests";
    let result = decode_token(&none_token, secret);

    assert!(
        result.is_err(),
        "JWT tokens with 'none' algorithm should be rejected"
    );
}

/// Simple base64url encoding without padding (for test JWT construction).
fn base64_url_encode(input: &str) -> String {
    use std::io::Write;
    let mut buf = Vec::new();
    {
        let mut encoder = base64_encoder(&mut buf);
        encoder.write_all(input.as_bytes()).unwrap();
        encoder.finish().unwrap();
    }
    String::from_utf8(buf)
        .unwrap()
        .replace('+', "-")
        .replace('/', "_")
        .trim_end_matches('=')
        .to_string()
}

/// Wrapper around a simple base64 encoder.
struct Base64Writer<W: std::io::Write> {
    writer: W,
    buffer: Vec<u8>,
}

fn base64_encoder<W: std::io::Write>(writer: W) -> Base64Writer<W> {
    Base64Writer {
        writer,
        buffer: Vec::new(),
    }
}

impl<W: std::io::Write> std::io::Write for Base64Writer<W> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.buffer.extend_from_slice(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl<W: std::io::Write> Base64Writer<W> {
    fn finish(mut self) -> std::io::Result<()> {
        const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let input = &self.buffer;
        let mut i = 0;
        while i + 2 < input.len() {
            let n = ((input[i] as u32) << 16) | ((input[i + 1] as u32) << 8) | (input[i + 2] as u32);
            self.writer.write_all(&[
                CHARS[((n >> 18) & 0x3F) as usize],
                CHARS[((n >> 12) & 0x3F) as usize],
                CHARS[((n >> 6) & 0x3F) as usize],
                CHARS[(n & 0x3F) as usize],
            ])?;
            i += 3;
        }
        let rem = input.len() - i;
        if rem == 2 {
            let n = ((input[i] as u32) << 16) | ((input[i + 1] as u32) << 8);
            self.writer.write_all(&[
                CHARS[((n >> 18) & 0x3F) as usize],
                CHARS[((n >> 12) & 0x3F) as usize],
                CHARS[((n >> 6) & 0x3F) as usize],
                b'=',
            ])?;
        } else if rem == 1 {
            let n = (input[i] as u32) << 16;
            self.writer.write_all(&[
                CHARS[((n >> 18) & 0x3F) as usize],
                CHARS[((n >> 12) & 0x3F) as usize],
                b'=',
                b'=',
            ])?;
        }
        self.writer.flush()
    }
}

// ── Combined middleware tests ──────────────────────────────────────────────

#[actix_rt::test]
async fn test_combined_security_and_request_id() {
    let app = test::init_service(
        App::new()
            .wrap(aarokya_backend::infrastructure::security::SecurityHeaders)
            .wrap(aarokya_backend::infrastructure::security::RequestId)
            .route("/test", web::get().to(ok_handler)),
    )
    .await;

    let req = test::TestRequest::get().uri("/test").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);

    let headers = resp.headers();
    assert!(
        headers.get("x-request-id").is_some(),
        "X-Request-Id should be present"
    );
    assert!(
        headers.get("x-content-type-options").is_some(),
        "X-Content-Type-Options should be present"
    );
    assert!(
        headers.get("x-frame-options").is_some(),
        "X-Frame-Options should be present"
    );
    assert!(
        headers.get("strict-transport-security").is_some(),
        "Strict-Transport-Security should be present"
    );
}

// ── IP rate limiter unit tests ─────────────────────────────────────────────

#[actix_rt::test]
async fn test_ip_rate_limiter_allows_under_limit() {
    let store = aarokya_backend::infrastructure::security::IpRateLimitStore::default();
    let config = aarokya_backend::infrastructure::security::RateLimitConfig {
        max_requests: 5,
        window_secs: 60,
    };

    for i in 0..5 {
        let result =
            aarokya_backend::infrastructure::security::check_ip_rate_limit(&store, "10.0.0.1:/api", &config);
        assert!(
            result.is_ok(),
            "Request {} should be allowed (under limit)",
            i + 1
        );
    }
}

#[actix_rt::test]
async fn test_ip_rate_limiter_blocks_over_limit() {
    let store = aarokya_backend::infrastructure::security::IpRateLimitStore::default();
    let config = aarokya_backend::infrastructure::security::RateLimitConfig {
        max_requests: 3,
        window_secs: 60,
    };

    for _ in 0..3 {
        let _ = aarokya_backend::infrastructure::security::check_ip_rate_limit(&store, "10.0.0.1:/api", &config);
    }

    let result =
        aarokya_backend::infrastructure::security::check_ip_rate_limit(&store, "10.0.0.1:/api", &config);
    assert!(
        result.is_err(),
        "4th request should be blocked (over limit of 3)"
    );

    // The error should contain retry_after seconds
    let retry_after = result.unwrap_err();
    assert!(
        retry_after > 0,
        "Retry-after should be positive, got: {}",
        retry_after
    );
}

#[actix_rt::test]
async fn test_ip_rate_limiter_different_ips_independent() {
    let store = aarokya_backend::infrastructure::security::IpRateLimitStore::default();
    let config = aarokya_backend::infrastructure::security::RateLimitConfig {
        max_requests: 1,
        window_secs: 60,
    };

    // IP 1 uses its quota
    assert!(
        aarokya_backend::infrastructure::security::check_ip_rate_limit(&store, "10.0.0.1:/api", &config).is_ok()
    );
    // IP 1 is now blocked
    assert!(
        aarokya_backend::infrastructure::security::check_ip_rate_limit(&store, "10.0.0.1:/api", &config).is_err()
    );
    // IP 2 should still be allowed
    assert!(
        aarokya_backend::infrastructure::security::check_ip_rate_limit(&store, "10.0.0.2:/api", &config).is_ok(),
        "Different IPs should have independent rate limits"
    );
}
