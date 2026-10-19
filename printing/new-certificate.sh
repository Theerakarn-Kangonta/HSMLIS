#!/usr/bin/env bash
# Makes the certificate and private key for silent label printing with QZ Tray, valid for 20 years.
# Run it once, in Git Bash:   bash printing/new-certificate.sh [folder]     (default: ~/hsmlis-qz)
#
# It writes into the folder:
#   qz-private.key              the private key: keep it safe and private, never commit or copy it to a PC
#   qz-certificate.crt          the certificate (public)
#   render-Qz__PrivateKey.txt   the key on one line, to paste into Render as Qz__PrivateKey
#   render-Qz__Certificate.txt  the certificate on one line, to paste into Render as Qz__Certificate
# and copies the certificate to printing/override.crt, which setup-printing.bat installs on each PC.
set -euo pipefail

out="${1:-$HOME/hsmlis-qz}"
here="$(cd "$(dirname "$0")" && pwd)"

if [ -e "$out/qz-private.key" ]; then
  echo "$out/qz-private.key already exists. Pick another folder, or remove it first if you really mean to replace it:"
  echo "every lab PC then needs the new certificate (run setup-printing.bat again)."
  exit 1
fi
mkdir -p "$out"

# MSYS_NO_PATHCONV keeps Git Bash from turning the /CN=... subject into a Windows path,
# so the file paths are given to openssl in Windows form here.
native() { if command -v cygpath >/dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -sha256 -days 7300 -nodes \
  -subj "/CN=HSMLIS label printing/O=HSMLIS" \
  -keyout "$(native "$out/qz-private.key")" -out "$(native "$out/qz-certificate.crt")" 2>/dev/null

# Line breaks written as \n: the API turns them back into line breaks.
one_line() { tr -d '\r' < "$1" | awk 'BEGIN { ORS = "\\n" } { print }'; }
one_line "$out/qz-private.key" > "$out/render-Qz__PrivateKey.txt"
one_line "$out/qz-certificate.crt" > "$out/render-Qz__Certificate.txt"

cp "$out/qz-certificate.crt" "$here/override.crt"

echo
echo "Done. Valid until: $(openssl x509 -in "$out/qz-certificate.crt" -noout -enddate | cut -d= -f2)"
echo "1. On Render, set Qz__PrivateKey and Qz__Certificate from the two render-*.txt files in $out"
echo "2. Keep a backup of $out/qz-private.key somewhere safe (a password manager), then delete the render-*.txt files."
echo "3. Copy the printing folder to each lab PC and run setup-printing.bat."
