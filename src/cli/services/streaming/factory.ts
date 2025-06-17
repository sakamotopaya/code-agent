/**
 * Factory functions for creating CLI streaming components with sensible defaults
 */

import { MessageBuffer } from "../../../api/streaming/MessageBuffer"
import { CLIContentProcessor } from "./CLIContentProcessor"
import { CLIDisplayFormatter } from "./CLIDisplayFormatter"
import { ConsoleOutputWriter } from "./ConsoleOutputWriter"
import { CLILogger, CLIStateManager } from "./CLILogger"

/**
 * Factory function to create a CLI logger with default components
 * Following Dependency Inversion Principle with sensible defaults
 */
export function createDefaultCLILogger(
	options: {
		verbose?: boolean
		quiet?: boolean
		useColor?: boolean
		showThinking?: boolean
	} = {},
): CLILogger {
	const { verbose = false, quiet = false, useColor = true, showThinking = false } = options

	// Create components with defaults
	const messageBuffer = new MessageBuffer()
	const contentProcessor = new CLIContentProcessor(messageBuffer)
	const displayFormatter = new CLIDisplayFormatter(useColor, showThinking)
	const outputWriter = new ConsoleOutputWriter(quiet)
	const stateManager = new CLIStateManager(showThinking)

	// Create logger with dependency injection
	return new CLILogger(contentProcessor, displayFormatter, outputWriter, stateManager, {
		useColor,
		showThinking,
		isVerbose: verbose,
		isQuiet: quiet,
	})
}

/**
 * Factory function to create a CLI logger compatible with legacy API
 * Maps old constructor parameters to new SOLID architecture
 */
export function createLegacyCLILogger(
	verbose: boolean = false,
	quiet: boolean = false,
	useColor: boolean = true,
	showThinking: boolean = false,
): CLILogger {
	return createDefaultCLILogger({
		verbose,
		quiet,
		useColor,
		showThinking,
	})
}
