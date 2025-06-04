import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { z } from "zod"
import { parse as parseYaml } from "yaml"
import {
	type RooCodeSettings,
	type ProviderSettings,
	type GlobalSettings,
	globalSettingsSchema,
	providerSettingsSchema,
} from "@roo-code/types"

/**
 * CLI-specific configuration schema that maps environment variables to settings
 */
export const cliEnvironmentConfigSchema = z.object({
	// API Configuration
	ROO_API_KEY: z.string().optional(),
	ROO_API_PROVIDER: z.string().optional(),
	ROO_MODEL: z.string().optional(),
	ROO_BASE_URL: z.string().optional(),

	// Behavioral Settings
	ROO_AUTO_APPROVAL: z
		.string()
		.transform((val) => val === "true")
		.optional(),
	ROO_VERBOSE: z
		.string()
		.transform((val) => val === "true")
		.optional(),
	ROO_MAX_REQUESTS: z
		.string()
		.transform((val) => parseInt(val, 10))
		.optional(),
	ROO_REQUEST_DELAY: z
		.string()
		.transform((val) => parseInt(val, 10))
		.optional(),

	// File paths
	ROO_CONFIG_PATH: z.string().optional(),
	ROO_WORKSPACE_ROOT: z.string().optional(),
})

export type CliEnvironmentConfig = z.infer<typeof cliEnvironmentConfigSchema>

/**
 * CLI configuration file schema (supports both JSON and YAML)
 */
export const cliConfigFileSchema = z
	.object({
		// Provider settings
		apiProvider: z.string().optional(),
		apiKey: z.string().optional(),
		apiModelId: z.string().optional(),
		openAiBaseUrl: z.string().optional(),

		// Global settings
		autoApprovalEnabled: z.boolean().optional(),
		alwaysAllowReadOnly: z.boolean().optional(),
		alwaysAllowWrite: z.boolean().optional(),
		alwaysAllowBrowser: z.boolean().optional(),
		alwaysAllowExecute: z.boolean().optional(),
		alwaysAllowMcp: z.boolean().optional(),
		customInstructions: z.string().optional(),
		requestDelaySeconds: z.number().optional(),
		allowedMaxRequests: z.number().optional(),

		// CLI-specific settings
		verbose: z.boolean().optional(),
		workspaceRoot: z.string().optional(),

		// Extend with full provider and global settings
	})
	.merge(providerSettingsSchema.partial())
	.merge(globalSettingsSchema.partial())

export type CliConfigFile = z.infer<typeof cliConfigFileSchema>

/**
 * Configuration source priority (highest to lowest):
 * 1. CLI arguments
 * 2. Environment variables
 * 3. Project-level config file (.roo-cli.json/yaml)
 * 4. User-level config file (~/.roo-cli/config.json/yaml)
 * 5. VSCode settings (if available)
 * 6. Default values
 */
export interface ConfigSource {
	name: string
	priority: number
	config: Partial<RooCodeSettings>
}

export interface CliConfigOptions {
	cwd?: string
	configPath?: string
	verbose?: boolean
	// CLI argument overrides
	cliOverrides?: Partial<RooCodeSettings>
}

export class CliConfigManager {
	private readonly options: CliConfigOptions
	private readonly configSources: ConfigSource[] = []
	private mergedConfig: RooCodeSettings | null = null

	constructor(options: CliConfigOptions = {}) {
		this.options = {
			cwd: process.cwd(),
			verbose: false,
			...options,
		}
	}

	/**
	 * Load and merge configuration from all sources
	 */
	public async loadConfiguration(): Promise<RooCodeSettings> {
		if (this.mergedConfig) {
			return this.mergedConfig
		}

		this.configSources.length = 0

		// 1. Load default configuration (lowest priority)
		this.addConfigSource("defaults", 0, this.getDefaultConfig())

		// 2. VSCode settings are not available in CLI mode, skip this step
		if (this.options.verbose) {
			console.log("VSCode context not available in CLI mode, using file-based configuration only")
		}

		// 3. Load user-level config file
		await this.loadUserConfigFile()

		// 4. Load project-level config file
		await this.loadProjectConfigFile()

		// 5. Load environment variables
		this.loadEnvironmentConfig()

		// 6. Apply CLI argument overrides (highest priority)
		if (this.options.cliOverrides) {
			this.addConfigSource("cli-args", 10, this.options.cliOverrides)
		}

		// Merge all configurations by priority
		this.mergedConfig = this.mergeConfigurations()

		if (this.options.verbose) {
			this.logConfigurationSources()
		}

		return this.mergedConfig
	}

	/**
	 * Get the merged configuration
	 */
	public getConfiguration(): RooCodeSettings {
		if (!this.mergedConfig) {
			throw new Error("Configuration not loaded. Call loadConfiguration() first.")
		}
		return this.mergedConfig
	}

	/**
	 * Generate default configuration file
	 */
	public async generateDefaultConfig(filePath: string): Promise<void> {
		const defaultConfig = this.getDefaultConfigFile()
		const content = JSON.stringify(defaultConfig, null, 2)

		// Ensure directory exists
		const dir = path.dirname(filePath)
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true })
		}

		fs.writeFileSync(filePath, content, "utf8")

		if (this.options.verbose) {
			console.log(`Generated default configuration at: ${filePath}`)
		}
	}

	/**
	 * Validate configuration against schema
	 */
	public validateConfiguration(config: unknown): { valid: boolean; errors?: string[] } {
		try {
			// Validate against the file schema first
			cliConfigFileSchema.parse(config)
			return { valid: true }
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errors = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`)
				return { valid: false, errors }
			}
			return { valid: false, errors: ["Unknown validation error"] }
		}
	}

	private addConfigSource(name: string, priority: number, config: Partial<RooCodeSettings>): void {
		this.configSources.push({ name, priority, config })
	}

	private async loadUserConfigFile(): Promise<void> {
		const userConfigDir = path.join(os.homedir(), ".roo-cli")
		const configFiles = ["config.json", "config.yaml", "config.yml"]

		for (const fileName of configFiles) {
			const filePath = path.join(userConfigDir, fileName)
			const config = await this.loadConfigFile(filePath)
			if (config) {
				this.addConfigSource(`user-config (${fileName})`, 2, config)
				return // Use first found config file
			}
		}
	}

	private async loadProjectConfigFile(): Promise<void> {
		if (!this.options.cwd) return

		// Check for explicit config path first
		if (this.options.configPath) {
			const config = await this.loadConfigFile(this.options.configPath)
			if (config) {
				this.addConfigSource(`explicit-config (${this.options.configPath})`, 4, config)
				return
			}
		}

		// Look for project-level config files
		const configFiles = [".roo-cli.json", ".roo-cli.yaml", ".roo-cli.yml", "roo-cli.config.json"]

		for (const fileName of configFiles) {
			const filePath = path.join(this.options.cwd, fileName)
			const config = await this.loadConfigFile(filePath)
			if (config) {
				this.addConfigSource(`project-config (${fileName})`, 3, config)
				return // Use first found config file
			}
		}
	}

	private async loadConfigFile(filePath: string): Promise<Partial<RooCodeSettings> | null> {
		try {
			if (!fs.existsSync(filePath)) {
				return null
			}

			const content = fs.readFileSync(filePath, "utf8")
			const ext = path.extname(filePath).toLowerCase()

			let parsed: unknown
			if (ext === ".yaml" || ext === ".yml") {
				parsed = parseYaml(content)
			} else {
				parsed = JSON.parse(content)
			}

			// Validate the configuration
			const validation = this.validateConfiguration(parsed)
			if (!validation.valid) {
				console.error(`Invalid configuration in ${filePath}:`)
				validation.errors?.forEach((error) => console.error(`  ${error}`))
				return null
			}

			const config = cliConfigFileSchema.parse(parsed)

			if (this.options.verbose) {
				console.log(`Loaded configuration from: ${filePath}`)
			}

			return config as Partial<RooCodeSettings>
		} catch (error) {
			console.error(
				`Failed to load config file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			)
			return null
		}
	}

	private loadEnvironmentConfig(): void {
		try {
			const envConfig = cliEnvironmentConfigSchema.parse(process.env)

			// Map environment variables to RooCodeSettings format
			const mappedConfig: Partial<RooCodeSettings> = {}

			if (envConfig.ROO_API_KEY) mappedConfig.apiKey = envConfig.ROO_API_KEY
			if (envConfig.ROO_API_PROVIDER) mappedConfig.apiProvider = envConfig.ROO_API_PROVIDER as any
			if (envConfig.ROO_MODEL) mappedConfig.apiModelId = envConfig.ROO_MODEL
			if (envConfig.ROO_BASE_URL) mappedConfig.openAiBaseUrl = envConfig.ROO_BASE_URL
			if (envConfig.ROO_AUTO_APPROVAL !== undefined)
				mappedConfig.autoApprovalEnabled = envConfig.ROO_AUTO_APPROVAL
			if (envConfig.ROO_MAX_REQUESTS !== undefined) mappedConfig.allowedMaxRequests = envConfig.ROO_MAX_REQUESTS
			if (envConfig.ROO_REQUEST_DELAY !== undefined)
				mappedConfig.requestDelaySeconds = envConfig.ROO_REQUEST_DELAY

			if (Object.keys(mappedConfig).length > 0) {
				this.addConfigSource("environment", 5, mappedConfig)

				if (this.options.verbose) {
					console.log("Loaded configuration from environment variables")
				}
			}
		} catch (error) {
			if (this.options.verbose) {
				console.warn(
					`Failed to parse environment configuration: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}
	}

	private mergeConfigurations(): RooCodeSettings {
		// Sort by priority (lowest to highest)
		const sortedSources = [...this.configSources].sort((a, b) => a.priority - b.priority)

		// Merge configurations, with higher priority overriding lower priority
		let merged: Partial<RooCodeSettings> = {}

		for (const source of sortedSources) {
			merged = { ...merged, ...source.config }
		}

		// Ensure we have all required fields with defaults
		const defaultConfig = this.getDefaultConfig()
		return { ...defaultConfig, ...merged }
	}

	private getDefaultConfig(): RooCodeSettings {
		return {
			// Provider settings defaults
			apiProvider: "anthropic",
			apiKey: undefined,
			apiModelId: "claude-3-5-sonnet-20241022",

			// Global settings defaults
			autoApprovalEnabled: false,
			alwaysAllowReadOnly: false,
			alwaysAllowWrite: false,
			alwaysAllowBrowser: false,
			alwaysAllowExecute: false,
			alwaysAllowMcp: false,
			requestDelaySeconds: 0,
			allowedMaxRequests: null,

			// CLI-friendly defaults
			alwaysAllowReadOnlyOutsideWorkspace: true,
			alwaysAllowWriteOutsideWorkspace: false,
			writeDelayMs: 500,
		} as RooCodeSettings
	}

	private getDefaultConfigFile(): CliConfigFile {
		return {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			autoApprovalEnabled: false,
			alwaysAllowReadOnly: false,
			alwaysAllowWrite: false,
			alwaysAllowBrowser: false,
			alwaysAllowExecute: false,
			alwaysAllowMcp: false,
			requestDelaySeconds: 0,
			allowedMaxRequests: null,
			verbose: false,
		}
	}

	private logConfigurationSources(): void {
		console.log("Configuration sources (by priority):")
		const sortedSources = [...this.configSources].sort((a, b) => a.priority - b.priority)

		for (const source of sortedSources) {
			const keys = Object.keys(source.config).filter(
				(key) => source.config[key as keyof RooCodeSettings] !== undefined,
			)
			if (keys.length > 0) {
				console.log(`  ${source.priority}. ${source.name}: ${keys.join(", ")}`)
			}
		}
	}

	/**
	 * Validate a configuration file
	 */
	public async validateConfigFile(configPath: string): Promise<void> {
		if (!fs.existsSync(configPath)) {
			throw new Error(`Configuration file not found: ${configPath}`)
		}

		const fileContent = fs.readFileSync(configPath, "utf-8")
		const ext = path.extname(configPath).toLowerCase()

		let configData: any
		try {
			if (ext === ".json") {
				configData = JSON.parse(fileContent)
			} else if (ext === ".yaml" || ext === ".yml") {
				configData = parseYaml(fileContent)
			} else {
				throw new Error(`Unsupported configuration file format: ${ext}. Supported formats: .json, .yaml, .yml`)
			}
		} catch (error) {
			throw new Error(
				`Failed to parse configuration file: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		try {
			// Validate against the CLI config schema
			cliConfigFileSchema.parse(configData)
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ")
				throw new Error(`Configuration validation failed: ${errorMessages}`)
			}
			throw new Error(
				`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Get the default user config directory
	 */
	public static getDefaultUserConfigDir(): string {
		return path.join(os.homedir(), ".roo-cli")
	}

	/**
	 * Get the default user config file path
	 */
	public static getDefaultUserConfigPath(): string {
		return path.join(this.getDefaultUserConfigDir(), "config.json")
	}
}
