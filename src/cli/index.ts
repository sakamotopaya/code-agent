import { Command } from "commander"
import { CliRepl } from "./repl"
import { BatchProcessor } from "./commands/batch"
import { showHelp } from "./commands/help"
import { showBanner } from "./utils/banner"
import { validateCliAdapterOptions } from "../core/adapters/cli"
import chalk from "chalk"

const program = new Command()

interface CliOptions {
	cwd: string
	config?: string
	batch?: string
	interactive: boolean
	color: boolean
	verbose: boolean
}

program
	.name("roo-cli")
	.description("Roo Code Agent CLI - Interactive coding assistant for the command line")
	.version("1.0.0")
	.option("-c, --cwd <path>", "Working directory", process.cwd())
	.option("--config <path>", "Configuration file path")
	.option("-b, --batch <task>", "Run in batch mode with specified task")
	.option("-i, --interactive", "Run in interactive mode (default)", true)
	.option("--no-color", "Disable colored output")
	.option("-v, --verbose", "Enable verbose logging", false)
	.action(async (options: CliOptions) => {
		try {
			// Validate options
			validateCliAdapterOptions({
				workspaceRoot: options.cwd,
				verbose: options.verbose,
			})

			// Show banner if in interactive mode
			if (!options.batch) {
				showBanner()
			}

			if (options.batch) {
				const batchProcessor = new BatchProcessor(options)
				await batchProcessor.run(options.batch)
			} else {
				const repl = new CliRepl(options)
				await repl.start()
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (options.color) {
				console.error(chalk.red("Error:"), message)
			} else {
				console.error("Error:", message)
			}
			process.exit(1)
		}
	})

// Handle help command specifically
program
	.command("help")
	.description("Show detailed help information")
	.action(() => {
		showHelp()
	})

// Parse command line arguments
program.parse()

export type { CliOptions }
