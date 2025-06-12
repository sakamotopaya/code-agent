import { CoreInterfaces } from "../../interfaces"
import { createCliAdapters } from "../cli"
import { ApiUserInterface } from "./ApiUserInterface"
import { ApiBrowser } from "./ApiBrowser"
import { ApiFileSystem } from "./ApiFileSystem"
import { ApiStorageService } from "./ApiStorage"
import { ApiTelemetryService } from "./ApiTelemetryService"

/**
 * Options for creating API adapters
 */
export interface ApiAdapterOptions {
	/** Working directory for file operations (default: process.cwd()) */
	workspaceRoot?: string

	/** Whether to enable verbose logging (default: false) */
	verbose?: boolean

	/** Whether to enable debug mode (default: false) */
	debug?: boolean
}

/**
 * Create API adapter implementations for all abstraction interfaces
 * Uses API-specific implementations where available, falling back to CLI adapters for terminal
 */
export async function createApiAdapters(options: ApiAdapterOptions = {}): Promise<CoreInterfaces> {
	const { workspaceRoot = process.cwd(), verbose = false, debug = false } = options

	// Create API-specific adapters
	const apiUserInterface = new ApiUserInterface({ verbose, debug })
	const apiBrowser = new ApiBrowser({ verbose })
	const apiFileSystem = new ApiFileSystem(workspaceRoot, { verbose })
	const apiStorage = new ApiStorageService({ verbose })
	const apiTelemetry = new ApiTelemetryService({ enabled: false, verbose })

	// For terminal, we still use CLI adapter as it provides the actual terminal functionality
	const cliAdapters = createCliAdapters({
		workspaceRoot,
		isInteractive: false, // API mode is non-interactive
		verbose,
	})

	// Log adapter creation if verbose mode is enabled
	if (verbose) {
		console.log(`Created API adapters:`)
		console.log(`  - UserInterface (API-specific, debug: ${debug})`)
		console.log(`  - FileSystem (API-specific, workspace: ${workspaceRoot})`)
		console.log(`  - Terminal (CLI-based)`)
		console.log(`  - Browser (API-specific)`)
		console.log(`  - Telemetry (API-specific)`)
		console.log(`  - Storage (API-specific)`)
	}

	return {
		userInterface: apiUserInterface,
		fileSystem: apiFileSystem,
		terminal: cliAdapters.terminal,
		browser: apiBrowser,
		telemetry: apiTelemetry,
		storage: apiStorage,
	}
}

/**
 * Create an API adapter factory with pre-configured options
 */
export function createApiAdapterFactory(defaultOptions: ApiAdapterOptions = {}) {
	return async (overrideOptions: Partial<ApiAdapterOptions> = {}): Promise<CoreInterfaces> => {
		const mergedOptions = { ...defaultOptions, ...overrideOptions }
		return createApiAdapters(mergedOptions)
	}
}

/**
 * Convenience function to check if the current environment supports API operations
 */
export async function isApiEnvironmentSupported(): Promise<boolean> {
	try {
		// Check if we're in a Node.js environment with HTTP support
		return typeof process !== "undefined" && typeof process.cwd === "function" && typeof require !== "undefined"
	} catch {
		return false
	}
}

/**
 * Convenience function to validate API adapter requirements
 */
export function validateApiAdapterOptions(options: ApiAdapterOptions): void {
	if (options.workspaceRoot) {
		try {
			const fs = require("fs")
			if (!fs.existsSync(options.workspaceRoot)) {
				throw new Error(`Workspace root does not exist: ${options.workspaceRoot}`)
			}

			const stats = fs.statSync(options.workspaceRoot)
			if (!stats.isDirectory()) {
				throw new Error(`Workspace root is not a directory: ${options.workspaceRoot}`)
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes("Workspace root")) {
				throw error
			}
			throw new Error(`Unable to access workspace root: ${options.workspaceRoot}`)
		}
	}
}

// Re-export all API adapters for direct use
export { ApiUserInterface } from "./ApiUserInterface"
export { ApiBrowser } from "./ApiBrowser"
export { ApiFileSystem } from "./ApiFileSystem"
export { ApiStorageService } from "./ApiStorage"
export { ApiTelemetryService } from "./ApiTelemetryService"
