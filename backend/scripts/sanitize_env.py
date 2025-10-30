from pathlib import Path
import sys

# Adjust this path only if your repo is elsewhere
ENV_PATH = Path(r"c:\Users\fathi\OneDrive\App_medical\MedicApp\backend\.env")

if not ENV_PATH.exists():
    print(f"ERROR: {ENV_PATH} not found")
    sys.exit(2)

b = ENV_PATH.read_bytes()
try:
    s = b.decode('utf-8')
    decoded_from = 'utf-8'
except UnicodeDecodeError:
    s = b.decode('latin-1')
    decoded_from = 'latin-1'

# strip BOM if present
if s.startswith('\ufeff'):
    s = s.lstrip('\ufeff')

orig = s
# Common problematic characters -> ASCII replacements
replacements = {
    '\u2011': '-',  # non-breaking hyphen
    '\u2013': '-',  # en dash
    '\u2014': '-',  # em dash
    '\u2018': "'",  # left single quote
    '\u2019': "'",  # right single quote
    '\u201c': '"',  # left double quote (lowercase key for safety)
    '\u201C': '"',
    '\u201d': '"',
    '\u201D': '"',
    '\u00A0': ' ',  # non-breaking space
}

for k, v in replacements.items():
    s = s.replace(k, v)

# Report remaining non-ascii codepoints (if any)
non_ascii_positions = [(i, ord(ch)) for i, ch in enumerate(s) if ord(ch) > 127]

if s != orig:
    bak = ENV_PATH.with_suffix('.env.bak')
    bak.write_bytes(b)
    ENV_PATH.write_text(s, encoding='utf-8', newline='\n')
    print(f"Sanitized {ENV_PATH} (decoded from {decoded_from}). Backup saved to {bak}")
else:
    print(f"No replacements needed; decoded from {decoded_from}.")

if non_ascii_positions:
    print('\nRemaining non-ASCII characters (index, codepoint):')
    for idx, cp in non_ascii_positions[:50]:
        print(f"{idx}: U+{cp:04X}")
    if len(non_ascii_positions) > 50:
        print(f"... and {len(non_ascii_positions)-50} more")
else:
    print('\nNo remaining non-ASCII characters found.')
