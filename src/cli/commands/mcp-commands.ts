import { Command } from "commander"
import chalk from "chalk"
import { CLIMcpService } from "../services/CLIMcpService"
import { McpServerConfig, McpConnectionError, McpConfigurationError } from "../types/mcp-types"
import { McpConfigFile, DEFAULT_MCP_CONFIG, EXAMPLE_SERVERS, MCP_CONFIG_FILENAME } from "../types/mcp-config-types"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

export interface McpCommands {
	// roo mcp list
	listServers(): Promise<void>

	// roo mcp connect <server-id>
	connectServer(serverId: string): Promise<void>

	// roo mcp disconnect <server-id>
	disconnectServer(serverId: string): Promise<void>

	// roo mcp tools [server-id]
	listTools(serverId?: string): Promise<void>

	// roo mcp resources [server-id]
	listResources(serverId?: string): Promise<void>

	// roo mcp execute <server-id> <tool-name> [args...]
	executeTool(serverId: string, toolName: string, args: string[]): Promise<void>

	// roo mcp config validate [config-file]
	validateConfig(configFile?: string): Promise<void>

	// roo mcp config init [config-file]
	initConfig(configFile?: string): Promise<void>

	// roo mcp config show [config-file]
	showConfig(configFile?: string): Promise<void>
}

export class CLIMcpCommands implements McpCommands {
	private mcpService: CLIMcpService

	constructor(configPath?: string) {
		this.mcpService = new CLIMcpService(configPath)
	}

	async listServers(): Promise<void> {
		try {
			console.log(chalk.blue("📡 Discovering MCP servers..."))
			const servers = await this.mcpService.discoverServers()

			if (servers.length === 0) {
				console.log(chalk.yellow("No MCP servers configured."))
				console.log(chalk.gray('Use "roo mcp config init" to create a configuration file.'))
				return
			}

			console.log(chalk.green(`\n📋 Found ${servers.length} MCP server(s):\n`))

			for (const server of servers) {
				const statusIcon = this.getStatusIcon(server.status)
				const statusColor = this.getStatusColor(server.status)

				console.log(chalk.bold(`${statusIcon} ${server.name} (${server.id})`))
				console.log(chalk.gray(`   Status: ${statusColor(server.status)}`))
				console.log(chalk.gray(`   Tools: ${server.tools.length}`))
				console.log(chalk.gray(`   Resources: ${server.resources.length}`))

				if (server.lastConnected) {
					const lastConnected = new Date(server.lastConnected).toLocaleString()
					console.log(chalk.gray(`   Last Connected: ${lastConnected}`))
				}

				console.log() // Empty line
			}
		} catch (error) {
			console.error(chalk.red("❌ Error listing servers:"), error.message)
			process.exit(1)
		}
	}

	async connectServer(serverId: string): Promise<void> {
		try {
			console.log(chalk.blue(`🔗 Connecting to server: ${serverId}`))

			const configs = await this.mcpService.loadServerConfigs()
			const config = configs.find((c) => c.id === serverId)

			if (!config) {
				console.error(chalk.red(`❌ Server ${serverId} not found in configuration`))
				process.exit(1)
			}

			if (!config.enabled) {
				console.error(chalk.red(`❌ Server ${serverId} is disabled`))
				process.exit(1)
			}

			const connection = await this.mcpService.connectToServer(config)
			console.log(chalk.green(`✅ Successfully connected to ${config.name}`))

			// Show server capabilities
			const servers = await this.mcpService.discoverServers()
			const serverInfo = servers.find((s) => s.id === serverId)
			if (serverInfo) {
				console.log(chalk.gray(`   Tools available: ${serverInfo.tools.length}`))
				console.log(chalk.gray(`   Resources available: ${serverInfo.resources.length}`))
			}
		} catch (error) {
			if (error instanceof McpConnectionError) {
				console.error(chalk.red("❌ Connection failed:"), error.message)
			} else {
				console.error(chalk.red("❌ Unexpected error:"), error.message)
			}
			process.exit(1)
		}
	}

	async disconnectServer(serverId: string): Promise<void> {
		try {
			console.log(chalk.blue(`🔌 Disconnecting from server: ${serverId}`))
			await this.mcpService.disconnectFromServer(serverId)
			console.log(chalk.green(`✅ Successfully disconnected from ${serverId}`))
		} catch (error) {
			console.error(chalk.red("❌ Error disconnecting:"), error.message)
			process.exit(1)
		}
	}

	async listTools(serverId?: string): Promise<void> {
		try {
			console.log(chalk.blue("🔧 Listing available tools..."))

			let tools = await this.mcpService.listAvailableTools()

			if (serverId) {
				tools = tools.filter((tool) => tool.serverId === serverId)
			}

			if (tools.length === 0) {
				if (serverId) {
					console.log(chalk.yellow(`No tools available for server: ${serverId}`))
				} else {
					console.log(chalk.yellow("No tools available from connected servers."))
				}
				return
			}

			console.log(chalk.green(`\n🔨 Found ${tools.length} tool(s):\n`))

			// Group tools by server
			const toolsByServer = tools.reduce(
				(acc, tool) => {
					if (!acc[tool.serverId]) {
						acc[tool.serverId] = []
					}
					acc[tool.serverId].push(tool)
					return acc
				},
				{} as Record<string, typeof tools>,
			)

			for (const [serverIdKey, serverTools] of Object.entries(toolsByServer)) {
				console.log(chalk.bold.cyan(`📡 ${serverIdKey}:`))

				for (const tool of serverTools) {
					console.log(`  • ${chalk.green(tool.name)}`)
					if (tool.description) {
						console.log(`    ${chalk.gray(tool.description)}`)
					}
					if (tool.inputSchema) {
						console.log(
							`    ${chalk.dim("Schema: " + JSON.stringify(tool.inputSchema, null, 2).split("\n")[0] + "...")}`,
						)
					}
				}
				console.log()
			}
		} catch (error) {
			console.error(chalk.red("❌ Error listing tools:"), error.message)
			process.exit(1)
		}
	}

	async listResources(serverId?: string): Promise<void> {
		try {
			console.log(chalk.blue("📚 Listing available resources..."))

			let resources = await this.mcpService.listAvailableResources()

			if (serverId) {
				resources = resources.filter((resource) => resource.serverId === serverId)
			}

			if (resources.length === 0) {
				if (serverId) {
					console.log(chalk.yellow(`No resources available for server: ${serverId}`))
				} else {
					console.log(chalk.yellow("No resources available from connected servers."))
				}
				return
			}

			console.log(chalk.green(`\n📂 Found ${resources.length} resource(s):\n`))

			// Group resources by server
			const resourcesByServer = resources.reduce(
				(acc, resource) => {
					if (!acc[resource.serverId]) {
						acc[resource.serverId] = []
					}
					acc[resource.serverId].push(resource)
					return acc
				},
				{} as Record<string, typeof resources>,
			)

			for (const [serverIdKey, serverResources] of Object.entries(resourcesByServer)) {
				console.log(chalk.bold.cyan(`📡 ${serverIdKey}:`))

				for (const resource of serverResources) {
					console.log(`  • ${chalk.green(resource.name)}`)
					console.log(`    ${chalk.gray("URI:")} ${resource.uri}`)
					if (resource.description) {
						console.log(`    ${chalk.gray(resource.description)}`)
					}
					if (resource.mimeType) {
						console.log(`    ${chalk.dim("MIME Type:")} ${resource.mimeType}`)
					}
				}
				console.log()
			}
		} catch (error) {
			console.error(chalk.red("❌ Error listing resources:"), error.message)
			process.exit(1)
		}
	}

	async executeTool(serverId: string, toolName: string, args: string[]): Promise<void> {
		try {
			console.log(chalk.blue(`⚙️ Executing tool: ${toolName} on server: ${serverId}`))

			// Parse arguments - assume they are JSON strings or key=value pairs
			const parsedArgs = this.parseToolArguments(args)

			// Validate parameters
			const isValid = this.mcpService.validateToolParameters(serverId, toolName, parsedArgs)
			if (!isValid) {
				console.error(chalk.red("❌ Invalid tool parameters"))
				process.exit(1)
			}

			const result = await this.mcpService.executeTool(serverId, toolName, parsedArgs)

			if (result.success) {
				console.log(chalk.green("✅ Tool executed successfully"))

				if (result.result) {
					console.log(chalk.bold("\n📄 Result:"))
					this.formatToolResult(result.result)
				}

				if (result.metadata) {
					console.log(chalk.dim("\n📊 Metadata:"))
					console.log(chalk.dim(JSON.stringify(result.metadata, null, 2)))
				}
			} else {
				console.error(chalk.red("❌ Tool execution failed"))
				if (result.error) {
					console.error(chalk.red(result.error))
				}
				process.exit(1)
			}
		} catch (error) {
			console.error(chalk.red("❌ Error executing tool:"), error.message)
			process.exit(1)
		}
	}

	async validateConfig(configFile?: string): Promise<void> {
		try {
			console.log(chalk.blue("🔍 Validating MCP configuration..."))

			const configs = await this.mcpService.loadServerConfigs(configFile)
			let hasErrors = false
			let totalWarnings = 0

			console.log(chalk.green(`\n📋 Validating ${configs.length} server configuration(s):\n`))

			for (const config of configs) {
				const validation = this.mcpService.validateServerConfig(config)

				if (validation.valid) {
					console.log(chalk.green(`✅ ${config.name} (${config.id}): Valid`))
				} else {
					console.log(chalk.red(`❌ ${config.name} (${config.id}): Invalid`))
					hasErrors = true

					for (const error of validation.errors) {
						console.log(chalk.red(`   • ${error}`))
					}
				}

				if (validation.warnings.length > 0) {
					totalWarnings += validation.warnings.length
					for (const warning of validation.warnings) {
						console.log(chalk.yellow(`   ⚠️  ${warning}`))
					}
				}
			}

			console.log()
			if (hasErrors) {
				console.log(chalk.red("❌ Configuration validation failed"))
				process.exit(1)
			} else {
				console.log(chalk.green("✅ Configuration validation passed"))
				if (totalWarnings > 0) {
					console.log(chalk.yellow(`⚠️  ${totalWarnings} warning(s) found`))
				}
			}
		} catch (error) {
			if (error instanceof McpConfigurationError) {
				console.error(chalk.red("❌ Configuration error:"), error.message)
			} else {
				console.error(chalk.red("❌ Validation error:"), error.message)
			}
			process.exit(1)
		}
	}

	async initConfig(configFile?: string): Promise<void> {
		try {
			const configPath = configFile || path.join(os.homedir(), ".roo", MCP_CONFIG_FILENAME)

			// Check if config already exists
			try {
				await fs.access(configPath)
				console.log(chalk.yellow(`⚠️  Configuration file already exists: ${configPath}`))
				console.log(chalk.gray('Use "roo mcp config show" to view the current configuration.'))
				return
			} catch {
				// Config doesn't exist, we can create it
			}

			// Ensure directory exists
			await fs.mkdir(path.dirname(configPath), { recursive: true })

			// Create example configuration
			const exampleConfig: McpConfigFile = {
				version: "1.0.0",
				servers: EXAMPLE_SERVERS,
				defaults: DEFAULT_MCP_CONFIG,
			}

			await fs.writeFile(configPath, JSON.stringify(exampleConfig, null, 2))

			console.log(chalk.green(`✅ Created MCP configuration file: ${configPath}`))
			console.log(chalk.gray("\n📝 The configuration includes example servers."))
			console.log(chalk.gray("Edit the file to customize your MCP server configurations."))
			console.log(chalk.gray("\n🔧 Available commands:"))
			console.log(chalk.gray("  • roo mcp config validate    - Validate configuration"))
			console.log(chalk.gray("  • roo mcp config show        - Show current configuration"))
			console.log(chalk.gray("  • roo mcp list               - List configured servers"))
		} catch (error) {
			console.error(chalk.red("❌ Error creating configuration:"), error.message)
			process.exit(1)
		}
	}

	async showConfig(configFile?: string): Promise<void> {
		try {
			console.log(chalk.blue("📄 Current MCP configuration:"))

			const configs = await this.mcpService.loadServerConfigs(configFile)

			if (configs.length === 0) {
				console.log(chalk.yellow("\nNo MCP servers configured."))
				console.log(chalk.gray('Use "roo mcp config init" to create a configuration file.'))
				return
			}

			console.log(chalk.green(`\n📋 ${configs.length} server(s) configured:\n`))

			for (const config of configs) {
				console.log(chalk.bold(`🖥️  ${config.name} (${config.id})`))
				console.log(chalk.gray(`   Type: ${config.type}`))
				console.log(chalk.gray(`   Enabled: ${config.enabled ? "Yes" : "No"}`))

				if (config.type === "stdio") {
					console.log(chalk.gray(`   Command: ${config.command}`))
					if (config.args?.length) {
						console.log(chalk.gray(`   Args: ${config.args.join(" ")}`))
					}
				} else if (config.type === "sse") {
					console.log(chalk.gray(`   URL: ${config.url}`))
				}

				console.log(chalk.gray(`   Timeout: ${config.timeout}ms`))
				console.log(chalk.gray(`   Retry Attempts: ${config.retryAttempts}`))
				console.log()
			}
		} catch (error) {
			if (error.code === "ENOENT") {
				console.log(chalk.yellow("No MCP configuration file found."))
				console.log(chalk.gray('Use "roo mcp config init" to create one.'))
			} else {
				console.error(chalk.red("❌ Error reading configuration:"), error.message)
				process.exit(1)
			}
		}
	}

	async dispose(): Promise<void> {
		await this.mcpService.dispose()
	}

	private getStatusIcon(status: string): string {
		switch (status) {
			case "connected":
				return "🟢"
			case "connecting":
				return "🟡"
			case "disconnected":
				return "⚪"
			case "error":
				return "🔴"
			case "retrying":
				return "🟠"
			default:
				return "❓"
		}
	}

	private getStatusColor(status: string): (text: string) => string {
		switch (status) {
			case "connected":
				return chalk.green
			case "connecting":
				return chalk.yellow
			case "disconnected":
				return chalk.gray
			case "error":
				return chalk.red
			case "retrying":
				return chalk.yellow
			default:
				return chalk.white
		}
	}

	private parseToolArguments(args: string[]): any {
		if (args.length === 0) {
			return {}
		}

		// Try to parse as JSON first
		if (args.length === 1) {
			try {
				return JSON.parse(args[0])
			} catch {
				// Not JSON, continue with key=value parsing
			}
		}

		// Parse as key=value pairs
		const result: any = {}
		for (const arg of args) {
			const [key, ...valueParts] = arg.split("=")
			if (valueParts.length > 0) {
				const value = valueParts.join("=")
				// Try to parse as JSON value, otherwise use as string
				try {
					result[key] = JSON.parse(value)
				} catch {
					result[key] = value
				}
			}
		}

		return result
	}

	private formatToolResult(result: any): void {
		if (Array.isArray(result)) {
			for (const item of result) {
				this.formatToolResultItem(item)
			}
		} else {
			this.formatToolResultItem(result)
		}
	}

	private formatToolResultItem(item: any): void {
		if (item.type === "text") {
			console.log(item.text)
		} else if (item.type === "image") {
			console.log(chalk.blue(`🖼️  Image (${item.mimeType})`))
			console.log(chalk.gray(`   Data: ${item.data.substring(0, 50)}...`))
		} else if (item.type === "resource") {
			console.log(chalk.cyan(`📁 Resource: ${item.resource.uri}`))
			if (item.resource.text) {
				console.log(item.resource.text)
			}
		} else {
			console.log(JSON.stringify(item, null, 2))
		}
	}
}

export function registerMcpCommands(program: Command, configPath?: string): void {
	const mcpCommands = new CLIMcpCommands(configPath)

	const mcpCommand = program.command("mcp").description("MCP (Model Context Protocol) server management")

	mcpCommand
		.command("list")
		.alias("ls")
		.description("List configured MCP servers and their status")
		.action(async () => {
			try {
				await mcpCommands.listServers()
			} finally {
				await mcpCommands.dispose()
			}
		})

	mcpCommand
		.command("connect <server-id>")
		.description("Connect to an MCP server")
		.action(async (serverId: string) => {
			try {
				await mcpCommands.connectServer(serverId)
			} finally {
				await mcpCommands.dispose()
			}
		})

	mcpCommand
		.command("disconnect <server-id>")
		.description("Disconnect from an MCP server")
		.action(async (serverId: string) => {
			try {
				await mcpCommands.disconnectServer(serverId)
			} finally {
				await mcpCommands.dispose()
			}
		})

	mcpCommand
		.command("tools [server-id]")
		.description("List available tools from connected servers")
		.action(async (serverId?: string) => {
			try {
				await mcpCommands.listTools(serverId)
			} finally {
				await mcpCommands.dispose()
			}
		})

	mcpCommand
		.command("resources [server-id]")
		.description("List available resources from connected servers")
		.action(async (serverId?: string) => {
			try {
				await mcpCommands.listResources(serverId)
			} finally {
				await mcpCommands.dispose()
			}
		})

	mcpCommand
		.command("execute <server-id> <tool-name> [args...]")
		.description("Execute a tool from an MCP server")
		.action(async (serverId: string, toolName: string, args: string[]) => {
			try {
				await mcpCommands.executeTool(serverId, toolName, args)
			} finally {
				await mcpCommands.dispose()
			}
		})

	const configCommand = mcpCommand.command("config").description("MCP configuration management")

	configCommand
		.command("validate [config-file]")
		.description("Validate MCP configuration file")
		.action(async (configFile?: string) => {
			try {
				await mcpCommands.validateConfig(configFile)
			} finally {
				await mcpCommands.dispose()
			}
		})

	configCommand
		.command("init [config-file]")
		.description("Initialize MCP configuration with examples")
		.action(async (configFile?: string) => {
			try {
				await mcpCommands.initConfig(configFile)
			} finally {
				await mcpCommands.dispose()
			}
		})

	configCommand
		.command("show [config-file]")
		.description("Show current MCP configuration")
		.action(async (configFile?: string) => {
			try {
				await mcpCommands.showConfig(configFile)
			} finally {
				await mcpCommands.dispose()
			}
		})
}
