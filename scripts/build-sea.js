#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")
const os = require("os")

// Parse command line arguments
const args = process.argv.slice(2)
const platformArg = args.find((arg) => arg.startsWith("--platform="))
const targetPlatform = platformArg ? platformArg.split("=")[1] : os.platform()

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

// Get the current directory (should be src)
const srcDir = process.cwd()
const projectRoot = path.dirname(srcDir)
const binDir = path.resolve(projectRoot, "apps")

// Debug path information
info(`Current working directory: ${srcDir}`)
info(`Project root: ${projectRoot}`)
info(`Output directory: ${binDir}`)

// Platform-specific executable names and Node binary sources
const platforms = {
	darwin: {
		name: "roo-cline-macos",
		arch: process.arch === "arm64" ? "arm64" : "x64",
		nodeBinary: process.execPath,
	},
	win32: {
		name: "roo-cline-win.exe",
		arch: "x64",
		nodeBinary: process.execPath,
	},
	linux: {
		name: "roo-cline-linux",
		arch: process.arch === "arm64" ? "arm64" : "x64",
		nodeBinary: process.execPath,
	},
}

async function buildSEA() {
	try {
		info(`Building Single Executable Application for ${targetPlatform}...`)

		// Ensure we have the necessary files
		const cliPath = path.resolve(srcDir, "dist", "cli", "index.js")
		info(`Looking for CLI bundle at: ${cliPath}`)
		if (!fs.existsSync(cliPath)) {
			error("CLI bundle not found. Run npm run build:cli first.")
			process.exit(1)
		}
		info(`✓ CLI bundle found`)

		// Create apps directory
		info(`Creating output directory: ${binDir}`)
		if (!fs.existsSync(binDir)) {
			fs.mkdirSync(binDir, { recursive: true })
			info(`✓ Created directory: ${binDir}`)
		} else {
			info(`✓ Directory already exists: ${binDir}`)
		}

		// Create SEA configuration
		const seaConfig = {
			main: "./dist/cli/index.js",
			output: "sea-prep.blob",
			disableExperimentalSEAWarning: true,
			useSnapshot: false,
			useCodeCache: true,
		}

		const seaConfigPath = path.join(srcDir, "sea-config.json")
		fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2))

		info("Created SEA configuration")

		// Generate the blob
		info("Generating SEA blob...")
		try {
			execSync(`node --experimental-sea-config sea-config.json`, {
				cwd: srcDir,
				stdio: "inherit",
			})
		} catch (err) {
			error("Failed to generate SEA blob")
			throw err
		}

		success("SEA blob generated")

		// Copy Node.js binary
		const platform = platforms[targetPlatform]
		const outputPath = path.resolve(binDir, platform.name)

		info(`Creating executable: ${platform.name}`)
		info(`Absolute output path: ${outputPath}`)

		try {
			fs.copyFileSync(platform.nodeBinary, outputPath)

			// Make executable on Unix-like systems
			if (targetPlatform !== "win32") {
				fs.chmodSync(outputPath, 0o755)
			}
		} catch (err) {
			error("Failed to copy Node.js binary")
			throw err
		}

		// Inject the blob
		info("Injecting application into executable...")
		try {
			const blobPath = path.join(srcDir, "sea-prep.blob")
			if (!fs.existsSync(blobPath)) {
				error("SEA blob not found")
				process.exit(1)
			}

			// Use postject or manual injection for Node.js SEA
			if (targetPlatform === "darwin") {
				execSync(
					`npx postject "${outputPath}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA`,
					{
						cwd: srcDir,
						stdio: "inherit",
					},
				)
			} else if (targetPlatform === "win32") {
				execSync(
					`npx postject "${outputPath}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
					{
						cwd: srcDir,
						stdio: "inherit",
					},
				)
			} else {
				execSync(
					`npx postject "${outputPath}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
					{
						cwd: srcDir,
						stdio: "inherit",
					},
				)
			}
		} catch (err) {
			error("Failed to inject blob into executable")
			throw err
		}

		// Clean up temporary files
		const tempFiles = ["sea-config.json", "sea-prep.blob"]
		tempFiles.forEach((file) => {
			const filePath = path.join(srcDir, file)
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath)
			}
		})

		success(`Standalone executable created: ${outputPath}`)

		// Show file size
		const stats = fs.statSync(outputPath)
		const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
		info(`Executable size: ${sizeInMB} MB`)
	} catch (err) {
		error(`Build failed: ${err.message}`)
		process.exit(1)
	}
}

// Check if we need to install postject
function ensurePostject() {
	try {
		execSync("npx postject --help", { stdio: "ignore" })
	} catch {
		info("Installing postject...")
		execSync("npm install --save-dev postject", { cwd: srcDir, stdio: "inherit" })
	}
}

// Main execution
async function main() {
	if (!platforms[targetPlatform]) {
		error(`Unsupported platform: ${targetPlatform}`)
		error(`Supported platforms: ${Object.keys(platforms).join(", ")}`)
		process.exit(1)
	}

	ensurePostject()
	await buildSEA()
}

main().catch((err) => {
	error(`Unexpected error: ${err.message}`)
	process.exit(1)
})
