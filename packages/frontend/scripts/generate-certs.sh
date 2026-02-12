#!/bin/bash

# Script to generate self-signed SSL certificates for local HTTPS development
# This script uses mkcert to create locally-trusted certificates

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
CERT_FILE="$FRONTEND_DIR/localhost.pem"
KEY_FILE="$FRONTEND_DIR/localhost-key.pem"

echo "🔐 Generating SSL certificates for HTTPS development server..."
echo ""

# Check if certificates already exist
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "✅ Certificates already exist:"
    echo "   - $CERT_FILE"
    echo "   - $KEY_FILE"
    echo ""
    read -p "Do you want to regenerate them? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing certificates."
        exit 0
    fi
    echo "Regenerating certificates..."
    rm -f "$CERT_FILE" "$KEY_FILE"
fi

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "❌ mkcert is not installed."
    echo ""
    echo "Please install mkcert first:"
    echo ""
    echo "  macOS:"
    echo "    brew install mkcert"
    echo "    brew install nss  # for Firefox support"
    echo ""
    echo "  Linux:"
    echo "    # See https://github.com/FiloSottile/mkcert#installation"
    echo ""
    echo "  Windows:"
    echo "    choco install mkcert"
    echo ""
    exit 1
fi

# Check if mkcert CA is installed
if ! mkcert -CAROOT &> /dev/null; then
    echo "📦 Installing mkcert CA..."
    mkcert -install
    echo ""
fi

# Generate certificates
echo "📝 Generating certificates for localhost..."
cd "$FRONTEND_DIR"
mkcert -cert-file localhost.pem -key-file localhost-key.pem localhost 127.0.0.1 ::1

echo ""
echo "✅ Certificates generated successfully!"
echo ""
echo "Generated files:"
echo "  - Certificate: $CERT_FILE"
echo "  - Private Key: $KEY_FILE"
echo ""
echo "These files are already listed in .gitignore and will not be committed."
echo ""
echo "You can now run the HTTPS development server with:"
echo "  pnpm dev:ssl"
echo ""
