import { CoreInterfaces } from "../../interfaces"
import { createCliAdapters, CliAdapterOptions } from "../cli"
import { ApiUserInterface } from "./ApiUserInterface"

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
 * For now, this reuses CLI adapters but replaces the user interface with API-specific one
 */
export async function createApiAdapters(options: ApiAdapterOptions = {}): Promise<CoreInterfaces> {
	const { workspaceRoot = process.cwd(), verbose = false, debug = false } = options

	// Create CLI adapters as base
	const cliAdapters = createCliAdapters({
		workspaceRoot,
		isInteractive: false, // API mode is non-interactive
		verbose,
	})

	// Replace user interface with API-specific implementation
	const apiUserInterface = new ApiUserInterface({ verbose, debug })

	// Log adapter creation if verbose mode is enabled
	if (verbose) {
		console.log(`Created API adapters:`)
		console.log(`  - UserInterface (API-specific, debug: ${debug})`)
		console.log(`  - FileSystem (CLI-based, workspace: ${workspaceRoot})`)
		console.log(`  - Terminal (CLI-based)`)
		console.log(`  - Browser (CLI-based)`)
		console.log(`  - Telemetry (CLI-based)`)
		console.log(`  - Storage (CLI-based)`)
	}

	return {
		userInterface: apiUserInterface,
		fileSystem: cliAdapters.fileSystem,
		terminal: cliAdapters.terminal,
		browser: cliAdapters.browser,
		telemetry: cliAdapters.telemetry,
		storage: cliAdapters.storage,
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

// Re-export the API user interface for direct use
export { ApiUserInterface } from "./ApiUserInterface"
