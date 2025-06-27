import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { z } from "zod"
import { parse as parseYaml } from "yaml"
import type { ApiServerOptions } from "../types/server"
import { getGlobalStoragePath } from "../../shared/paths"

/**
 * API environment configuration schema
 */
export const apiEnvironmentConfigSchema = z.object({
	// Server Configuration
	API_PORT: z
		.string()
		.transform((val) => parseInt(val, 10))
		.optional(),
	API_HOST: z.string().optional(),
	API_VERBOSE: z
		.string()
		.transform((val) => val === "true")
		.optional(),
	API_DEBUG: z
		.string()
		.transform((val) => val === "true")
		.optional(),

	// Workspace Configuration
	API_WORKSPACE_ROOT: z.string().optional(),

	// CLI Configuration
	API_CLI_CONFIG_PATH: z.string().optional(),

	// CORS Configuration
	API_CORS_ORIGIN: z.string().optional(),
	API_CORS_CREDENTIALS: z
		.string()
		.transform((val) => val === "true")
		.optional(),

	// Security Configuration
	API_ENABLE_HELMET: z
		.string()
		.transform((val) => val === "true")
		.optional(),
	API_RATE_LIMIT_MAX: z
		.string()
		.transform((val) => parseInt(val, 10))
		.optional(),
	API_RATE_LIMIT_WINDOW: z.string().optional(),

	// Timeout Configuration
	API_REQUEST_TIMEOUT: z
		.string()
		.transform((val) => parseInt(val, 10))
		.optional(),
	API_KEEP_ALIVE_TIMEOUT: z
		.string()
		.transform((val) => parseInt(val, 10))
		.optional(),
	API_TASK_TIMEOUT: z
		.string()
		.transform((val) => parseInt(val, 10))
		.optional(),

	// SSL Configuration
	API_HTTPS_KEY: z.string().optional(),
	API_HTTPS_CERT: z.string().optional(),
})

export type ApiEnvironmentConfig = z.infer<typeof apiEnvironmentConfigSchema>

/**
 * API configuration file schema
 */
export const apiConfigFileSchema = z.object({
	// Server settings
	port: z.number().min(1).max(65535).optional(),
	host: z.string().optional(),
	verbose: z.boolean().optional(),
	debug: z.boolean().optional(),

	// Workspace settings
	workspaceRoot: z.string().optional(),

	// CORS settings
	cors: z
		.object({
			origin: z.union([z.string(), z.array(z.string()), z.boolean()]).optional(),
			credentials: z.boolean().optional(),
			methods: z.array(z.string()).optional(),
		})
		.optional(),

	// Security settings
	security: z
		.object({
			enableHelmet: z.boolean().optional(),
			rateLimit: z
				.object({
					max: z.number().optional(),
					timeWindow: z.string().optional(),
				})
				.optional(),
		})
		.optional(),

	// Timeout settings
	timeouts: z
		.object({
			request: z.number().optional(),
			keepAlive: z.number().optional(),
			task: z.number().optional(),
		})
		.optional(),

	// SSL settings
	https: z
		.object({
			key: z.string().optional(),
			cert: z.string().optional(),
		})
		.optional(),
})

export type ApiConfigFile = z.infer<typeof apiConfigFileSchema>

/**
 * Configuration source for API settings
 */
export interface ApiConfigSource {
	name: string
	priority: number
	config: Partial<ApiServerOptions>
}

export interface ApiConfigOptions {
	cwd?: string
	configPath?: string
	verbose?: boolean
	userConfigDir?: string
	cliConfigPath?: string
	// Direct option overrides
	overrides?: Partial<ApiServerOptions>
}

export class ApiConfigManager {
	private readonly options: ApiConfigOptions
	private readonly configSources: ApiConfigSource[] = []
	private mergedConfig: ApiServerOptions | null = null

	constructor(options: ApiConfigOptions = {}) {
		this.options = {
			cwd: process.cwd(),
			verbose: false,
			userConfigDir: path.join(os.homedir(), ".roo-api"),
			...options,
		}
	}

	/**
	 * Load and merge configuration from all sources
	 */
	public async loadConfiguration(): Promise<ApiServerOptions> {
		if (this.mergedConfig) {
			return this.mergedConfig
		}

		this.configSources.length = 0

		// 1. Load default configuration (lowest priority)
		this.addConfigSource("defaults", 0, this.getDefaultConfig())

		// 2. Load user-level config file
		await this.loadUserConfigFile()

		// 3. Load project-level config file
		await this.loadProjectConfigFile()

		// 4. Load environment variables
		this.loadEnvironmentConfig()

		// 5. Apply direct overrides (highest priority)
		if (this.options.overrides) {
			this.addConfigSource("overrides", 10, this.options.overrides)
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
	public getConfiguration(): ApiServerOptions {
		if (!this.mergedConfig) {
			throw new Error("Configuration not loaded. Call loadConfiguration() first.")
		}
		return this.mergedConfig
	}

	/**
	 * Validate configuration against schema
	 */
	public validateConfiguration(config: unknown): { valid: boolean; errors?: string[] } {
		try {
			apiConfigFileSchema.parse(config)
			return { valid: true }
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errors = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`)
				return { valid: false, errors }
			}
			return { valid: false, errors: ["Unknown validation error"] }
		}
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
			console.log(`Generated default API configuration at: ${filePath}`)
		}
	}

	private addConfigSource(name: string, priority: number, config: Partial<ApiServerOptions>): void {
		this.configSources.push({ name, priority, config })
	}

	private async loadUserConfigFile(): Promise<void> {
		// First, try the CLI config location for consistency
		const cliConfigPath =
			this.options.cliConfigPath ||
			process.env.API_CLI_CONFIG_PATH ||
			path.join(getGlobalStoragePath(), "agent-config.json")

		const cliConfig = await this.loadCliConfig(cliConfigPath)
		if (cliConfig) {
			this.addConfigSource(`cli-config (${path.basename(cliConfigPath)})`, 2, cliConfig)
			return
		}

		// Fallback to API-specific config files
		const userConfigDir = this.options.userConfigDir!
		const configFiles = ["api.json", "api.yaml", "api.yml", "config.json"]

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
		const configFiles = [
			".roo-api.json",
			".roo-api.yaml",
			".roo-api.yml",
			"roo-api.config.json",
			".api/config.json",
		]

		for (const fileName of configFiles) {
			const filePath = path.join(this.options.cwd, fileName)
			const config = await this.loadConfigFile(filePath)
			if (config) {
				this.addConfigSource(`project-config (${fileName})`, 3, config)
				return // Use first found config file
			}
		}
	}

	private async loadConfigFile(filePath: string): Promise<Partial<ApiServerOptions> | null> {
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
				console.error(`Invalid API configuration in ${filePath}:`)
				validation.errors?.forEach((error) => console.error(`  ${error}`))
				return null
			}

			const config = apiConfigFileSchema.parse(parsed)

			if (this.options.verbose) {
				console.log(`Loaded API configuration from: ${filePath}`)
			}

			return config as Partial<ApiServerOptions>
		} catch (error) {
			console.error(
				`Failed to load API config file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			)
			return null
		}
	}

	/**
	 * Load CLI configuration and map it to API server options
	 */
	private async loadCliConfig(filePath: string): Promise<Partial<ApiServerOptions> | null> {
		try {
			if (!fs.existsSync(filePath)) {
				return null
			}

			const content = fs.readFileSync(filePath, "utf8")
			const cliConfig = JSON.parse(content)

			if (this.options.verbose) {
				console.log(`Loaded CLI configuration from: ${filePath}`)
			}

			// Map CLI config to API server options
			const apiConfig: Partial<ApiServerOptions> = {}

			// The CLI config doesn't have server-specific settings, so we only
			// set defaults and let environment variables override them
			if (this.options.verbose) {
				console.log("Using CLI configuration for API compatibility")
			}

			return apiConfig
		} catch (error) {
			console.error(
				`Failed to load CLI config file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			)
			return null
		}
	}

	private loadEnvironmentConfig(): void {
		try {
			const envConfig = apiEnvironmentConfigSchema.parse(process.env)

			// Map environment variables to ApiServerOptions format
			const mappedConfig: Partial<ApiServerOptions> = {}

			if (envConfig.API_PORT !== undefined) mappedConfig.port = envConfig.API_PORT
			if (envConfig.API_HOST) mappedConfig.host = envConfig.API_HOST
			if (envConfig.API_VERBOSE !== undefined) mappedConfig.verbose = envConfig.API_VERBOSE
			if (envConfig.API_DEBUG !== undefined) mappedConfig.debug = envConfig.API_DEBUG
			if (envConfig.API_WORKSPACE_ROOT) mappedConfig.workspaceRoot = envConfig.API_WORKSPACE_ROOT

			// CORS configuration
			if (envConfig.API_CORS_ORIGIN || envConfig.API_CORS_CREDENTIALS !== undefined) {
				mappedConfig.cors = {}
				if (envConfig.API_CORS_ORIGIN) {
					// Handle comma-separated origins
					const origins = envConfig.API_CORS_ORIGIN.split(",").map((o) => o.trim())
					mappedConfig.cors.origin = origins.length === 1 ? origins[0] : origins
				}
				if (envConfig.API_CORS_CREDENTIALS !== undefined) {
					mappedConfig.cors.credentials = envConfig.API_CORS_CREDENTIALS
				}
			}

			// Security configuration
			if (
				envConfig.API_ENABLE_HELMET !== undefined ||
				envConfig.API_RATE_LIMIT_MAX !== undefined ||
				envConfig.API_RATE_LIMIT_WINDOW
			) {
				mappedConfig.security = {}
				if (envConfig.API_ENABLE_HELMET !== undefined) {
					mappedConfig.security.enableHelmet = envConfig.API_ENABLE_HELMET
				}
				if (envConfig.API_RATE_LIMIT_MAX !== undefined || envConfig.API_RATE_LIMIT_WINDOW) {
					mappedConfig.security.rateLimit = {}
					if (envConfig.API_RATE_LIMIT_MAX !== undefined) {
						mappedConfig.security.rateLimit.max = envConfig.API_RATE_LIMIT_MAX
					}
					if (envConfig.API_RATE_LIMIT_WINDOW) {
						mappedConfig.security.rateLimit.timeWindow = envConfig.API_RATE_LIMIT_WINDOW
					}
				}
			}

			// Timeout configuration
			if (
				envConfig.API_REQUEST_TIMEOUT !== undefined ||
				envConfig.API_KEEP_ALIVE_TIMEOUT !== undefined ||
				envConfig.API_TASK_TIMEOUT !== undefined
			) {
				mappedConfig.timeouts = {}
				if (envConfig.API_REQUEST_TIMEOUT !== undefined) {
					mappedConfig.timeouts.request = envConfig.API_REQUEST_TIMEOUT
				}
				if (envConfig.API_KEEP_ALIVE_TIMEOUT !== undefined) {
					mappedConfig.timeouts.keepAlive = envConfig.API_KEEP_ALIVE_TIMEOUT
				}
				if (envConfig.API_TASK_TIMEOUT !== undefined) {
					mappedConfig.timeouts.task = envConfig.API_TASK_TIMEOUT
				}
			}

			// HTTPS configuration
			if (envConfig.API_HTTPS_KEY || envConfig.API_HTTPS_CERT) {
				mappedConfig.https = {}
				if (envConfig.API_HTTPS_KEY) mappedConfig.https.key = envConfig.API_HTTPS_KEY
				if (envConfig.API_HTTPS_CERT) mappedConfig.https.cert = envConfig.API_HTTPS_CERT
			}

			if (Object.keys(mappedConfig).length > 0) {
				this.addConfigSource("environment", 8, mappedConfig)

				if (this.options.verbose) {
					console.log("Loaded API configuration from environment variables")
				}
			}
		} catch (error) {
			if (this.options.verbose) {
				console.warn(
					`Failed to parse API environment configuration: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}
	}

	private mergeConfigurations(): ApiServerOptions {
		// Sort by priority (lowest to highest)
		const sortedSources = [...this.configSources].sort((a, b) => a.priority - b.priority)

		// Merge configurations, with higher priority overriding lower priority
		let merged: Partial<ApiServerOptions> = {}

		for (const source of sortedSources) {
			// Deep merge for nested objects
			merged = this.deepMerge(merged, source.config)
		}

		// Ensure we have all required fields with defaults
		const defaultConfig = this.getDefaultConfig()
		return this.deepMerge(defaultConfig, merged) as ApiServerOptions
	}

	private deepMerge(target: any, source: any): any {
		const result = { ...target }

		for (const key in source) {
			if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
				result[key] = this.deepMerge(result[key] || {}, source[key])
			} else {
				result[key] = source[key]
			}
		}

		return result
	}

	private getDefaultConfig(): ApiServerOptions {
		return {
			port: 3000,
			host: "localhost",
			workspaceRoot: process.cwd(),
			verbose: false,
			debug: false,
			cors: {
				origin: true,
				credentials: true,
				methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			},
			security: {
				enableHelmet: true,
				rateLimit: {
					max: 100,
					timeWindow: "1 minute",
				},
			},
			timeouts: {
				request: 30000, // 30 seconds
				keepAlive: 5000, // 5 seconds
				task: 300000, // 5 minutes
			},
		}
	}

	private getDefaultConfigFile(): ApiConfigFile {
		return {
			port: 3000,
			host: "localhost",
			verbose: false,
			debug: false,
			cors: {
				origin: true,
				credentials: true,
				methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			},
			security: {
				enableHelmet: true,
				rateLimit: {
					max: 100,
					timeWindow: "1 minute",
				},
			},
			timeouts: {
				request: 30000,
				keepAlive: 5000,
				task: 300000,
			},
		}
	}

	private logConfigurationSources(): void {
		console.log("API Configuration sources (by priority):")
		const sortedSources = [...this.configSources].sort((a, b) => a.priority - b.priority)

		for (const source of sortedSources) {
			const keys = Object.keys(source.config).filter(
				(key) => source.config[key as keyof ApiServerOptions] !== undefined,
			)
			if (keys.length > 0) {
				console.log(`  ${source.priority}. ${source.name}: ${keys.join(", ")}`)
			}
		}
	}
}
