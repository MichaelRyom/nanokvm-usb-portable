#!/usr/bin/env bash
set -euo pipefail

VERSION=$(grep '^version' portable/Cargo.toml | head -1 | sed 's/.*"\(.*\)"/\1/')
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BROWSER_DIR="$SCRIPT_DIR/browser"
PORTABLE_DIR="$SCRIPT_DIR/portable"
OUTPUT_DIR="$SCRIPT_DIR/dist"

echo "=== NanoKVM-USB-Portable v${VERSION} Build ==="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required. Install it first."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Error: npm is required. Install it first."; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "Error: Rust/Cargo is required. Install via https://rustup.rs"; exit 1; }

# --- Build browser frontend ---
echo ""
echo "--- Building browser frontend ---"
(cd "$BROWSER_DIR" && npm install && npm run build)

if [ ! -d "$BROWSER_DIR/dist" ]; then
    echo "Error: Browser build failed - dist/ not found"
    exit 1
fi

# --- Security audits ---
echo ""
echo "--- Security audit: npm packages ---"
(cd "$BROWSER_DIR" && npm audit 2>&1) || true
echo ""
echo "--- Security audit: Rust crates ---"
if command -v cargo-audit >/dev/null 2>&1; then
    (cd "$PORTABLE_DIR" && cargo audit 2>&1) || true
else
    echo "Skipping: cargo-audit not installed (install with: cargo install cargo-audit)"
fi
echo ""

# --- Prepare output directory ---
VERSION_DIR="$OUTPUT_DIR/v${VERSION}"
mkdir -p "$VERSION_DIR"

# --- Build Linux binary ---
echo ""
echo "--- Building Linux (x86_64) ---"
(cd "$PORTABLE_DIR" && cargo build --release --target x86_64-unknown-linux-gnu)
cp "$PORTABLE_DIR/target/x86_64-unknown-linux-gnu/release/nanokvm-usb-portable" \
   "$VERSION_DIR/nanokvm-usb-portable-v${VERSION}-linux-x86_64"

# --- Build Windows binary ---
echo ""
echo "--- Building Windows (x86_64) ---"

# Check for Windows cross-compilation toolchain
if ! rustup target list --installed | grep -q x86_64-pc-windows-gnu; then
    echo "Adding Windows target..."
    rustup target add x86_64-pc-windows-gnu
fi

if ! command -v x86_64-w64-mingw32-gcc >/dev/null 2>&1; then
    echo "Error: mingw-w64 is required for Windows cross-compilation."
    echo "Install it with: sudo apt install gcc-mingw-w64-x86-64"
    exit 1
fi

(cd "$PORTABLE_DIR" && cargo build --release --target x86_64-pc-windows-gnu)
cp "$PORTABLE_DIR/target/x86_64-pc-windows-gnu/release/nanokvm-usb-portable.exe" \
   "$VERSION_DIR/nanokvm-usb-portable-v${VERSION}-windows-x86_64.exe"

# --- Update latest symlink ---
rm -f "$OUTPUT_DIR/latest"
ln -s "v${VERSION}" "$OUTPUT_DIR/latest"

# --- Summary ---
echo ""
echo "=== Build complete ==="
echo "Output in dist/v${VERSION}/:"
ls -lh "$VERSION_DIR"
echo ""
echo "latest -> v${VERSION}"
