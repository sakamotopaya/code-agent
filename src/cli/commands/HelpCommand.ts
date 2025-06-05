import chalk from "chalk"
import { Command } from "commander"

interface IHelpCommand {
	showGeneralHelp(): void
	showCommandHelp(command: string): void
	showToolHelp(tool: string): void
	showConfigHelp(): void
	searchHelp(query: string): void
}

interface CommandInfo {
	name: string
	description: string
	usage: string
	options: Array<{
		flag: string
		description: string
	}>
	examples: Array<{
		command: string
		description: string
	}>
	relatedCommands: string[]
}

interface ToolInfo {
	name: string
	description: string
	parameters: Array<{
		name: string
		type: string
		required: boolean
		description: string
	}>
	examples: Array<{
		usage: string
		description: string
	}>
	category: string
}

export class HelpCommand implements IHelpCommand {
	private commands: Map<string, CommandInfo> = new Map()
	private tools: Map<string, ToolInfo> = new Map()

	constructor() {
		this.initializeCommands()
		this.initializeTools()
	}

	showGeneralHelp(): void {
		console.log(chalk.cyan.bold("🤖 Roo CLI - AI-powered development assistant"))
		console.log()
		console.log(chalk.white.bold("USAGE:"))
		console.log("  roo-cli [OPTIONS] [COMMAND] [ARGS...]")
		console.log("  roo-cli [OPTIONS] --batch <task>")
		console.log()

		console.log(chalk.white.bold("COMMANDS:"))
		console.log("  help              Show this help message or help for specific command")
		console.log("  config            Manage configuration settings")
		console.log("  session           Manage CLI sessions")
		console.log("  mcp               Manage MCP (Model Context Protocol) servers")
		console.log("  version           Show version information")
		console.log()

		console.log(chalk.white.bold("COMMON OPTIONS:"))
		console.log("  --help, -h        Show help")
		console.log("  --version, -v     Show version")
		console.log("  --config, -c      Specify config file")
		console.log("  --cwd <path>      Working directory")
		console.log("  --mode <mode>     Agent mode (code, debug, architect, etc.)")
		console.log("  --format, -f      Output format (json|yaml|plain|csv|markdown)")
		console.log("  --output, -o      Output file path")
		console.log("  --verbose         Enable verbose logging")
		console.log("  --quiet, -q       Suppress non-essential output")
		console.log("  --no-color        Disable colored output")
		console.log()

		console.log(chalk.white.bold("MODES:"))
		console.log("  code              General coding tasks (default)")
		console.log("  debug             Debugging and troubleshooting")
		console.log("  architect         Software design and architecture")
		console.log("  ask               Question answering and research")
		console.log("  test              Testing and quality assurance")
		console.log("  design-engineer   UI/UX and design tasks")
		console.log("  release-engineer  Release and deployment tasks")
		console.log("  translate         Localization and translation")
		console.log("  product-owner     Product management tasks")
		console.log("  orchestrator      Workflow coordination")
		console.log()

		console.log(chalk.white.bold("EXAMPLES:"))
		console.log("  roo-cli                                    # Start interactive mode")
		console.log('  roo-cli --batch "create a todo app"       # Run single task')
		console.log("  roo-cli --mode debug --verbose            # Debug mode with logging")
		console.log("  roo-cli --format json --output result.json # Save as JSON")
		console.log("  roo-cli config --show                     # Show configuration")
		console.log("  roo-cli session list                      # List saved sessions")
		console.log("  roo-cli mcp list                          # List MCP servers")
		console.log()

		console.log(chalk.white.bold("GETTING HELP:"))
		console.log("  roo-cli help <command>                    # Help for specific command")
		console.log("  roo-cli help tools                        # List available tools")
		console.log("  roo-cli help config                       # Configuration help")
		console.log("  roo-cli help search <query>               # Search help topics")
		console.log()

		console.log(chalk.gray("For more information, visit: https://docs.roocode.com/cli"))
	}

	showCommandHelp(command: string): void {
		const commandInfo = this.commands.get(command.toLowerCase())
		if (commandInfo) {
			console.log(chalk.cyan.bold(`Command: ${commandInfo.name}`))
			console.log()
			console.log(chalk.white("Description:"))
			console.log(`  ${commandInfo.description}`)
			console.log()

			console.log(chalk.white("Usage:"))
			console.log(`  ${commandInfo.usage}`)
			console.log()

			if (commandInfo.options.length > 0) {
				console.log(chalk.white("Options:"))
				commandInfo.options.forEach((opt) => {
					console.log(`  ${chalk.yellow(opt.flag.padEnd(20))} ${opt.description}`)
				})
				console.log()
			}

			if (commandInfo.examples.length > 0) {
				console.log(chalk.white("Examples:"))
				commandInfo.examples.forEach((ex) => {
					console.log(`  ${chalk.green(ex.command)}`)
					console.log(`    ${chalk.gray(ex.description)}`)
					console.log()
				})
			}

			if (commandInfo.relatedCommands.length > 0) {
				console.log(chalk.white("See Also:"))
				commandInfo.relatedCommands.forEach((cmd) => {
					console.log(`  ${chalk.cyan(cmd)}`)
				})
				console.log()
			}
		} else {
			console.log(chalk.red(`No help available for command: ${command}`))
			this.suggestSimilarCommands(command)
		}
	}

	showToolHelp(tool: string): void {
		if (tool === "list" || tool === "") {
			this.showToolsList()
			return
		}

		const toolInfo = this.tools.get(tool.toLowerCase())
		if (toolInfo) {
			console.log(chalk.cyan.bold(`Tool: ${toolInfo.name}`))
			console.log(chalk.gray(`Category: ${toolInfo.category}`))
			console.log()
			console.log(chalk.white("Description:"))
			console.log(`  ${toolInfo.description}`)
			console.log()

			if (toolInfo.parameters.length > 0) {
				console.log(chalk.white("Parameters:"))
				toolInfo.parameters.forEach((param) => {
					const required = param.required ? chalk.red("*") : " "
					const type = chalk.blue(`(${param.type})`)
					console.log(`  ${required}${chalk.yellow(param.name.padEnd(15))} ${type} ${param.description}`)
				})
				console.log()
				console.log(chalk.gray("* Required parameters"))
				console.log()
			}

			if (toolInfo.examples.length > 0) {
				console.log(chalk.white("Examples:"))
				toolInfo.examples.forEach((ex) => {
					console.log(`  ${chalk.green(ex.usage)}`)
					console.log(`    ${chalk.gray(ex.description)}`)
					console.log()
				})
			}
		} else {
			console.log(chalk.red(`No help available for tool: ${tool}`))
			this.suggestSimilarTools(tool)
		}
	}

	showConfigHelp(): void {
		console.log(chalk.cyan.bold("Configuration Help"))
		console.log()
		console.log(chalk.white("Configuration Priority (highest to lowest):"))
		console.log("  1. Command-line arguments")
		console.log("  2. Environment variables")
		console.log("  3. Project config file (.roo-cli.json)")
		console.log("  4. User config file (~/.roo-cli/config.json)")
		console.log("  5. Default values")
		console.log()

		console.log(chalk.white("Configuration Files:"))
		console.log("  Project:  .roo-cli.json, .roo-cli.yaml, .roo-cli.yml")
		console.log("  User:     ~/.roo-cli/config.json")
		console.log("  Custom:   --config <path>")
		console.log()

		console.log(chalk.white("Environment Variables:"))
		console.log("  ROO_API_KEY         Anthropic API key")
		console.log("  ROO_MODEL           AI model to use")
		console.log("  ROO_MODE            Agent mode")
		console.log("  ROO_OUTPUT_FORMAT   Output format")
		console.log("  ROO_CONFIG_PATH     Custom config path")
		console.log()

		console.log(chalk.white("Common Commands:"))
		console.log("  roo-cli config --show                     # Show current config")
		console.log("  roo-cli config --validate <path>          # Validate config file")
		console.log("  roo-cli --generate-config <path>          # Generate default config")
		console.log()

		console.log(chalk.white("More Information:"))
		console.log("  Documentation: https://docs.roocode.com/cli/configuration")
		console.log("  Examples:      roo-cli help config examples")
	}

	searchHelp(query: string): void {
		console.log(chalk.cyan.bold(`Search Results for: "${query}"`))
		console.log()

		const results: Array<{ type: string; name: string; description: string }> = []

		// Search commands
		for (const [name, info] of this.commands) {
			if (this.matchesQuery(query, name, info.description, info.usage)) {
				results.push({
					type: "Command",
					name: info.name,
					description: info.description,
				})
			}
		}

		// Search tools
		for (const [name, info] of this.tools) {
			if (this.matchesQuery(query, name, info.description, info.category)) {
				results.push({
					type: "Tool",
					name: info.name,
					description: info.description,
				})
			}
		}

		// Search topics
		const topics = this.getHelpTopics()
		for (const topic of topics) {
			if (this.matchesQuery(query, topic.name, topic.description, topic.keywords.join(" "))) {
				results.push({
					type: "Topic",
					name: topic.name,
					description: topic.description,
				})
			}
		}

		if (results.length === 0) {
			console.log(chalk.yellow("No results found."))
			console.log()
			console.log("Try searching for:")
			console.log("  - Command names (config, session, mcp)")
			console.log("  - Tool categories (file, browser, terminal)")
			console.log("  - Topics (configuration, troubleshooting)")
		} else {
			results.forEach((result) => {
				console.log(`${chalk.green(result.type.padEnd(8))} ${chalk.cyan(result.name)}`)
				console.log(`         ${chalk.gray(result.description)}`)
				console.log()
			})

			console.log(chalk.white("Use 'roo-cli help <name>' for detailed information."))
		}
	}

	private showToolsList(): void {
		console.log(chalk.cyan.bold("Available Tools"))
		console.log()

		const categories = new Map<string, ToolInfo[]>()
		for (const [, tool] of this.tools) {
			if (!categories.has(tool.category)) {
				categories.set(tool.category, [])
			}
			categories.get(tool.category)!.push(tool)
		}

		for (const [category, tools] of categories) {
			console.log(chalk.white.bold(`${category}:`))
			tools.forEach((tool) => {
				console.log(`  ${chalk.cyan(tool.name.padEnd(20))} ${chalk.gray(tool.description)}`)
			})
			console.log()
		}

		console.log(chalk.white("Use 'roo-cli help tools <tool-name>' for detailed information."))
	}

	private suggestSimilarCommands(command: string): void {
		const suggestions = this.findSimilar(command, Array.from(this.commands.keys()))
		if (suggestions.length > 0) {
			console.log()
			console.log(chalk.yellow("Did you mean:"))
			suggestions.slice(0, 3).forEach((suggestion) => {
				console.log(`  ${chalk.cyan(suggestion)}`)
			})
		}
		console.log()
		console.log("Use 'roo-cli help' to see all available commands.")
	}

	private suggestSimilarTools(tool: string): void {
		const suggestions = this.findSimilar(tool, Array.from(this.tools.keys()))
		if (suggestions.length > 0) {
			console.log()
			console.log(chalk.yellow("Did you mean:"))
			suggestions.slice(0, 3).forEach((suggestion) => {
				console.log(`  ${chalk.cyan(suggestion)}`)
			})
		}
		console.log()
		console.log("Use 'roo-cli help tools' to see all available tools.")
	}

	private findSimilar(target: string, candidates: string[]): string[] {
		return candidates
			.map((candidate) => ({
				name: candidate,
				score: this.calculateSimilarity(target.toLowerCase(), candidate.toLowerCase()),
			}))
			.filter((item) => item.score > 0.3)
			.sort((a, b) => b.score - a.score)
			.map((item) => item.name)
	}

	private calculateSimilarity(a: string, b: string): number {
		if (a === b) return 1
		if (a.includes(b) || b.includes(a)) return 0.8

		const longer = a.length > b.length ? a : b
		const shorter = a.length > b.length ? b : a

		if (longer.length === 0) return 1

		return (longer.length - this.editDistance(longer, shorter)) / longer.length
	}

	private editDistance(a: string, b: string): number {
		const matrix = Array(b.length + 1)
			.fill(null)
			.map(() => Array(a.length + 1).fill(null))

		for (let i = 0; i <= a.length; i++) matrix[0][i] = i
		for (let j = 0; j <= b.length; j++) matrix[j][0] = j

		for (let j = 1; j <= b.length; j++) {
			for (let i = 1; i <= a.length; i++) {
				const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1
				matrix[j][i] = Math.min(
					matrix[j][i - 1] + 1,
					matrix[j - 1][i] + 1,
					matrix[j - 1][i - 1] + substitutionCost,
				)
			}
		}

		return matrix[b.length][a.length]
	}

	private matchesQuery(query: string, ...searchableText: string[]): boolean {
		const normalizedQuery = query.toLowerCase()
		return searchableText.some((text) => text.toLowerCase().includes(normalizedQuery))
	}

	private getHelpTopics() {
		return [
			{
				name: "configuration",
				description: "Setting up and managing configuration",
				keywords: ["config", "setup", "api", "key", "settings"],
			},
			{
				name: "modes",
				description: "Different agent modes and their uses",
				keywords: ["mode", "agent", "code", "debug", "architect"],
			},
			{
				name: "formats",
				description: "Output formats and data export",
				keywords: ["format", "output", "json", "yaml", "csv"],
			},
			{
				name: "sessions",
				description: "Session management and persistence",
				keywords: ["session", "save", "load", "history"],
			},
			{
				name: "mcp",
				description: "Model Context Protocol integration",
				keywords: ["mcp", "server", "protocol", "tools"],
			},
			{
				name: "browser",
				description: "Browser automation and web tasks",
				keywords: ["browser", "web", "automation", "headless"],
			},
			{
				name: "troubleshooting",
				description: "Common issues and solutions",
				keywords: ["error", "debug", "problem", "issue", "fix"],
			},
		]
	}

	private initializeCommands(): void {
		this.commands.set("config", {
			name: "config",
			description: "Manage configuration settings",
			usage: "roo-cli config [--show|--validate <path>|--generate <path>]",
			options: [
				{ flag: "--show", description: "Show current configuration" },
				{ flag: "--validate <path>", description: "Validate configuration file" },
				{ flag: "--generate <path>", description: "Generate default configuration" },
			],
			examples: [
				{
					command: "roo-cli config --show",
					description: "Display current configuration settings",
				},
				{
					command: "roo-cli config --validate ./config.json",
					description: "Validate a configuration file",
				},
				{
					command: "roo-cli --generate-config ~/.roo-cli/config.json",
					description: "Generate default configuration",
				},
			],
			relatedCommands: ["help config"],
		})

		this.commands.set("session", {
			name: "session",
			description: "Manage CLI sessions and history",
			usage: "roo-cli session <command> [options]",
			options: [
				{ flag: "list", description: "List all saved sessions" },
				{ flag: "save <name>", description: "Save current session" },
				{ flag: "load <id>", description: "Load a saved session" },
				{ flag: "delete <id>", description: "Delete a session" },
				{ flag: "export <id>", description: "Export session to file" },
				{ flag: "import <file>", description: "Import session from file" },
				{ flag: "cleanup", description: "Clean up old sessions" },
			],
			examples: [
				{
					command: "roo-cli session list",
					description: "Show all saved sessions",
				},
				{
					command: "roo-cli session save 'My Project'",
					description: "Save current session with a name",
				},
				{
					command: "roo-cli session load abc123",
					description: "Load session by ID",
				},
			],
			relatedCommands: ["help"],
		})

		this.commands.set("mcp", {
			name: "mcp",
			description: "Manage Model Context Protocol servers",
			usage: "roo-cli mcp <command> [options]",
			options: [
				{ flag: "list", description: "List configured MCP servers" },
				{ flag: "connect <id>", description: "Connect to an MCP server" },
				{ flag: "disconnect <id>", description: "Disconnect from an MCP server" },
				{ flag: "tools [server]", description: "List available tools" },
				{ flag: "resources [server]", description: "List available resources" },
				{ flag: "execute <server> <tool>", description: "Execute an MCP tool" },
			],
			examples: [
				{
					command: "roo-cli mcp list",
					description: "Show all configured MCP servers",
				},
				{
					command: "roo-cli mcp connect github-server",
					description: "Connect to the GitHub MCP server",
				},
				{
					command: "roo-cli mcp tools github-server",
					description: "List tools available from GitHub server",
				},
			],
			relatedCommands: ["help mcp"],
		})
	}

	private initializeTools(): void {
		this.tools.set("read_file", {
			name: "read_file",
			description: "Read and analyze file contents",
			category: "File Operations",
			parameters: [
				{ name: "path", type: "string", required: true, description: "File path to read" },
				{
					name: "line_range",
					type: "string",
					required: false,
					description: "Specific lines to read (e.g., '1-10')",
				},
			],
			examples: [
				{
					usage: "read_file src/main.py",
					description: "Read the entire main.py file",
				},
				{
					usage: "read_file config.json 1-20",
					description: "Read lines 1-20 of config.json",
				},
			],
		})

		this.tools.set("write_to_file", {
			name: "write_to_file",
			description: "Create or overwrite files with content",
			category: "File Operations",
			parameters: [
				{ name: "path", type: "string", required: true, description: "File path to write" },
				{ name: "content", type: "string", required: true, description: "Content to write" },
			],
			examples: [
				{
					usage: "write_to_file README.md '# My Project\\nThis is a sample project.'",
					description: "Create a README.md file",
				},
			],
		})

		this.tools.set("execute_command", {
			name: "execute_command",
			description: "Execute command line operations",
			category: "Terminal Tools",
			parameters: [
				{ name: "command", type: "string", required: true, description: "Command to execute" },
				{ name: "cwd", type: "string", required: false, description: "Working directory" },
			],
			examples: [
				{
					usage: "execute_command 'npm test'",
					description: "Run npm tests",
				},
				{
					usage: "execute_command 'ls -la' /home/user",
					description: "List files in specific directory",
				},
			],
		})

		this.tools.set("browser_action", {
			name: "browser_action",
			description: "Control web browser for automation",
			category: "Browser Tools",
			parameters: [
				{
					name: "action",
					type: "string",
					required: true,
					description: "Action to perform (launch, click, type, etc.)",
				},
				{ name: "url", type: "string", required: false, description: "URL for launch action" },
				{ name: "coordinate", type: "string", required: false, description: "X,Y coordinates for click/hover" },
				{ name: "text", type: "string", required: false, description: "Text to type" },
			],
			examples: [
				{
					usage: "browser_action launch https://example.com",
					description: "Open a website",
				},
				{
					usage: "browser_action click 450,300",
					description: "Click at specific coordinates",
				},
			],
		})
	}
}
