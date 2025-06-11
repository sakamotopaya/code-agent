#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { compile } = require("../src/node_modules/nexe")
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

// Platform-specific executable names and targets
const platforms = {
	darwin: {
		name: "roo-cline-macos",
		target: "mac-x64-20.16.0",
		arch: process.arch === "arm64" ? "arm64" : "x64",
	},
	win32: {
		name: "roo-cline-win.exe",
		target: "windows-x64-20.16.0",
		arch: "x64",
	},
	linux: {
		name: "roo-cline-linux",
		target: "linux-x64-20.16.0",
		arch: process.arch === "arm64" ? "arm64" : "x64",
	},
}

// Handle ARM64 targets
if (process.arch === "arm64") {
	platforms.darwin.target = "mac-arm64-20.16.0"
	platforms.linux.target = "linux-arm64-20.16.0"
}

async function buildNexe() {
	try {
		info(`Building standalone executable for ${targetPlatform} using nexe...`)

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

		const platform = platforms[targetPlatform]
		if (!platform) {
			error(`Unsupported platform: ${targetPlatform}`)
			error(`Supported platforms: ${Object.keys(platforms).join(", ")}`)
			process.exit(1)
		}

		const outputPath = path.resolve(binDir, platform.name)

		info(`Creating executable: ${platform.name}`)
		info(`Target: ${platform.target}`)
		info(`Absolute output path: ${outputPath}`)

		// Change working directory to project root for nexe
		const originalCwd = process.cwd()
		process.chdir(projectRoot)
		info(`Changed working directory to: ${process.cwd()}`)

		// Use relative paths from project root
		const relativeInput = path.relative(projectRoot, cliPath)
		const relativeOutput = path.relative(projectRoot, outputPath)
		info(`Relative input path: ${relativeInput}`)
		info(`Relative output path: ${relativeOutput}`)

		const nexeConfig = {
			input: relativeInput,
			output: relativeOutput,
			target: platform.target,
			bundle: false, // We already bundled with esbuild
			verbose: true,
			debugBundle: false,
			clean: true,
			resources: [
				// Include necessary assets (relative to project root)
				"src/dist/**/*",
				"src/assets/**/*",
				"src/node_modules/tree-sitter-wasms/**/*",
				"src/node_modules/@vscode/codicons/**/*",
				"src/node_modules/vscode-material-icons/**/*",
			],
			// Exclude unnecessary files to reduce size
			exclude: [
				"src/node_modules/.cache/**/*",
				"**/.git/**/*",
				"**/test/**/*",
				"**/tests/**/*",
				"**/*.test.js",
				"**/*.spec.js",
			],
		}

		info("Starting nexe compilation...")
		info(`Nexe config: ${JSON.stringify(nexeConfig, null, 2)}`)

		try {
			await compile(nexeConfig)
			info("✓ Nexe compilation completed")
		} catch (compileError) {
			error(`Nexe compilation failed: ${compileError.message}`)
			process.chdir(originalCwd) // Restore working directory on error
			throw compileError
		} finally {
			// Restore original working directory
			process.chdir(originalCwd)
			info(`Restored working directory to: ${process.cwd()}`)
		}

		// Check if file was created at expected location
		info(`Checking for executable at: ${outputPath}`)

		if (fs.existsSync(outputPath)) {
			const stats = fs.statSync(outputPath)
			const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
			success(`✓ Executable created successfully: ${outputPath}`)
			info(`Executable size: ${sizeInMB} MB`)

			// Make executable on Unix-like systems
			if (targetPlatform !== "win32") {
				fs.chmodSync(outputPath, 0o755)
				info("Set executable permissions")
			}
		} else {
			error(`Executable not found at expected location: ${outputPath}`)

			// Search for the file in common locations
			info("Searching for executable in alternate locations...")
			const searchPaths = [srcDir, path.join(srcDir, "bin"), projectRoot, path.join(projectRoot, "bin"), binDir]

			let foundPath = null
			for (const searchPath of searchPaths) {
				if (fs.existsSync(searchPath)) {
					const files = fs.readdirSync(searchPath)
					const executableFiles = files.filter(
						(file) => file.includes("roo-cline") || file.includes(platform.name),
					)
					if (executableFiles.length > 0) {
						foundPath = path.join(searchPath, executableFiles[0])
						info(`Found executable at: ${foundPath}`)
						break
					}
				}
			}

			if (foundPath) {
				info(`Moving executable from ${foundPath} to ${outputPath}`)
				fs.renameSync(foundPath, outputPath)
				success(`✓ Executable moved to correct location: ${outputPath}`)
			} else {
				error("Executable was not created successfully - not found in any expected location")
				process.exit(1)
			}
		}
	} catch (err) {
		error(`Build failed: ${err.message}`)
		if (err.stack) {
			console.error(err.stack)
		}
		process.exit(1)
	}
}

// Main execution
async function main() {
	if (!platforms[targetPlatform]) {
		error(`Unsupported platform: ${targetPlatform}`)
		error(`Supported platforms: ${Object.keys(platforms).join(", ")}`)
		process.exit(1)
	}

	await buildNexe()
}

main().catch((err) => {
	error(`Unexpected error: ${err.message}`)
	process.exit(1)
})
