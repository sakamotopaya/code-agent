#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")
const os = require("os")

// Parse command line arguments
const args = process.argv.slice(2)
const platformArg = args.find((arg) => arg.startsWith("--platform="))
const targetPlatform = platformArg ? platformArg.split("=")[1] : os.platform()
const executablePath = args.find((arg) => !arg.startsWith("--")) || ""

if (!executablePath) {
	console.error("Usage: node sign-executable.js <executable-path> [--platform=platform]")
	process.exit(1)
}

// Colors for output
const colors = {
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	reset: "\x1b[0m",
}

function log(message, color = colors.reset) {
	console.log(`${color}${message}${colors.reset}`)
}

function error(message) {
	log(`✗ ${message}`, colors.red)
}

function success(message) {
	log(`✓ ${message}`, colors.green)
}

function info(message) {
	log(`▶ ${message}`, colors.blue)
}

function warning(message) {
	log(`⚠ ${message}`, colors.yellow)
}

// Check if file exists
if (!fs.existsSync(executablePath)) {
	error(`Executable not found: ${executablePath}`)
	process.exit(1)
}

async function signMacOS(executablePath) {
	info("Signing macOS executable...")

	const teamId = process.env.APPLE_TEAM_ID
	const certificatePassword = process.env.APPLE_CERTIFICATE_PASSWORD
	const certificateBase64 = process.env.APPLE_CERTIFICATE_BASE64

	if (!teamId) {
		warning("APPLE_TEAM_ID not set. Attempting ad-hoc signing for development...")
		try {
			execSync(`codesign --sign - --force --deep "${executablePath}"`, { stdio: "inherit" })
			success("Ad-hoc signed for development (will only work on this machine)")
			return
		} catch (err) {
			error("Ad-hoc signing failed")
			throw err
		}
	}

	// Import certificate if provided
	if (certificateBase64 && certificatePassword) {
		info("Importing certificate...")
		const certPath = "/tmp/certificate.p12"
		fs.writeFileSync(certPath, Buffer.from(certificateBase64, "base64"))

		try {
			execSync(
				`security import "${certPath}" -P "${certificatePassword}" -A -t cert -f pkcs12 -k ~/Library/Keychains/login.keychain`,
				{ stdio: "inherit" },
			)
			success("Certificate imported")
		} catch (err) {
			warning("Certificate import failed, continuing with existing certificates...")
		}

		// Clean up certificate file
		fs.unlinkSync(certPath)
	}

	// Find signing identity
	info("Finding signing identity...")
	let signingIdentity
	try {
		const identities = execSync("security find-identity -v -p codesigning", { encoding: "utf8" })
		const match = identities.match(/Developer ID Application: ([^"]+) \(([^)]+)\)/)
		if (match) {
			signingIdentity = `Developer ID Application: ${match[1]} (${match[2]})`
			info(`Found signing identity: ${signingIdentity}`)
		} else {
			throw new Error("No Developer ID Application certificate found")
		}
	} catch (err) {
		error("Could not find signing identity")
		throw err
	}

	// Create entitlements file
	const entitlementsPath = path.join(path.dirname(executablePath), "entitlements.plist")
	const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>`

	fs.writeFileSync(entitlementsPath, entitlements)

	// Sign the executable
	info("Signing executable...")
	try {
		execSync(
			`codesign --sign "${signingIdentity}" --options runtime --entitlements "${entitlementsPath}" --timestamp "${executablePath}"`,
			{ stdio: "inherit" },
		)
		success("Executable signed successfully")
	} catch (err) {
		error("Signing failed")
		throw err
	} finally {
		// Clean up entitlements file
		if (fs.existsSync(entitlementsPath)) {
			fs.unlinkSync(entitlementsPath)
		}
	}

	// Verify signature
	info("Verifying signature...")
	try {
		execSync(`codesign --verify --verbose "${executablePath}"`, { stdio: "inherit" })
		execSync(`spctl --assess --type execute "${executablePath}"`, { stdio: "inherit" })
		success("Signature verified successfully")
	} catch (err) {
		warning("Signature verification failed, but executable was signed")
	}
}

async function signWindows(executablePath) {
	info("Signing Windows executable...")

	const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD
	const certificateBase64 = process.env.WINDOWS_CERTIFICATE_BASE64
	const timestampServer = process.env.TIMESTAMP_SERVER || "http://timestamp.sectigo.com"

	if (!certificateBase64 || !certificatePassword) {
		warning("Windows certificate not provided. Skipping signing...")
		warning("Set WINDOWS_CERTIFICATE_BASE64 and WINDOWS_CERTIFICATE_PASSWORD to enable signing")
		return
	}

	// Extract certificate
	const certPath = path.join(os.tmpdir(), "certificate.pfx")
	fs.writeFileSync(certPath, Buffer.from(certificateBase64, "base64"))

	try {
		// Sign with signtool
		info("Signing with signtool...")
		execSync(
			`signtool sign /f "${certPath}" /p "${certificatePassword}" /t "${timestampServer}" "${executablePath}"`,
			{ stdio: "inherit" },
		)
		success("Executable signed successfully")

		// Verify signature
		info("Verifying signature...")
		execSync(`signtool verify /pa "${executablePath}"`, { stdio: "inherit" })
		success("Signature verified successfully")
	} catch (err) {
		error("Windows signing failed")
		throw err
	} finally {
		// Clean up certificate file
		if (fs.existsSync(certPath)) {
			fs.unlinkSync(certPath)
		}
	}
}

async function signLinux(executablePath) {
	info("Linux signing not implemented (optional)")
	warning("Consider implementing GPG signing for integrity verification")
}

// Main signing logic
async function signExecutable() {
	try {
		info(`Signing executable: ${executablePath}`)
		info(`Target platform: ${targetPlatform}`)

		switch (targetPlatform) {
			case "darwin":
				await signMacOS(executablePath)
				break
			case "win32":
				await signWindows(executablePath)
				break
			case "linux":
				await signLinux(executablePath)
				break
			default:
				error(`Unsupported platform: ${targetPlatform}`)
				process.exit(1)
		}

		success("Code signing completed!")
	} catch (err) {
		error(`Code signing failed: ${err.message}`)
		process.exit(1)
	}
}

signExecutable()
