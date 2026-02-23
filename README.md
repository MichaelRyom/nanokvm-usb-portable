# NanoKVM-USB-Portable

A single-binary portable application for the [NanoKVM-USB](https://github.com/sipeed/NanoKVM-USB) hardware KVM device. Run it, and it opens a Chromium window — no web server setup, no Electron app, no installation required.

## What is this?

This project wraps the [NanoKVM-USB browser UI](https://github.com/sipeed/NanoKVM-USB/tree/main/browser) into a self-contained Rust binary. It embeds the built frontend assets, serves them on `localhost:8080`, and auto-launches a Chromium-based browser in app mode.

The browser UI has been extended with several features not present in the upstream project:

- **Customizable menu system** — reorder, hide, and promote submenu items to the top-level menu
- **Screenshot capture** — save the current video frame
- **Paste with preview dialog** — confirm before sending clipboard text to the target
- **Login helper** — quickly type credentials with modifier key support for Windows login screens
- **Credential vault** — encrypted local password manager with TOTP support, import/export, and auto-lock
- **Target keyboard layout selection** — match the keyboard layout of the remote machine
- **Adjustable paste speed** — control typing delay for paste operations
- **Toggleable tooltips** — show/hide menu tooltips
- **Sharp rendering toggle** — pixel-perfect video scaling for crisp text (enabled by default)

## Requirements

- A **NanoKVM-USB** device connected via USB 3.0
- A **Chromium-based browser** (Chrome, Edge, or Chromium) — required for WebSerial support

## Building from Source

### Build Dependencies

- **Node.js** 20+ and **npm** — for the browser frontend
- **Rust** toolchain — install via [rustup.rs](https://rustup.rs)
- **mingw-w64** — for Windows cross-compilation from Linux:
  ```bash
  sudo apt install gcc-mingw-w64-x86-64
  ```
- **cargo-audit** (optional) — for security auditing of Rust crates:
  ```bash
  cargo install cargo-audit
  ```

### Build

The included `build.sh` script handles the full build pipeline: frontend compilation, security audits, and native binaries for both Linux and Windows.

```bash
./build.sh
```

This will:
1. Build the browser frontend (`npm install` + `npm run build`)
2. Run security audits (npm and cargo)
3. Compile release binaries for Linux and Windows (x86_64)
4. Place versioned output in `dist/v<version>/`

Output:
```
dist/v1.7.0/
  nanokvm-usb-portable-v1.7.0-linux-x86_64
  nanokvm-usb-portable-v1.7.0-windows-x86_64.exe
```

## Usage

```bash
./nanokvm-usb-portable
```

This will:
1. Start a local web server on `http://localhost:8080`
2. Auto-launch Chrome/Edge/Chromium in app mode
3. If no Chromium-based browser is found, it prints the URL for you to open manually

Press `Ctrl+C` to stop.

### Options

| Flag | Description |
|---|---|
| `--no-browser` | Start server only, don't launch a browser |
| `--browser` | Open as a normal browser tab (enables extensions) |
| `--debug` | Enable verbose debug logging in the browser console |
| `--help` | Show help message |

> **Linux notes:**
>
> If you get a serial port permission error, add yourself to the `dialout` group:
> ```bash
> sudo usermod -a -G dialout $USER
> ```
> Then log out and back in.
>
> **brltty conflict:** The `brltty` screen reader (pre-installed on many Linux distros) claims the NanoKVM's CH340 USB-serial chip, preventing serial port access. Braille display support is not compatible with this project. If you have `brltty` installed, disable or remove it:
> ```bash
> # Option A: disable (recommended)
> sudo systemctl stop brltty-udev.service
> sudo systemctl mask brltty-udev.service
> sudo systemctl mask brltty.path
>
> # Option B: remove entirely
> sudo apt remove brltty
> ```
> Then unplug and replug the NanoKVM.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+Insert` | Open paste dialog — sends clipboard text to the target machine |

## Project Structure

```
browser/    # NanoKVM-USB browser UI (modified from upstream)
portable/   # Rust binary that embeds and serves the browser build
```

## Changelog

### v1.7.0
- Add tags for credential vault items — categorize entries with custom tags
- Add tag autocomplete — previously used tags appear as suggestions when editing
- Add tag filter bar below search for quick filtering by tag
- Add sharp rendering toggle — pixel-perfect video scaling for crisp text (default on)
- Add app shortcuts reference section to shortcuts panel (Ctrl+Shift+Insert for paste)
- Improve vault item layout — aligned Copy/Type buttons across all field rows
- Move Copy button before Type button for better workflow
- Improve settings layout — left-aligned labels with right-aligned controls

### v1.6.0
- Add built-in credential vault — AES-GCM encrypted, PBKDF2-protected local password store
- Add TOTP (2FA) support with live countdown and type-to-target
- Add vault import/export for moving credentials between devices
- Add configurable auto-lock timeout (up to 24 hours)
- Fix keyboard capture intercepting input fields in overlay modals
- Fix menu going off-screen when exiting fullscreen

### v1.5.1
- Clean up console logging — errors only in normal mode, diagnostics gated behind `--debug`
- Centralize debug flag via shared `isDebug()` helper

### v1.5.0
- Fix Windows browser detection — resolve browser paths via `PROGRAMFILES`/`LOCALAPPDATA` environment variables instead of relying on bare command names
- Add `--debug` CLI flag for verbose HID and serial logging in the browser console

### v1.4.0
- Expand keyboard layouts to 76 (fetched from XKB data)

### v1.3.0
- Improve Linux serial port setup checks (robust dialout group detection, brltty conflict detection)
- Filter WebSerial port picker to CH340 devices only

## Upstream

This project is based on [sipeed/NanoKVM-USB](https://github.com/sipeed/NanoKVM-USB). See that repository for hardware documentation, technical specifications, and purchasing information.

## License

GPL-3.0 — same as the upstream project.
