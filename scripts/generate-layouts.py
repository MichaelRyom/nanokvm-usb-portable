#!/usr/bin/env python3
"""
Generate TypeScript keyboard layout maps from XKB symbol files.

Reads /usr/share/X11/xkb/symbols/ (or xkeyboard-config repo) and produces
browser/src/libs/keyboard/layouts.generated.ts with LayoutMap objects for
each configured layout.

Usage:
    python3 scripts/generate-layouts.py

The XKB data source can also be fetched from:
    https://gitlab.freedesktop.org/xkeyboard-config/xkeyboard-config/-/tree/master/symbols
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

XKB_REPO_URL = "https://gitlab.freedesktop.org/xkeyboard-config/xkeyboard-config.git"
KEYSYMDEF_URL = "https://gitlab.freedesktop.org/xorg/proto/xorgproto/-/raw/master/include/X11/keysymdef.h"

# Layouts to generate: (file, variant, output_id, display_name)
# variant=None means "basic" / default
#
# Note: CJK (Chinese/Japanese/Korean) are excluded because they require
# IME composition and can't be handled by direct key-to-character mapping.
LAYOUTS_TO_GENERATE = [
    # Western Europe
    ("us", None, "us", "US English"),
    ("us", "intl", "us-intl", "US International"),
    ("us", "dvorak", "us-dvorak", "US Dvorak"),
    ("us", "colemak", "us-colemak", "US Colemak"),
    ("gb", None, "gb", "British"),
    ("ie", None, "ie", "Irish"),
    ("de", None, "de", "German"),
    ("de", "nodeadkeys", "de-nodeadkeys", "German (no dead keys)"),
    ("fr", None, "fr", "French (AZERTY)"),
    ("fr", "nodeadkeys", "fr-nodeadkeys", "French (no dead keys)"),
    ("fr", "bepo", "fr-bepo", "French (BÉPO)"),
    ("es", None, "es", "Spanish"),
    ("it", None, "it", "Italian"),
    ("pt", None, "pt", "Portuguese"),
    ("nl", None, "nl", "Dutch"),
    ("be", None, "be", "Belgian"),
    ("at", None, "at", "Austrian"),
    ("ch", None, "ch", "Swiss German"),
    ("ch", "fr", "ch-fr", "Swiss French"),
    ("mt", None, "mt", "Maltese"),
    # Nordic
    ("dk", None, "dk", "Danish"),
    ("no", None, "no", "Norwegian"),
    ("se", None, "se", "Swedish"),
    ("fi", None, "fi", "Finnish"),
    ("is", None, "is", "Icelandic"),
    ("fo", None, "fo", "Faroese"),
    # Baltic
    ("ee", None, "ee", "Estonian"),
    ("lt", None, "lt", "Lithuanian"),
    ("lv", None, "lv", "Latvian"),
    # Central / Eastern Europe
    ("pl", None, "pl", "Polish"),
    ("cz", None, "cz", "Czech"),
    ("sk", None, "sk", "Slovak"),
    ("hu", None, "hu", "Hungarian"),
    ("ro", None, "ro", "Romanian"),
    ("si", None, "si", "Slovenian"),
    ("hr", None, "hr", "Croatian"),
    ("ba", None, "ba", "Bosnian"),
    ("rs", "latin", "rs-latin", "Serbian (Latin)"),
    ("rs", None, "rs", "Serbian (Cyrillic)"),
    ("me", None, "me", "Montenegrin"),
    ("al", None, "al", "Albanian"),
    ("md", None, "md", "Moldovan"),
    # Cyrillic
    ("ru", "winkeys", "ru", "Russian"),
    ("ua", "winkeys", "ua", "Ukrainian"),
    ("by", None, "by", "Belarusian"),
    ("bg", "phonetic", "bg", "Bulgarian (Phonetic)"),
    ("mk", None, "mk", "Macedonian"),
    ("kz", None, "kz", "Kazakh"),
    ("kg", None, "kg", "Kyrgyz"),
    ("mn", None, "mn", "Mongolian"),
    ("tj", None, "tj", "Tajik"),
    ("uz", "cyrillic", "uz-cyr", "Uzbek (Cyrillic)"),
    # Greek
    ("gr", None, "gr", "Greek"),
    # Hebrew
    ("il", None, "il", "Hebrew"),
    # Arabic script
    ("ara", None, "ara", "Arabic"),
    ("ir", "pes", "ir", "Persian (Farsi)"),
    ("pk", "urd-phonetic", "pk", "Urdu"),
    ("iq", None, "iq", "Iraqi"),
    ("sy", None, "sy", "Syriac"),
    # Caucasus
    ("ge", None, "ge", "Georgian"),
    ("am", None, "am", "Armenian"),
    ("az", "latin", "az", "Azerbaijani"),
    # Southeast Asia
    ("th", None, "th", "Thai"),
    ("vn", None, "vn", "Vietnamese"),
    ("mm", None, "mm", "Myanmar"),
    ("my", None, "my", "Malay"),
    ("ph", None, "ph", "Filipino"),
    ("id", None, "id", "Indonesian"),
    # South Asia
    ("bd", None, "bd", "Bangla"),
    ("lk", "sin_phonetic", "lk", "Sinhala"),
    ("np", None, "np", "Nepali"),
    # Americas
    ("br", None, "br", "Brazilian"),
    ("ca", None, "ca", "Canadian"),
    ("latam", None, "latam", "Latin American"),
    # Other
    ("tr", None, "tr", "Turkish"),
    ("uz", "latin", "uz", "Uzbek (Latin)"),
]

OUTPUT_FILE = os.path.join(
    os.path.dirname(__file__), "..", "browser", "src", "libs", "keyboard", "layouts.generated.ts"
)

# ---------------------------------------------------------------------------
# XKB key name -> HID keycode mapping
# ---------------------------------------------------------------------------

XKB_KEY_TO_HID = {
    "TLDE": 0x35,
    "AE01": 0x1E, "AE02": 0x1F, "AE03": 0x20, "AE04": 0x21,
    "AE05": 0x22, "AE06": 0x23, "AE07": 0x24, "AE08": 0x25,
    "AE09": 0x26, "AE10": 0x27, "AE11": 0x2D, "AE12": 0x2E,
    "AD01": 0x14, "AD02": 0x1A, "AD03": 0x08, "AD04": 0x15,
    "AD05": 0x17, "AD06": 0x1C, "AD07": 0x18, "AD08": 0x0C,
    "AD09": 0x12, "AD10": 0x13, "AD11": 0x2F, "AD12": 0x30,
    "AC01": 0x04, "AC02": 0x16, "AC03": 0x07, "AC04": 0x09,
    "AC05": 0x0A, "AC06": 0x0B, "AC07": 0x0D, "AC08": 0x0E,
    "AC09": 0x0F, "AC10": 0x33, "AC11": 0x34,
    "BKSL": 0x31,
    "AB01": 0x1D, "AB02": 0x1B, "AB03": 0x06, "AB04": 0x19,
    "AB05": 0x05, "AB06": 0x11, "AB07": 0x10, "AB08": 0x36,
    "AB09": 0x37, "AB10": 0x38,
    "LSGT": 0x64,
    "SPCE": 0x2C,
}

# ---------------------------------------------------------------------------
# Build keysym name -> Unicode char mapping from keysymdef.h
# ---------------------------------------------------------------------------

def parse_keysymdef(path: str) -> dict[str, str]:
    """
    Parse keysymdef.h to get keysym name -> Unicode character mapping.
    Uses the U+xxxx codepoints from comments as the authoritative source,
    which correctly maps Cyrillic, Greek, Hebrew, and other non-Latin keysyms.
    """
    keysyms = {}
    if not os.path.exists(path):
        return keysyms
    with open(path) as f:
        for line in f:
            # Prefer Unicode codepoint from comment (e.g. /* U+0444 CYRILLIC SMALL LETTER EF */)
            m = re.match(
                r"^#define\s+XK_(\w+)\s+0x[0-9a-fA-F]+\s*/\*.*?U\+([0-9A-Fa-f]{4,6})", line
            )
            if m:
                name = m.group(1)
                cp = int(m.group(2), 16)
                if 0 < cp <= 0x10FFFF:
                    keysyms[name] = chr(cp)
                continue
            # Fallback: keysym value for Latin-1 range
            m = re.match(r"^#define\s+XK_(\w+)\s+0x([0-9a-fA-F]+)", line)
            if m:
                name, val = m.group(1), int(m.group(2), 16)
                if 0x0020 <= val <= 0x007E or 0x00A0 <= val <= 0x00FF:
                    keysyms[name] = chr(val)
    return keysyms


def build_keysym_name_to_char(keysymdef_path: str) -> dict[str, str]:
    """Build a mapping from keysym name -> Unicode character."""
    # Manual overrides / common names not in keysymdef.h or needing special handling
    MANUAL = {
        "space": " ", "Tab": "\t", "Return": "\n",
        "exclam": "!", "at": "@", "numbersign": "#", "dollar": "$",
        "percent": "%", "asciicircum": "^", "ampersand": "&", "asterisk": "*",
        "parenleft": "(", "parenright": ")", "minus": "-", "underscore": "_",
        "equal": "=", "plus": "+", "bracketleft": "[", "bracketright": "]",
        "braceleft": "{", "braceright": "}", "backslash": "\\", "bar": "|",
        "semicolon": ";", "colon": ":", "apostrophe": "'", "quotedbl": '"',
        "grave": "`", "asciitilde": "~", "comma": ",", "period": ".",
        "slash": "/", "question": "?", "less": "<", "greater": ">",
        "EuroSign": "€", "sterling": "£", "yen": "¥", "cent": "¢",
        "currency": "¤", "section": "§", "degree": "°",
        "onehalf": "½", "onequarter": "¼", "threequarters": "¾",
        "onesuperior": "¹", "twosuperior": "²", "threesuperior": "³",
        "oneeighth": "⅛", "threeeighths": "⅜", "fiveeighths": "⅝", "seveneighths": "⅞",
        "plusminus": "±", "multiply": "×", "division": "÷",
        "mu": "µ", "paragraph": "¶", "registered": "®", "copyright": "©",
        "trademark": "™", "notsign": "¬", "brokenbar": "¦",
        "masculine": "º", "ordfeminine": "ª",
        "guillemotleft": "«", "guillemotright": "»",
        "exclamdown": "¡", "questiondown": "¿",
        "periodcentered": "·",
        # Latin letters with diacritics
        "ae": "æ", "AE": "Æ", "oslash": "ø", "Oslash": "Ø",
        "aring": "å", "Aring": "Å", "odiaeresis": "ö", "Odiaeresis": "Ö",
        "adiaeresis": "ä", "Adiaeresis": "Ä", "udiaeresis": "ü", "Udiaeresis": "Ü",
        "ssharp": "ß", "eth": "ð", "ETH": "Ð", "thorn": "þ", "THORN": "Þ",
        "ntilde": "ñ", "Ntilde": "Ñ", "ccedilla": "ç", "Ccedilla": "Ç",
        "oe": "œ", "OE": "Œ",
        "acircumflex": "â", "Acircumflex": "Â",
        "ecircumflex": "ê", "Ecircumflex": "Ê",
        "icircumflex": "î", "Icircumflex": "Î",
        "ocircumflex": "ô", "Ocircumflex": "Ô",
        "ucircumflex": "û", "Ucircumflex": "Û",
        "agrave": "à", "Agrave": "À",
        "egrave": "è", "Egrave": "È",
        "igrave": "ì", "Igrave": "Ì",
        "ograve": "ò", "Ograve": "Ò",
        "ugrave": "ù", "Ugrave": "Ù",
        "aacute": "á", "Aacute": "Á",
        "eacute": "é", "Eacute": "É",
        "iacute": "í", "Iacute": "Í",
        "oacute": "ó", "Oacute": "Ó",
        "uacute": "ú", "Uacute": "Ú",
        "yacute": "ý", "Yacute": "Ý",
        "atilde": "ã", "Atilde": "Ã",
        "otilde": "õ", "Otilde": "Õ",
        "idotless": "ı",
        "eng": "ŋ", "ENG": "Ŋ",
        "dstroke": "đ", "Dstroke": "Đ",
        "hstroke": "ħ", "Hstroke": "Ħ",
        "kra": "ĸ", "lstroke": "ł", "Lstroke": "Ł",
        "tslash": "ŧ", "Tslash": "Ŧ",
        "scedilla": "ş", "Scedilla": "Ş",
        "gbreve": "ğ", "Gbreve": "Ğ",
        "Iabovedot": "İ",
        "scaron": "š", "Scaron": "Š",
        "zcaron": "ž", "Zcaron": "Ž",
        "ccaron": "č", "Ccaron": "Č",
        "dcaron": "ď", "Dcaron": "Ď",
        "ecaron": "ě", "Ecaron": "Ě",
        "ncaron": "ň", "Ncaron": "Ň",
        "rcaron": "ř", "Rcaron": "Ř",
        "tcaron": "ť", "Tcaron": "Ť",
        "uring": "ů", "Uring": "Ů",
        "sacute": "ś", "Sacute": "Ś",
        "zacute": "ź", "Zacute": "Ź",
        "zabovedot": "ż", "Zabovedot": "Ż",
        "aogonek": "ą", "Aogonek": "Ą",
        "eogonek": "ę", "Eogonek": "Ę",
        "cacute": "ć", "Cacute": "Ć",
        "nacute": "ń", "Nacute": "Ń",
        "doublelowquotemark": "„", "singlelowquotemark": "‚",
        "leftdoublequotemark": "\u201C", "leftsinglequotemark": "\u2018",
        "rightdoublequotemark": "\u201D", "rightsinglequotemark": "\u2019",
        "ellipsis": "…", "emdash": "—", "endash": "–",
        "leftarrow": "←", "rightarrow": "→", "uparrow": "↑", "downarrow": "↓",
        "numbersign": "#",
        "0": "0", "1": "1", "2": "2", "3": "3", "4": "4",
        "5": "5", "6": "6", "7": "7", "8": "8", "9": "9",
    }

    # Add single lowercase and uppercase letters
    for c in "abcdefghijklmnopqrstuvwxyz":
        MANUAL[c] = c
        MANUAL[c.upper()] = c.upper()

    # Build from keysymdef.h (adds Cyrillic, Greek, Hebrew, etc.)
    result = dict(MANUAL)
    parsed = parse_keysymdef(keysymdef_path)
    for name, char in parsed.items():
        if name not in result:
            result[name] = char

    return result


def resolve_unicode_keysym(name: str) -> str | None:
    """Resolve Uxxxx keysym names to Unicode characters."""
    m = re.match(r"^U([0-9A-Fa-f]{4,6})$", name)
    if m:
        cp = int(m.group(1), 16)
        if 0 < cp <= 0x10FFFF:
            return chr(cp)
    return None


# ---------------------------------------------------------------------------
# XKB symbol file parser
# ---------------------------------------------------------------------------

# Regex patterns
KEY_RE = re.compile(
    r"""key\s+<(\w+)>\s*\{\s*\[\s*(.*?)\s*\]\s*\}""",
    re.DOTALL
)
INCLUDE_RE = re.compile(r'include\s+"([^"]+)"')
VARIANT_RE = re.compile(
    r'xkb_symbols\s+"([\w-]+)"\s*\{(.*?)(?=xkb_symbols\s+"|$)',
    re.DOTALL
)


def parse_xkb_file(filepath: str) -> dict[str, str]:
    """Read an XKB symbols file, return dict of variant_name -> raw content."""
    with open(filepath) as f:
        content = f.read()

    variants = {}
    for m in VARIANT_RE.finditer(content):
        variant_name = m.group(1)
        variant_body = m.group(2)
        variants[variant_name] = variant_body

    return variants


def resolve_variant(file_id: str, variant: str | None,
                    symbols_dir: str, depth: int = 0) -> dict[str, list[str]]:
    """
    Resolve a layout variant to a dict of xkb_key_name -> [level1, level2, level3, level4].
    Handles includes recursively.
    """
    if depth > 20:
        return {}

    filepath = os.path.join(symbols_dir, file_id)
    if not os.path.exists(filepath):
        return {}

    variants = parse_xkb_file(filepath)

    # Find the target variant
    target_variant = variant or "basic"
    body = variants.get(target_variant)

    # If "basic" not found, try "default" or first variant
    if body is None and target_variant == "basic":
        # Check if there's a default partial
        body = variants.get("basic")
        if body is None and variants:
            # Use the first variant
            body = next(iter(variants.values()))

    if body is None:
        return {}

    # Start with empty key map
    keys: dict[str, list[str]] = {}

    # Process includes first
    for inc_match in INCLUDE_RE.finditer(body):
        inc_ref = inc_match.group(1)
        # Parse include reference: "file(variant)" or "file"
        inc_m = re.match(r"(\w+)(?:\((\w+)\))?", inc_ref)
        if inc_m:
            inc_file = inc_m.group(1)
            inc_var = inc_m.group(2)
            included = resolve_variant(inc_file, inc_var, symbols_dir, depth + 1)
            keys.update(included)

    # Then apply this variant's key definitions (overrides includes)
    for key_match in KEY_RE.finditer(body):
        key_name = key_match.group(1)
        levels_str = key_match.group(2)
        # Parse the levels list
        levels = [s.strip() for s in levels_str.split(",")]
        keys[key_name] = levels

    return keys


# ---------------------------------------------------------------------------
# Generate TypeScript
# ---------------------------------------------------------------------------

DEAD_KEY_NAMES = {
    "dead_acute", "dead_grave", "dead_circumflex", "dead_tilde",
    "dead_diaeresis", "dead_abovering", "dead_macron", "dead_breve",
    "dead_abovedot", "dead_belowdot", "dead_cedilla", "dead_ogonek",
    "dead_caron", "dead_horn", "dead_hook", "dead_doubleacute",
    "dead_stroke",
}


def ts_escape(char: str) -> str:
    """Escape a character for use as a TypeScript string key."""
    if char == "'":
        return "\\'"
    if char == "\\":
        return "\\\\"
    if char == "\n":
        return "\\n"
    if char == "\r":
        return "\\r"
    if char == "\t":
        return "\\t"
    cp = ord(char)
    if cp < 0x20 or cp == 0x7F:
        return f"\\x{cp:02x}"
    if cp > 0x7E:
        if cp <= 0xFFFF:
            return f"\\u{cp:04x}"
        return f"\\u{{{cp:x}}}"
    return char


def generate_layout(layout_id: str, display_name: str,
                    keys: dict[str, list[str]],
                    keysym_map: dict[str, str | None]) -> list[str]:
    """Generate TypeScript for one layout."""
    entries: list[tuple[str, int, bool, bool, bool]] = []  # (char, hid, shift, altGr, deadKey)

    for key_name, levels in keys.items():
        hid = XKB_KEY_TO_HID.get(key_name)
        if hid is None:
            continue

        for level_idx, keysym_name in enumerate(levels):
            keysym_name = keysym_name.strip()
            if not keysym_name:
                continue

            is_dead = keysym_name in DEAD_KEY_NAMES
            shift = level_idx in (1, 3)
            altGr = level_idx in (2, 3)

            # Skip AltGr combinations (level 3, 4) for simplicity in paste
            # They add complexity and are less commonly needed
            if altGr and level_idx == 3:
                continue

            # Resolve keysym to character
            char = keysym_map.get(keysym_name)
            if char is None:
                char = resolve_unicode_keysym(keysym_name)
            if char is None:
                continue

            entries.append((char, hid, shift, altGr, is_dead))

    # Also add control chars
    control_entries = [
        (" ", 0x2C, False, False, False),
        ("\t", 0x2B, False, False, False),
        ("\n", 0x28, False, False, False),
        ("\r", 0x28, False, False, False),
    ]

    # Build the output, deduplicating (first wins for same char)
    seen: set[str] = set()
    lines = []
    lines.append(f"  // {display_name}")
    lines.append(f"  '{layout_id}': {{")
    lines.append(f"    name: '{display_name}',")
    lines.append(f"    map: {{")

    for char, hid, shift, altGr, is_dead in entries + control_entries:
        if char in seen:
            continue
        seen.add(char)

        escaped = ts_escape(char)
        parts = [f"code: 0x{hid:02x}"]
        if shift:
            parts.append("shift: true")
        if altGr:
            parts.append("altGr: true")
        if is_dead:
            parts.append("deadKey: true")

        char_comment = ""
        if ord(char) > 0x7E or ord(char) < 0x20:
            try:
                name = unicodedata.name(char, "")
                if name:
                    char_comment = f"  // {char} {name}"
            except ValueError:
                pass

        lines.append(f"      '{escaped}': {{ {', '.join(parts)} }},{char_comment}")

    lines.append(f"    }},")
    lines.append(f"  }},")

    return lines


def fetch_online_data() -> tuple[str, str, str]:
    """
    Fetch XKB symbols and keysymdef.h from online repos.
    Returns (symbols_dir, keysymdef_path, tmp_dir).
    Always uses upstream repos to ensure consistent, up-to-date builds.
    """
    tmp_dir = tempfile.mkdtemp(prefix="xkb-data-")

    # Fetch XKB symbols via git sparse checkout
    print(f"Fetching XKB data from {XKB_REPO_URL} (sparse checkout, symbols/ only)...")
    if not shutil.which("git"):
        print("Error: git is required to fetch XKB data. Install git and retry.", file=sys.stderr)
        shutil.rmtree(tmp_dir, ignore_errors=True)
        sys.exit(1)

    try:
        subprocess.run(
            ["git", "clone", "--depth=1", "--filter=blob:none", "--sparse", XKB_REPO_URL, tmp_dir],
            check=True, capture_output=True, text=True,
        )
        subprocess.run(
            ["git", "-C", tmp_dir, "sparse-checkout", "set", "symbols"],
            check=True, capture_output=True, text=True,
        )
    except subprocess.CalledProcessError as e:
        print(f"Error fetching XKB data: {e.stderr}", file=sys.stderr)
        shutil.rmtree(tmp_dir, ignore_errors=True)
        sys.exit(1)

    symbols_dir = os.path.join(tmp_dir, "symbols")
    if not os.path.isdir(symbols_dir):
        print(f"Error: symbols/ not found in cloned repo", file=sys.stderr)
        shutil.rmtree(tmp_dir, ignore_errors=True)
        sys.exit(1)
    print(f"  Fetched XKB symbols to {symbols_dir}")

    # Fetch keysymdef.h (needed for Cyrillic, Greek, Hebrew keysym mappings)
    keysymdef_path = os.path.join(tmp_dir, "keysymdef.h")
    print(f"Fetching keysymdef.h from xorgproto...")
    try:
        urllib.request.urlretrieve(KEYSYMDEF_URL, keysymdef_path)
        print(f"  Fetched keysymdef.h")
    except Exception as e:
        print(f"  WARNING: Could not fetch keysymdef.h: {e}", file=sys.stderr)
        print(f"  Non-Latin layouts may have incomplete character mappings.", file=sys.stderr)

    return symbols_dir, keysymdef_path, tmp_dir


def main():
    symbols_dir, keysymdef_path, tmp_dir = fetch_online_data()

    try:
        print(f"Building keysym mapping...")
        keysym_map = build_keysym_name_to_char(keysymdef_path)
        print(f"  {len(keysym_map)} keysym names mapped")

        # Sort layouts alphabetically by display name
        sorted_layouts = sorted(LAYOUTS_TO_GENERATE, key=lambda x: x[3].lower())

        output_lines = [
            "// Auto-generated from XKB layout data (xkeyboard-config)",
            "// Source: https://gitlab.freedesktop.org/xkeyboard-config/xkeyboard-config",
            f"// Generated by: scripts/generate-layouts.py",
            "//",
            "// DO NOT EDIT MANUALLY - regenerate with: python3 scripts/generate-layouts.py",
            "",
            "import type { LayoutMap } from './layouts';",
            "",
            "export const GENERATED_LAYOUTS: Record<string, { name: string; map: LayoutMap }> = {",
        ]

        success = 0
        for file_id, variant, layout_id, display_name in sorted_layouts:
            print(f"  Generating {layout_id} ({display_name})...")
            keys = resolve_variant(file_id, variant, symbols_dir)
            if not keys:
                print(f"    WARNING: No keys found for {file_id}/{variant}", file=sys.stderr)
                continue

            layout_lines = generate_layout(layout_id, display_name, keys, keysym_map)
            output_lines.extend(layout_lines)
            success += 1

        output_lines.append("};")
        output_lines.append("")

        # Write output
        output_path = os.path.abspath(OUTPUT_FILE)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w") as f:
            f.write("\n".join(output_lines))

        print(f"\nGenerated {success} layouts -> {output_path}")
    finally:
        if tmp_dir:
            shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
