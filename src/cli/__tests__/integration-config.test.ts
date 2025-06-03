import { describe, test, expect, beforeEach, afterEach } from "@jest/globals"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { CliConfigManager } from "../config/CliConfigManager"

describe("CLI Configuration Integration", () => {
	let tempDir: string
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env }

		// Create temporary directory for test files
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roo-cli-test-"))

		// Clear relevant environment variables
		delete process.env.ROO_API_KEY
		delete process.env.ROO_API_PROVIDER
		delete process.env.ROO_MODEL
	})

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv

		// Clean up temporary directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true })
		}
	})

	test("should generate and load a configuration file", async () => {
		const configPath = path.join(tempDir, "config.json")
		const configManager = new CliConfigManager({ verbose: false })

		// Generate default configuration
		await configManager.generateDefaultConfig(configPath)

		// Verify file was created
		expect(fs.existsSync(configPath)).toBe(true)

		// Read and verify content
		const content = fs.readFileSync(configPath, "utf8")
		const config = JSON.parse(content)

		expect(config.apiProvider).toBe("anthropic")
		expect(config.apiModelId).toBe("claude-3-5-sonnet-20241022")
		expect(config.autoApprovalEnabled).toBe(false)
	})

	test("should load project-level configuration", async () => {
		const projectConfig = {
			apiProvider: "openai",
			apiKey: "test-project-key",
			apiModelId: "gpt-4",
			autoApprovalEnabled: true,
		}

		// Create project config file
		const projectConfigPath = path.join(tempDir, ".roo-cli.json")
		fs.writeFileSync(projectConfigPath, JSON.stringify(projectConfig, null, 2))

		// Load configuration
		const configManager = new CliConfigManager({ cwd: tempDir })
		const config = await configManager.loadConfiguration()

		expect(config.apiProvider).toBe("openai")
		expect(config.apiKey).toBe("test-project-key")
		expect(config.apiModelId).toBe("gpt-4")
		expect(config.autoApprovalEnabled).toBe(true)
	})

	test("should prioritize environment variables over config files", async () => {
		// Create project config file
		const projectConfig = {
			apiKey: "project-key",
			apiModelId: "project-model",
		}
		const projectConfigPath = path.join(tempDir, ".roo-cli.json")
		fs.writeFileSync(projectConfigPath, JSON.stringify(projectConfig, null, 2))

		// Set environment variables
		process.env.ROO_API_KEY = "env-key"
		process.env.ROO_MODEL = "env-model"

		// Load configuration
		const configManager = new CliConfigManager({ cwd: tempDir })
		const config = await configManager.loadConfiguration()

		// Environment variables should override config file
		expect(config.apiKey).toBe("env-key")
		expect(config.apiModelId).toBe("env-model")
	})

	test("should validate configuration correctly", async () => {
		const configManager = new CliConfigManager()

		// Valid configuration
		const validConfig = {
			apiProvider: "anthropic",
			apiKey: "test-key",
			autoApprovalEnabled: false,
		}

		const validResult = configManager.validateConfiguration(validConfig)
		expect(validResult.valid).toBe(true)

		// Invalid configuration
		const invalidConfig = {
			autoApprovalEnabled: "not-a-boolean",
		}

		const invalidResult = configManager.validateConfiguration(invalidConfig)
		expect(invalidResult.valid).toBe(false)
		expect(invalidResult.errors).toBeDefined()
		expect(invalidResult.errors!.length).toBeGreaterThan(0)
	})

	test("should handle YAML configuration files", async () => {
		const yamlConfig = `
apiProvider: anthropic
apiKey: yaml-test-key
apiModelId: claude-3-opus
autoApprovalEnabled: true
alwaysAllowReadOnly: false
`

		// Create YAML config file
		const yamlConfigPath = path.join(tempDir, ".roo-cli.yaml")
		fs.writeFileSync(yamlConfigPath, yamlConfig)

		// Load configuration
		const configManager = new CliConfigManager({ cwd: tempDir })
		const config = await configManager.loadConfiguration()

		expect(config.apiProvider).toBe("anthropic")
		expect(config.apiKey).toBe("yaml-test-key")
		expect(config.apiModelId).toBe("claude-3-opus")
		expect(config.autoApprovalEnabled).toBe(true)
		expect(config.alwaysAllowReadOnly).toBe(false)
	})

	test("should handle multiple configuration sources with correct priority", async () => {
		// Create user config directory structure
		const userConfigDir = path.join(tempDir, "user-config")
		fs.mkdirSync(userConfigDir, { recursive: true })

		// Create user config
		const userConfig = {
			apiProvider: "anthropic",
			apiKey: "user-key",
			autoApprovalEnabled: true,
			alwaysAllowReadOnly: true,
		}
		fs.writeFileSync(path.join(userConfigDir, "config.json"), JSON.stringify(userConfig, null, 2))

		// Create project config
		const projectConfig = {
			apiKey: "project-key",
			apiModelId: "project-model",
			alwaysAllowWrite: true,
		}
		fs.writeFileSync(path.join(tempDir, ".roo-cli.json"), JSON.stringify(projectConfig, null, 2))

		// Set environment variable
		process.env.ROO_MODEL = "env-model"

		// Create config manager with explicit user config path
		const configManager = new CliConfigManager({
			cwd: tempDir,
			// We can't easily mock the user config loading in integration tests,
			// so we'll focus on project + env priority
		})

		const config = await configManager.loadConfiguration()

		// Environment should override project config
		expect(config.apiModelId).toBe("env-model")

		// Project config should be used
		expect(config.apiKey).toBe("project-key")
		expect(config.alwaysAllowWrite).toBe(true)
	})

	test("should parse environment variables with correct types", async () => {
		process.env.ROO_AUTO_APPROVAL = "true"
		process.env.ROO_MAX_REQUESTS = "50"
		process.env.ROO_REQUEST_DELAY = "3"

		const configManager = new CliConfigManager({ cwd: tempDir })
		const config = await configManager.loadConfiguration()

		expect(config.autoApprovalEnabled).toBe(true)
		expect(config.allowedMaxRequests).toBe(50)
		expect(config.requestDelaySeconds).toBe(3)
	})

	test("should handle missing configuration gracefully", async () => {
		// No config files, no environment variables
		const configManager = new CliConfigManager({ cwd: tempDir })
		const config = await configManager.loadConfiguration()

		// Should get default values
		expect(config.apiProvider).toBe("anthropic")
		expect(config.apiModelId).toBe("claude-3-5-sonnet-20241022")
		expect(config.autoApprovalEnabled).toBe(false)
		expect(config.alwaysAllowReadOnly).toBe(false)
	})
})
