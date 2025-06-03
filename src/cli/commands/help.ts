import chalk from "chalk"

export function showHelp(): void {
	console.log()
	console.log(chalk.cyan.bold("Roo Code Agent CLI - Help"))
	console.log()

	console.log(chalk.yellow.bold("USAGE:"))
	console.log("  roo-cli [options] [command]")
	console.log()

	console.log(chalk.yellow.bold("OPTIONS:"))
	console.log("  -c, --cwd <path>      Working directory (default: current directory)")
	console.log("  --config <path>       Configuration file path")
	console.log("  -b, --batch <task>    Run in batch mode with specified task")
	console.log("  -i, --interactive     Run in interactive mode (default)")
	console.log("  --no-color           Disable colored output")
	console.log("  -v, --verbose        Enable verbose logging")
	console.log("  -h, --help           Display help information")
	console.log("  -V, --version        Display version number")
	console.log()

	console.log(chalk.yellow.bold("COMMANDS:"))
	console.log("  help                 Show this help information")
	console.log()

	console.log(chalk.yellow.bold("INTERACTIVE MODE COMMANDS:"))
	console.log("  help                 Show available commands")
	console.log("  clear                Clear the terminal screen")
	console.log("  exit, quit           Exit the CLI")
	console.log("  <task description>   Execute a coding task")
	console.log()

	console.log(chalk.yellow.bold("EXAMPLES:"))
	console.log("  roo-cli                                    # Start interactive mode")
	console.log("  roo-cli --cwd /path/to/project            # Start in specific directory")
	console.log('  roo-cli --batch "Create a hello function"  # Run single task')
	console.log("  roo-cli --config ./roo.config.json        # Use custom config")
	console.log()

	console.log(chalk.yellow.bold("INTERACTIVE MODE:"))
	console.log("  In interactive mode, you can have a conversation with the Roo Code Agent.")
	console.log("  Simply type your requests, and the agent will help you write, debug, and")
	console.log("  improve your code using the same capabilities available in VS Code.")
	console.log()

	console.log(chalk.yellow.bold("BATCH MODE:"))
	console.log("  In batch mode, the agent will execute a single task and exit.")
	console.log("  This is useful for automation or CI/CD pipelines.")
	console.log()

	console.log(chalk.gray("For more information, visit: https://github.com/RooCodeInc/Roo-Code"))
	console.log()
}
