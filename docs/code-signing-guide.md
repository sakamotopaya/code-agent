# Code Signing Guide for CLI Executables

## Overview

Code signing is required for macOS executables to run without being blocked by Gatekeeper, and recommended for Windows to avoid security warnings. This guide covers setting up code signing for all platforms.

## Platform Requirements

### macOS Code Signing

**Requirements:**

- Apple Developer Account ($99/year)
- Developer ID Application certificate
- Xcode Command Line Tools

**Setup Steps:**

1. **Get Developer Certificate:**

    ```bash
    # Install via Xcode or download from Apple Developer Portal
    # Certificate will be in Keychain Access as "Developer ID Application: Your Name (TEAM_ID)"
    ```

2. **Find Certificate Identity:**

    ```bash
    security find-identity -v -p codesigning
    ```

3. **Sign Executable:**

    ```bash
    codesign --sign "Developer ID Application: Your Name (TEAM_ID)" \
             --options runtime \
             --entitlements entitlements.plist \
             --timestamp \
             apps/roo-cline-macos
    ```

4. **Verify Signature:**
    ```bash
    codesign --verify --verbose apps/roo-cline-macos
    spctl --assess --type execute apps/roo-cline-macos
    ```

### Windows Code Signing

**Requirements:**

- Code Signing Certificate (from Sectigo, DigiCert, etc.)
- Windows SDK (for signtool.exe)

**Setup Steps:**

1. **Install Certificate:**

    - Import .pfx certificate file to Windows Certificate Store
    - Or use hardware token (recommended)

2. **Sign Executable:**

    ```cmd
    signtool sign /f certificate.pfx /p password /t http://timestamp.sectigo.com apps/roo-cline-win.exe
    ```

3. **Verify Signature:**
    ```cmd
    signtool verify /pa apps/roo-cline-win.exe
    ```

### Linux Code Signing (Optional)

**Options:**

- GPG signing for integrity verification
- AppImage signing
- Package repository signing

## Automated Code Signing Integration

### Environment Variables

Set these in your CI/CD environment or locally:

```bash
# macOS
export APPLE_CERTIFICATE_BASE64="<base64-encoded-p12-certificate>"
export APPLE_CERTIFICATE_PASSWORD="<certificate-password>"
export APPLE_TEAM_ID="<your-apple-team-id>"

# Windows
export WINDOWS_CERTIFICATE_BASE64="<base64-encoded-pfx-certificate>"
export WINDOWS_CERTIFICATE_PASSWORD="<certificate-password>"

# Timestamps
export TIMESTAMP_SERVER="http://timestamp.sectigo.com"
```

### GitHub Actions Secrets

Add these secrets to your GitHub repository:

- `APPLE_CERTIFICATE_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_TEAM_ID`
- `WINDOWS_CERTIFICATE_BASE64`
- `WINDOWS_CERTIFICATE_PASSWORD`

## Security Best Practices

1. **Certificate Storage:**

    - Never commit certificates to git
    - Use base64 encoding for CI/CD
    - Consider hardware tokens for production

2. **Timestamping:**

    - Always use timestamp servers
    - Ensures signatures remain valid after certificate expiry

3. **Entitlements (macOS):**

    - Use minimal required entitlements
    - Enable hardened runtime for security

4. **Verification:**
    - Always verify signatures after signing
    - Test on clean machines without certificates

## Troubleshooting

### Common macOS Issues

1. **"Developer cannot be verified" error:**

    - Certificate not trusted by Gatekeeper
    - Use `spctl --assess` to check

2. **"App is damaged" error:**

    - Usually due to quarantine attribute
    - Remove with: `xattr -d com.apple.quarantine app`

3. **Signature verification fails:**
    - Check certificate validity
    - Ensure proper entitlements

### Common Windows Issues

1. **"Unknown publisher" warning:**

    - Certificate not from trusted CA
    - Need proper code signing certificate

2. **Timestamp failures:**
    - Network issues with timestamp server
    - Try alternative timestamp URLs

## Cost Considerations

- **Apple Developer Program:** $99/year
- **Windows Code Signing Certificate:** $200-400/year
- **EV Certificates (recommended for Windows):** $300-600/year

## Alternative Solutions

### Development/Testing

1. **macOS:** Use ad-hoc signing for local testing:

    ```bash
    codesign --sign - --force --deep apps/roo-cline-macos
    ```

2. **Windows:** Self-signed certificates for testing:
    ```cmd
    makecert -sv test.pvk -n "CN=Test Certificate" test.cer
    ```

### Open Source Projects

1. **Community Signing Services:**

    - Some services offer free signing for OSS projects
    - Check with specific certificate authorities

2. **User Instructions:**
    - Provide clear instructions for users to bypass security warnings
    - Document the unsigned executable limitations
