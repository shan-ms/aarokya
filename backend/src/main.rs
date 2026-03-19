use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use tracing_actix_web::TracingLogger;

mod api;
mod config;
mod domain;
mod infrastructure;

use infrastructure::security;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("aarokya_backend=info".parse().unwrap()),
        )
        .init();

    let config = config::AppConfig::from_env().expect("Failed to load config");
    let pool = infrastructure::database::create_pool(&config.database_url)
        .await
        .expect("Failed to create database pool");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    let bind_addr = format!("{}:{}", config.host, config.port);
    tracing::info!("Starting server at {}", bind_addr);

    let config_data = web::Data::new(config);
    let pool_data = web::Data::new(pool);
    let otp_store = web::Data::new(api::auth::OtpStore::default());
    let rate_limit_store = web::Data::new(api::auth::RateLimitStore::default());
    let ip_rate_limit_store = web::Data::new(security::IpRateLimitStore::default());

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(security::SecurityHeaders)
            .wrap(security::RequestId)
            .wrap(cors)
            .wrap(TracingLogger::default())
            .app_data(security::json_body_config(security::DEFAULT_BODY_LIMIT))
            .app_data(config_data.clone())
            .app_data(pool_data.clone())
            .app_data(otp_store.clone())
            .app_data(rate_limit_store.clone())
            .app_data(ip_rate_limit_store.clone())
            .service(api::health::health_check)
            .service(
                web::scope("/api/v1")
                    .service(
                        web::scope("/auth")
                            .route("/send-otp", web::post().to(api::auth::send_otp))
                            .route("/verify-otp", web::post().to(api::auth::verify_otp))
                            .route("/refresh", web::post().to(api::auth::refresh_token)),
                    )
                    .service(
                        web::scope("/hsa")
                            .route("", web::post().to(api::hsa::create_hsa))
                            .route("", web::get().to(api::hsa::get_hsa))
                            .route("/dashboard", web::get().to(api::hsa::get_dashboard)),
                    )
                    .service(
                        web::scope("/contributions")
                            .route("", web::post().to(api::contributions::create_contribution))
                            .route("", web::get().to(api::contributions::list_contributions))
                            .route(
                                "/summary",
                                web::get().to(api::contributions::contribution_summary),
                            ),
                    )
                    .service(
                        web::scope("/partners")
                            .route("/register", web::post().to(api::partners::register_partner))
                            .route("/me", web::get().to(api::partners::get_partner))
                            .route("/workers", web::post().to(api::partners::add_worker))
                            .route("/workers", web::get().to(api::partners::list_workers))
                            .route(
                                "/contributions/bulk",
                                web::post().to(api::partners::bulk_contribute),
                            )
                            .route("/dashboard", web::get().to(api::partners::partner_dashboard))
                            .route("/reports", web::get().to(api::partners::partner_reports)),
                    )
                    .service(
                        web::scope("/insurance")
                            .route("/plans", web::get().to(api::insurance::list_plans))
                            .route("/subscribe", web::post().to(api::insurance::subscribe))
                            .route("/policies", web::get().to(api::insurance::list_policies)),
                    )
                    .service(
                        web::scope("/claims")
                            .route("", web::post().to(api::insurance::submit_claim))
                            .route("", web::get().to(api::insurance::list_claims))
                            .route(
                                "/{id}/review",
                                web::patch().to(api::insurance::review_claim),
                            ),
                    )
                    .service(
                        web::scope("/consent")
                            .route("", web::post().to(api::consent::grant_consent))
                            .route("", web::get().to(api::consent::list_consents))
                            .route("/withdraw", web::post().to(api::consent::withdraw_consent))
                            .route("/export", web::get().to(api::consent::export_data))
                            .route("/delete-account", web::delete().to(api::consent::delete_account)),
                    )
                    .service(
                        web::scope("/checkin")
                            .route("", web::post().to(api::checkin::create_checkin))
                            .route("", web::get().to(api::checkin::list_checkins)),
                    )
                    .service(
                        web::scope("/documents")
                            .route("", web::post().to(api::documents::create_document))
                            .route("", web::get().to(api::documents::list_documents))
                            .route("/{id}", web::get().to(api::documents::get_document))
                            .route("/{id}", web::delete().to(api::documents::delete_document))
                            .route("/share", web::post().to(api::documents::share_document))
                            .route("/shared", web::get().to(api::documents::list_shared)),
                    )
                    .service(
                        web::scope("/family")
                            .route("", web::post().to(api::family::create_member))
                            .route("", web::get().to(api::family::list_members))
                            .route("/{id}", web::get().to(api::family::get_member))
                            .route("/{id}", web::put().to(api::family::update_member))
                            .route("/{id}", web::delete().to(api::family::delete_member)),
                    ),
            )
    })
    .bind(&bind_addr)?
    .run()
    .await
}
