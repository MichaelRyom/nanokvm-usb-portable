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

/// Try to launch a Chromium-based browser for WebSerial support
/// When app_mode is true, opens in a minimal window without browser UI (no extensions).
/// When false, opens as a normal tab with full browser chrome (extensions available).
fn open_chromium(url: &str, app_mode: bool) -> bool {
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
        let mut cmd = Command::new(browser);
        if app_mode {
            cmd.arg(format!("--app={}", url));
        } else {
            cmd.arg(url);
        }
        cmd.arg("--new-window");

        if cmd.spawn().is_ok() {
            return true;
        }
    }

    false
}

/// Linux-only: check for common serial port issues and exit with guidance if found.
#[cfg(target_os = "linux")]
fn check_linux_serial_setup() {
    let mut issues = Vec::new();

    // Check if user is in the dialout group (runtime groups first, then /etc/group fallback)
    let in_dialout_runtime = Command::new("id")
        .arg("-nG")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("dialout"))
        .unwrap_or(false);

    let in_dialout_configured = if !in_dialout_runtime {
        // Fallback: check /etc/group directly in case session hasn't picked up the change
        let username = std::env::var("USER").unwrap_or_default();
        std::fs::read_to_string("/etc/group")
            .unwrap_or_default()
            .lines()
            .any(|line| {
                line.starts_with("dialout:")
                    && line.split(':').nth(3).map_or(false, |members| {
                        members.split(',').any(|m| m == username)
                    })
            })
    } else {
        false
    };

    if !in_dialout_runtime && !in_dialout_configured {
        issues.push((
            "Your user is not in the 'dialout' group (required for serial port access).",
            "  Fix: sudo usermod -a -G dialout $USER\n  Then log out and back in.",
        ));
    } else if !in_dialout_runtime && in_dialout_configured {
        eprintln!("Note: You are in the 'dialout' group but your session may not reflect it yet.");
        eprintln!("      If serial port access fails, try logging out and back in.\n");
    }

    // Check if brltty is active and will grab the CH340 serial chip
    let brltty_active = Command::new("systemctl")
        .args(["is-active", "--quiet", "brltty-udev.service"])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    if brltty_active {
        issues.push((
            "brltty is running and will grab the NanoKVM's CH340 serial chip.",
            r#"  Fix (option A - disable brltty, recommended):
    sudo systemctl stop brltty-udev.service
    sudo systemctl mask brltty-udev.service
    sudo systemctl mask brltty.path

  Fix (option B - remove brltty entirely):
    sudo apt remove brltty

  Then unplug and replug the NanoKVM."#,
        ));
    }

    if !issues.is_empty() {
        eprintln!("\n========================================");
        eprintln!("  NanoKVM-USB: Linux setup issues found");
        eprintln!("========================================\n");
        for (problem, fix) in &issues {
            eprintln!("Problem: {}", problem);
            eprintln!("{}", fix);
            eprintln!();
        }
        eprintln!("Fix the above and re-run. Exiting.");
        std::process::exit(1);
    }
}

fn print_help() {
    println!("NanoKVM-USB-Portable");
    println!();
    println!("Usage: nanokvm-usb-portable [OPTIONS]");
    println!();
    println!("Options:");
    println!("  --no-browser   Start server only, don't launch a browser");
    println!("  --browser      Open as a normal browser tab (enables extensions)");
    println!("                 Default is app mode (clean window, no extensions)");
    println!("  --help         Show this help message");
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.iter().any(|a| a == "--help" || a == "-h") {
        print_help();
        return;
    }

    let no_browser = args.iter().any(|a| a == "--no-browser");
    let tab_mode = args.iter().any(|a| a == "--browser");

    #[cfg(target_os = "linux")]
    check_linux_serial_setup();

    let app = Router::new().fallback(get(serve_asset));

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    let url = "http://localhost:8080";

    println!("NanoKVM-USB-Portable running at {}", url);
    println!("Press Ctrl+C to stop");

    if no_browser {
        println!("Browser launch skipped (--no-browser)");
    } else {
        let app_mode = !tab_mode;
        if !open_chromium(url, app_mode) {
            eprintln!("Warning: Could not find Chrome/Edge/Chromium.");
            eprintln!("WebSerial requires a Chromium-based browser.");
            eprintln!("Please open {} in Chrome or Edge manually.", url);
        }
    }

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
