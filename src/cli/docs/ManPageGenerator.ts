import * as fs from "fs"
import * as path from "path"
import { CliOptions } from "../index"

interface ManPageSection {
	title: string
	content: string[]
}

export class ManPageGenerator {
	private version: string
	private date: string

	constructor() {
		this.version = this.getVersion()
		this.date = new Date().toISOString().split("T")[0]
	}

	generateManPage(): string {
		const sections: ManPageSection[] = [
			this.generateHeader(),
			this.generateName(),
			this.generateSynopsis(),
			this.generateDescription(),
			this.generateOptions(),
			this.generateCommands(),
			this.generateModes(),
			this.generateExamples(),
			this.generateFiles(),
			this.generateEnvironment(),
			this.generateExitStatus(),
			this.generateSeeAlso(),
			this.generateBugs(),
			this.generateAuthor(),
		]

		return sections.map((section) => this.formatSection(section)).join("\n\n")
	}

	async writeManPage(outputPath: string): Promise<void> {
		const manPageContent = this.generateManPage()
		await fs.promises.writeFile(outputPath, manPageContent, "utf8")
	}

	private generateHeader(): ManPageSection {
		return {
			title: "",
			content: [`.TH ROO-CLI 1 "${this.date}" "Roo CLI ${this.version}" "User Commands"`],
		}
	}

	private generateName(): ManPageSection {
		return {
			title: "NAME",
			content: ["roo-cli \\- AI-powered development assistant"],
		}
	}

	private generateSynopsis(): ManPageSection {
		return {
			title: "SYNOPSIS",
			content: [
				".B roo-cli",
				"[\\fIOPTIONS\\fR] [\\fICOMMAND\\fR] [\\fIARGS\\fR...]",
				".br",
				".B roo-cli",
				"[\\fIOPTIONS\\fR] \\fB\\-\\-batch\\fR \\fITASK\\fR",
				".br",
				".B roo-cli",
				"\\fICOMMAND\\fR \\fB\\-\\-help\\fR",
			],
		}
	}

	private generateDescription(): ManPageSection {
		return {
			title: "DESCRIPTION",
			content: [
				"Roo CLI is an AI-powered development assistant that brings the capabilities of",
				"the Roo Code VS Code extension to the command line. It provides both interactive",
				"and batch modes for AI-assisted development tasks.",
				"",
				"In interactive mode, Roo CLI provides a conversational interface for development",
				"tasks. In batch mode, it can execute single tasks or process multiple commands",
				"from files.",
				"",
				"The tool supports multiple AI models, output formats, session management,",
				"browser automation, and integration with Model Context Protocol (MCP) servers.",
			],
		}
	}

	private generateOptions(): ManPageSection {
		return {
			title: "OPTIONS",
			content: [
				'.SS "General Options"',
				".TP",
				'.BR \\-h ", " \\-\\-help',
				"Show help message and exit.",
				".TP",
				'.BR \\-V ", " \\-\\-version',
				"Show version information and exit.",
				".TP",
				'.BR \\-c ", " \\-\\-cwd " " \\fIPATH\\fR',
				"Set working directory.",
				".TP",
				'.BR \\-\\-config " " \\fIFILE\\fR',
				"Specify configuration file path.",
				".TP",
				'.BR \\-v ", " \\-\\-verbose',
				"Enable verbose logging.",
				".TP",
				'.BR \\-q ", " \\-\\-quiet',
				"Suppress non-essential output.",
				".TP",
				".BR \\-\\-no\\-color",
				"Disable colored output.",
				"",
				'.SS "Agent Options"',
				".TP",
				'.BR \\-m ", " \\-\\-model " " \\fIMODEL\\fR',
				"AI model to use (overrides config).",
				".TP",
				'.BR \\-\\-mode " " \\fIMODE\\fR',
				"Agent mode: code, debug, architect, ask, test, design-engineer, release-engineer, translate, product-owner, orchestrator.",
				"",
				'.SS "Output Options"',
				".TP",
				'.BR \\-f ", " \\-\\-format " " \\fIFORMAT\\fR',
				"Output format: json, yaml, plain, csv, markdown.",
				".TP",
				'.BR \\-o ", " \\-\\-output " " \\fIFILE\\fR',
				"Output file path.",
				".TP",
				'.BR \\-\\-color\\-scheme " " \\fISCHEME\\fR',
				"Color scheme: default, dark, light, high-contrast, minimal.",
				"",
				'.SS "Execution Options"',
				".TP",
				'.BR \\-b ", " \\-\\-batch " " \\fITASK\\fR',
				"Run in batch mode with specified task or file.",
				".TP",
				'.BR \\-i ", " \\-\\-interactive',
				"Run in interactive mode (default).",
				".TP",
				".BR \\-\\-stdin",
				"Read commands from standard input.",
				".TP",
				".BR \\-\\-yes",
				"Assume yes for all prompts.",
				".TP",
				".BR \\-\\-no",
				"Assume no for all prompts.",
				".TP",
				'.BR \\-\\-timeout " " \\fIMS\\fR',
				"Global timeout in milliseconds.",
				".TP",
				".BR \\-\\-parallel",
				"Execute commands in parallel (batch mode).",
				".TP",
				".BR \\-\\-continue\\-on\\-error",
				"Continue execution on command failure.",
				".TP",
				".BR \\-\\-dry\\-run",
				"Show what would be executed without running.",
				"",
				'.SS "Browser Options"',
				".TP",
				".BR \\-\\-headless",
				"Run browser in headless mode (default).",
				".TP",
				".BR \\-\\-no\\-headless",
				"Run browser in headed mode.",
				".TP",
				'.BR \\-\\-browser\\-viewport " " \\fISIZE\\fR',
				"Browser viewport size (e.g., 1920x1080).",
				".TP",
				'.BR \\-\\-browser\\-timeout " " \\fIMS\\fR',
				"Browser operation timeout in milliseconds.",
				".TP",
				'.BR \\-\\-screenshot\\-output " " \\fIDIR\\fR',
				"Directory for screenshot output.",
				".TP",
				'.BR \\-\\-user\\-agent " " \\fIAGENT\\fR',
				"Custom user agent string.",
				"",
				'.SS "MCP Options"',
				".TP",
				'.BR \\-\\-mcp\\-config " " \\fIPATH\\fR',
				"Path to MCP configuration file.",
				".TP",
				'.BR \\-\\-mcp\\-server " " \\fIID\\fR',
				"MCP server IDs to connect to (repeatable).",
				".TP",
				'.BR \\-\\-mcp\\-timeout " " \\fIMS\\fR',
				"Timeout for MCP operations in milliseconds.",
				".TP",
				'.BR \\-\\-mcp\\-retries " " \\fICOUNT\\fR',
				"Number of retry attempts for MCP operations.",
				".TP",
				".BR \\-\\-mcp\\-auto\\-connect",
				"Automatically connect to enabled MCP servers.",
				".TP",
				'.BR \\-\\-mcp\\-log\\-level " " \\fILEVEL\\fR',
				"MCP logging level: error, warn, info, debug.",
			],
		}
	}

	private generateCommands(): ManPageSection {
		return {
			title: "COMMANDS",
			content: [
				".TP",
				".B help [\\fITOPIC\\fR] [\\fISUBTOPIC\\fR]",
				"Show help information. Topics include commands, tools, config, and search.",
				".TP",
				".B config",
				"Manage configuration settings.",
				".TP",
				".B session",
				"Manage CLI sessions and history.",
				".TP",
				".B mcp",
				"Manage Model Context Protocol servers.",
				".TP",
				".B version",
				"Show detailed version information.",
			],
		}
	}

	private generateModes(): ManPageSection {
		return {
			title: "AGENT MODES",
			content: [
				".TP",
				".B code",
				"General coding tasks (default mode).",
				".TP",
				".B debug",
				"Debugging and troubleshooting.",
				".TP",
				".B architect",
				"Software design and architecture.",
				".TP",
				".B ask",
				"Question answering and research.",
				".TP",
				".B test",
				"Testing and quality assurance.",
				".TP",
				".B design-engineer",
				"UI/UX and design tasks.",
				".TP",
				".B release-engineer",
				"Release and deployment tasks.",
				".TP",
				".B translate",
				"Localization and translation.",
				".TP",
				".B product-owner",
				"Product management tasks.",
				".TP",
				".B orchestrator",
				"Workflow coordination.",
			],
		}
	}

	private generateExamples(): ManPageSection {
		return {
			title: "EXAMPLES",
			content: [
				".TP",
				"Start interactive mode:",
				".B roo-cli",
				".TP",
				"Run a single task:",
				'.B roo-cli \\-\\-batch "create a todo app with React"',
				".TP",
				"Analyze codebase with JSON output:",
				'.B roo-cli \\-\\-batch "analyze this codebase" \\-\\-format json \\-\\-output analysis.json',
				".TP",
				"Debug mode with verbose logging:",
				".B roo-cli \\-\\-mode debug \\-\\-verbose",
				".TP",
				"Generate configuration file:",
				".B roo-cli \\-\\-generate-config ~/.roo-cli/config.json",
				".TP",
				"Show current configuration:",
				".B roo-cli config \\-\\-show",
				".TP",
				"List saved sessions:",
				".B roo-cli session list",
				".TP",
				"Connect to MCP server:",
				".B roo-cli mcp connect github-server",
				".TP",
				"Run with custom browser settings:",
				".B roo-cli \\-\\-no-headless \\-\\-browser-viewport 1280x720",
				".TP",
				"Batch processing with file:",
				".B roo-cli \\-\\-batch tasks.json \\-\\-parallel",
				".TP",
				"Read from stdin:",
				'.B echo "npm test" | roo-cli \\-\\-stdin \\-\\-yes',
			],
		}
	}

	private generateFiles(): ManPageSection {
		return {
			title: "FILES",
			content: [
				".TP",
				".I ~/.roo-cli/config.json",
				"User configuration file.",
				".TP",
				".I .roo-cli.json",
				"Project configuration file (JSON format).",
				".TP",
				".I .roo-cli.yaml",
				"Project configuration file (YAML format).",
				".TP",
				".I ~/.roo-cli/sessions/",
				"Directory containing saved sessions.",
				".TP",
				".I ~/.roo-cli/mcp/",
				"Directory containing MCP server configurations.",
				".TP",
				".I ~/.roo-cli/logs/",
				"Directory containing log files.",
			],
		}
	}

	private generateEnvironment(): ManPageSection {
		return {
			title: "ENVIRONMENT",
			content: [
				".TP",
				".B ROO_API_KEY",
				"Anthropic API key (required).",
				".TP",
				".B ROO_CONFIG_PATH",
				"Path to configuration file.",
				".TP",
				".B ROO_MODEL",
				"Default AI model to use.",
				".TP",
				".B ROO_MODE",
				"Default agent mode.",
				".TP",
				".B ROO_OUTPUT_FORMAT",
				"Default output format.",
				".TP",
				".B ROO_VERBOSE",
				"Enable verbose logging (true/false).",
				".TP",
				".B ROO_QUIET",
				"Suppress non-essential output (true/false).",
				".TP",
				".B ROO_COLOR",
				"Enable colored output (true/false).",
				".TP",
				".B ROO_BROWSER_HEADLESS",
				"Run browser in headless mode (true/false).",
				".TP",
				".B ROO_MCP_AUTO_CONNECT",
				"Automatically connect to MCP servers (true/false).",
			],
		}
	}

	private generateExitStatus(): ManPageSection {
		return {
			title: "EXIT STATUS",
			content: [
				".TP",
				".B 0",
				"Success.",
				".TP",
				".B 1",
				"General error.",
				".TP",
				".B 2",
				"Configuration error.",
				".TP",
				".B 3",
				"API error.",
				".TP",
				".B 4",
				"File system error.",
				".TP",
				".B 5",
				"Network error.",
				".TP",
				".B 6",
				"Timeout error.",
				".TP",
				".B 130",
				"Interrupted by user (Ctrl+C).",
			],
		}
	}

	private generateSeeAlso(): ManPageSection {
		return {
			title: "SEE ALSO",
			content: [
				".BR node (1),",
				".BR npm (1),",
				".BR git (1)",
				"",
				"Online documentation: https://docs.roocode.com/cli",
				"",
				"GitHub repository: https://github.com/roo-dev/roo",
			],
		}
	}

	private generateBugs(): ManPageSection {
		return {
			title: "BUGS",
			content: [
				"Report bugs at: https://github.com/roo-dev/roo/issues",
				"",
				"When reporting bugs, please include:",
				"- Roo CLI version (roo-cli --version)",
				"- Operating system and version",
				"- Node.js version",
				"- Configuration file (without API keys)",
				"- Steps to reproduce the issue",
				"- Expected vs actual behavior",
			],
		}
	}

	private generateAuthor(): ManPageSection {
		return {
			title: "AUTHOR",
			content: [
				"Roo Development Team",
				"",
				"For more information about the team and project, visit:",
				"https://roocode.com",
			],
		}
	}

	private formatSection(section: ManPageSection): string {
		if (!section.title) {
			return section.content.join("\n")
		}

		return `.SH ${section.title}\n${section.content.join("\n")}`
	}

	private getVersion(): string {
		try {
			const packagePath = path.join(__dirname, "../../package.json")
			const packageContent = fs.readFileSync(packagePath, "utf8")
			const packageJson = JSON.parse(packageContent)
			return packageJson.version || "1.0.0"
		} catch (error) {
			return "1.0.0"
		}
	}

	// Generate completion for installation
	async generateManPageForInstallation(outputDir: string): Promise<void> {
		const manPageContent = this.generateManPage()
		const manPagePath = path.join(outputDir, "roo-cli.1")

		// Create directory if it doesn't exist
		await fs.promises.mkdir(outputDir, { recursive: true })

		// Write man page
		await fs.promises.writeFile(manPagePath, manPageContent, "utf8")

		console.log(`Man page generated: ${manPagePath}`)
		console.log("To install system-wide:")
		console.log(`  sudo cp ${manPagePath} /usr/local/man/man1/`)
		console.log("  sudo mandb")
		console.log("To view: man roo-cli")
	}
}
