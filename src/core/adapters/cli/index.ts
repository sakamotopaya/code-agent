import { IUserInterface, IFileSystem, ITerminal, IBrowser } from "../../interfaces"
import { CliUserInterface } from "./CliUserInterface"
import { CliFileSystem } from "./CliFileSystem"
import { CliTerminal } from "./CliTerminal"
import { CliBrowser } from "./CliBrowser"

// Export all CLI adapters
export { CliUserInterface } from "./CliUserInterface"
export { CliFileSystem } from "./CliFileSystem"
export { CliTerminal } from "./CliTerminal"
export { CliBrowser } from "./CliBrowser"

// Export utilities
export { CliProgressIndicator } from "./utils/CliProgressIndicator"
export { OutputFormatter } from "./utils/OutputFormatter"
export { CliPrompts } from "./utils/CliPrompts"

/**
 * Options for creating CLI adapters
 */
export interface CliAdapterOptions {
	/** Working directory for file operations (default: process.cwd()) */
	workspaceRoot?: string

	/** Whether to enable interactive mode for user interface (default: true) */
	isInteractive?: boolean

	/** Whether to enable verbose logging (default: false) */
	verbose?: boolean
}

/**
 * CLI adapters bundle
 */
export interface CliAdapters {
	userInterface: IUserInterface
	fileSystem: IFileSystem
	terminal: ITerminal
	browser: IBrowser
}

/**
 * Create CLI adapter implementations for all abstraction interfaces
 *
 * @param options Configuration options for the CLI adapters
 * @returns Object containing all CLI adapter instances
 *
 * @example
 * ```typescript
 * import { createCliAdapters } from './src/core/adapters/cli'
 *
 * // Create adapters with default options
 * const adapters = createCliAdapters()
 *
 * // Create adapters with custom options
 * const adapters = createCliAdapters({
 *   workspaceRoot: '/path/to/project',
 *   isInteractive: false,
 *   verbose: true
 * })
 *
 * // Use the adapters
 * await adapters.userInterface.showInformation('Hello from CLI!')
 * const files = await adapters.fileSystem.readdir('.')
 * const result = await adapters.terminal.executeCommand('ls -la')
 * const browser = await adapters.browser.launch({ headless: true })
 * ```
 */
export function createCliAdapters(options: CliAdapterOptions = {}): CliAdapters {
	const { workspaceRoot = process.cwd(), isInteractive = true, verbose = false } = options

	// Create the adapter instances
	const userInterface = new CliUserInterface(isInteractive)
	const fileSystem = new CliFileSystem(workspaceRoot)
	const terminal = new CliTerminal()
	const browser = new CliBrowser()

	// Log adapter creation if verbose mode is enabled
	if (verbose) {
		console.log(`Created CLI adapters:`)
		console.log(`  - UserInterface (interactive: ${isInteractive})`)
		console.log(`  - FileSystem (workspace: ${workspaceRoot})`)
		console.log(`  - Terminal`)
		console.log(`  - Browser`)
	}

	return {
		userInterface,
		fileSystem,
		terminal,
		browser,
	}
}

/**
 * Create a CLI adapter factory with pre-configured options
 *
 * @param defaultOptions Default options to use for all adapter creations
 * @returns Factory function that creates adapters with the default options
 *
 * @example
 * ```typescript
 * // Create a factory with default options
 * const createAdapters = createCliAdapterFactory({
 *   workspaceRoot: '/my/project',
 *   verbose: true
 * })
 *
 * // Create adapters using the factory
 * const adapters1 = createAdapters() // Uses default options
 * const adapters2 = createAdapters({ isInteractive: false }) // Overrides isInteractive
 * ```
 */
export function createCliAdapterFactory(defaultOptions: CliAdapterOptions = {}) {
	return (overrideOptions: Partial<CliAdapterOptions> = {}): CliAdapters => {
		const mergedOptions = { ...defaultOptions, ...overrideOptions }
		return createCliAdapters(mergedOptions)
	}
}

/**
 * Convenience function to check if the current environment supports CLI operations
 *
 * @returns Promise resolving to true if CLI operations are supported
 */
export async function isCliEnvironmentSupported(): Promise<boolean> {
	try {
		// Check if we're in a Node.js environment
		return typeof process !== "undefined" && typeof process.cwd === "function" && typeof require !== "undefined"
	} catch {
		return false
	}
}

/**
 * Convenience function to validate CLI adapter requirements
 *
 * @param options Options to validate
 * @throws Error if validation fails
 */
export function validateCliAdapterOptions(options: CliAdapterOptions): void {
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
