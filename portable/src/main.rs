use axum::{
    body::Body,
    http::{header, Request, Response, StatusCode},
    routing::get,
    Router,
};
use rust_embed::Embed;
use std::net::SocketAddr;
use std::process::Command;

#[derive(Embed)]
#[folder = "../browser/dist/"]
struct Assets;

async fn serve_asset(req: Request<Body>) -> Response<Body> {
    let path = req.uri().path().trim_start_matches('/');

    // Default to index.html for root or empty path
    let path = if path.is_empty() { "index.html" } else { path };

    match Assets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime.as_ref())
                .body(Body::from(content.data.into_owned()))
                .unwrap()
        }
        None => {
            // SPA fallback: serve index.html for unknown routes
            match Assets::get("index.html") {
                Some(content) => Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, "text/html")
                    .body(Body::from(content.data.into_owned()))
                    .unwrap(),
                None => Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body(Body::from("Not Found"))
                    .unwrap(),
            }
        }
    }
}

/// Try to launch a Chromium-based browser in app mode for WebSerial support
fn open_chromium_app(url: &str) -> bool {
    #[cfg(target_os = "windows")]
    let browsers: &[&str] = &[
        "msedge",  // Edge is pre-installed on Windows 10/11
        "chrome",
        "chromium",
    ];

    #[cfg(target_os = "linux")]
    let browsers: &[&str] = &[
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "microsoft-edge",
    ];

    #[cfg(target_os = "macos")]
    let browsers: &[&str] = &[
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];

    for browser in browsers {
        let result = Command::new(browser)
            .arg(format!("--app={}", url))
            .arg("--new-window")
            .spawn();

        if result.is_ok() {
            return true;
        }
    }

    false
}

#[tokio::main]
async fn main() {
    let app = Router::new().fallback(get(serve_asset));

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    let url = "http://localhost:8080";

    println!("NanoKVM-USB-Portable running at {}", url);
    println!("Press Ctrl+C to stop");

    // Try Chromium-based browser in app mode first (required for WebSerial)
    if !open_chromium_app(url) {
        eprintln!("Warning: Could not find Chrome/Edge/Chromium.");
        eprintln!("WebSerial requires a Chromium-based browser.");
        eprintln!("Please open {} in Chrome or Edge manually.", url);
    }

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
