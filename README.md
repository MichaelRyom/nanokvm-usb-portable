# NanoKVM-USB-Portable

A single-binary portable application for the [NanoKVM-USB](https://github.com/sipeed/NanoKVM-USB) hardware KVM device. Run it, and it opens a Chromium window — no web server setup, no Electron app, no installation required.

## What is this?

This project wraps the [NanoKVM-USB browser UI](https://github.com/sipeed/NanoKVM-USB/tree/main/browser) into a self-contained Rust binary. It embeds the built frontend assets, serves them on `localhost:8080`, and auto-launches a Chromium-based browser in app mode.

The browser UI has been extended with several features not present in the upstream project:

- **Customizable menu system** — reorder, hide, and promote submenu items to the top-level menu
- **Screenshot capture** — save the current video frame
- **Paste with preview dialog** — confirm before sending clipboard text to the target
- **Login helper** — quickly type credentials with modifier key support for Windows login screens
- **Target keyboard layout selection** — match the keyboard layout of the remote machine
- **Adjustable paste speed** — control typing delay for paste operations
- **Toggleable tooltips** — show/hide menu tooltips

## Requirements

- A **NanoKVM-USB** device connected via USB 3.0
- A **Chromium-based browser** (Chrome, Edge, or Chromium) — required for WebSerial support
- **Rust** toolchain (for building from source)
- **Node.js** (for building the browser frontend)

## Building

```bash
# Build the browser frontend
cd browser
npm install
npm run build
cd ..

# Build the portable binary
cd portable
cargo build --release
```

The binary will be at `portable/target/release/nanokvm-usb-portable`.

## Usage

```bash
./nanokvm-usb-portable
```

This will:
1. Start a local web server on `http://localhost:8080`
2. Auto-launch Chrome/Edge/Chromium in app mode
3. If no Chromium-based browser is found, it prints the URL for you to open manually

Press `Ctrl+C` to stop.

> **Linux note:** If you get a serial port permission error, add yourself to the `dialout` group:
> ```bash
> sudo usermod -a -G dialout $USER
> ```
> Then log out and back in.

## Project Structure

```
browser/    # NanoKVM-USB browser UI (modified from upstream)
portable/   # Rust binary that embeds and serves the browser build
```

## Upstream

This project is based on [sipeed/NanoKVM-USB](https://github.com/sipeed/NanoKVM-USB). See that repository for hardware documentation, technical specifications, and purchasing information.

## License

GPL-3.0 — same as the upstream project.
