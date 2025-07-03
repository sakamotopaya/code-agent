import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { CliConfigManager } from "../CliConfigManager"
import type { RooCodeSettings } from "@roo-code/types"
import { AGENTZ_DIR_NAME } from "../../../shared/paths"

// Mock fs
jest.mock("fs")
const mockFs = fs as jest.Mocked<typeof fs>

// Mock os
jest.mock("os")
const mockOs = os as jest.Mocked<typeof os>

describe("CliConfigManager", () => {
	let configManager: CliConfigManager
	let tempDir: string
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env }

		// Setup mocks
		tempDir = "/tmp/roo-cli-test"
		mockOs.homedir.mockReturnValue("/home/user")
		mockFs.existsSync.mockReturnValue(false)
		mockFs.mkdirSync.mockReturnValue(undefined as any)
		mockFs.writeFileSync.mockReturnValue(undefined)

		// Clear environment variables
		delete process.env.ROO_API_KEY
		delete process.env.ROO_API_PROVIDER
		delete process.env.ROO_MODEL
		delete process.env.ROO_AUTO_APPROVAL
		delete process.env.ROO_VERBOSE
	})

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv
		jest.resetAllMocks()
	})

	describe("constructor", () => {
		test("should create with default options", () => {
			configManager = new CliConfigManager()
			expect(configManager).toBeDefined()
		})

		test("should create with custom options", () => {
			configManager = new CliConfigManager({
				cwd: "/custom/path",
				verbose: true,
				configPath: "/custom/config.json",
			})
			expect(configManager).toBeDefined()
		})
	})

	describe("loadConfiguration", () => {
		test("should load default configuration when no sources exist", async () => {
			configManager = new CliConfigManager({ cwd: tempDir })
			const config = await configManager.loadConfiguration()

			expect(config).toBeDefined()
			expect(config.apiProvider).toBe("anthropic")
			expect(config.apiModelId).toBe("claude-3-5-sonnet-20241022")
			expect(config.autoApprovalEnabled).toBe(false)
		})

		test("should load configuration from environment variables", async () => {
			process.env.ROO_API_KEY = "test-api-key"
			process.env.ROO_API_PROVIDER = "openai"
			process.env.ROO_MODEL = "gpt-4"
			process.env.ROO_AUTO_APPROVAL = "true"

			configManager = new CliConfigManager({ cwd: tempDir })
			const config = await configManager.loadConfiguration()

			expect(config.apiKey).toBe("test-api-key")
			expect(config.apiProvider).toBe("openai")
			expect(config.apiModelId).toBe("gpt-4")
			expect(config.autoApprovalEnabled).toBe(true)
		})

		test("should load configuration from JSON file", async () => {
			const configContent = {
				apiProvider: "anthropic",
				apiKey: "file-api-key",
				apiModelId: "claude-3-opus",
				autoApprovalEnabled: true,
			}

			mockFs.existsSync.mockImplementation((filePath) => {
				return filePath === path.join(tempDir, ".roo-cli.json")
			})

			mockFs.readFileSync.mockImplementation((filePath, options) => {
				if (filePath === path.join(tempDir, ".roo-cli.json")) {
					return JSON.stringify(configContent) as any
				}
				throw new Error("File not found")
			})

			configManager = new CliConfigManager({ cwd: tempDir })
			const config = await configManager.loadConfiguration()

			expect(config.apiKey).toBe("file-api-key")
			expect(config.apiProvider).toBe("anthropic")
			expect(config.apiModelId).toBe("claude-3-opus")
			expect(config.autoApprovalEnabled).toBe(true)
		})

		test("should load configuration from YAML file", async () => {
			const configContent = `
apiProvider: anthropic
apiKey: yaml-api-key
apiModelId: claude-3-sonnet
autoApprovalEnabled: false
`

			mockFs.existsSync.mockImplementation((filePath) => {
				return filePath === path.join(tempDir, ".roo-cli.yaml")
			})

			mockFs.readFileSync.mockImplementation((filePath, options) => {
				if (filePath === path.join(tempDir, ".roo-cli.yaml")) {
					return configContent as any
				}
				throw new Error("File not found")
			})

			configManager = new CliConfigManager({ cwd: tempDir })
			const config = await configManager.loadConfiguration()

			expect(config.apiKey).toBe("yaml-api-key")
			expect(config.apiProvider).toBe("anthropic")
			expect(config.apiModelId).toBe("claude-3-sonnet")
			expect(config.autoApprovalEnabled).toBe(false)
		})

		test(`should load configuration from ${AGENTZ_DIR_NAME}/agent-config.json file`, async () => {
			const configContent = {
				apiProvider: "openai",
				apiKey: "agentz-api-key",
				apiModelId: "gpt-4",
				autoApprovalEnabled: true,
			}

			mockFs.existsSync.mockImplementation((filePath) => {
				return filePath === path.join(tempDir, AGENTZ_DIR_NAME, "agent-config.json")
			})

			mockFs.readFileSync.mockImplementation((filePath, options) => {
				if (filePath === path.join(tempDir, AGENTZ_DIR_NAME, "agent-config.json")) {
					return JSON.stringify(configContent) as any
				}
				throw new Error("File not found")
			})

			configManager = new CliConfigManager({ cwd: tempDir })
			const config = await configManager.loadConfiguration()

			expect(config.apiKey).toBe("agentz-api-key")
			expect(config.apiProvider).toBe("openai")
			expect(config.apiModelId).toBe("gpt-4")
			expect(config.autoApprovalEnabled).toBe(true)
		})

		test("should use configurable user config directory", async () => {
			const configContent = {
				apiProvider: "anthropic",
				apiKey: "custom-dir-api-key",
				apiModelId: "claude-3-opus",
			}

			mockFs.existsSync.mockImplementation((filePath) => {
				return filePath === "/home/user/.custom-config/config.json"
			})

			mockFs.readFileSync.mockImplementation((filePath, options) => {
				if (filePath === "/home/user/.custom-config/config.json") {
					return JSON.stringify(configContent) as any
				}
				throw new Error("File not found")
			})

			configManager = new CliConfigManager({
				cwd: tempDir,
				userConfigDir: "/home/user/.custom-config",
			})
			const config = await configManager.loadConfiguration()

			expect(config.apiKey).toBe("custom-dir-api-key")
			expect(config.apiProvider).toBe("anthropic")
			expect(config.apiModelId).toBe("claude-3-opus")
		})

		test("should prioritize CLI overrides over other sources", async () => {
			// Set environment variable
			process.env.ROO_API_KEY = "env-api-key"

			// Mock file exists
			mockFs.existsSync.mockImplementation((filePath) => {
				return filePath === path.join(tempDir, ".roo-cli.json")
			})

			mockFs.readFileSync.mockImplementation((filePath, options) => {
				if (filePath === path.join(tempDir, ".roo-cli.json")) {
					return JSON.stringify({ apiKey: "file-api-key" }) as any
				}
				throw new Error("File not found")
			})

			// CLI overrides should have highest priority
			configManager = new CliConfigManager({
				cwd: tempDir,
				cliOverrides: { apiKey: "cli-api-key" } as Partial<RooCodeSettings>,
			})

			const config = await configManager.loadConfiguration()
			expect(config.apiKey).toBe("cli-api-key")
		})

		test("should handle file loading errors gracefully", async () => {
			mockFs.existsSync.mockReturnValue(true)
			mockFs.readFileSync.mockImplementation((...args: any[]) => {
				throw new Error("Permission denied")
			})

			configManager = new CliConfigManager({ cwd: tempDir, verbose: true })

			// Should not throw, but fall back to defaults
			const config = await configManager.loadConfiguration()
			expect(config).toBeDefined()
			expect(config.apiProvider).toBe("anthropic")
		})

		test("should handle invalid JSON gracefully", async () => {
			mockFs.existsSync.mockImplementation((filePath) => {
				return filePath === path.join(tempDir, ".roo-cli.json")
			})

			mockFs.readFileSync.mockImplementation((...args: any[]) => {
				return "{ invalid json }" as any
			})

			configManager = new CliConfigManager({ cwd: tempDir, verbose: true })

			// Should not throw, but fall back to defaults
			const config = await configManager.loadConfiguration()
			expect(config).toBeDefined()
			expect(config.apiProvider).toBe("anthropic")
		})
	})

	describe("generateDefaultConfig", () => {
		test("should generate default configuration file", async () => {
			const configPath = "/test/config.json"

			configManager = new CliConfigManager()
			await configManager.generateDefaultConfig(configPath)

			expect(mockFs.mkdirSync).toHaveBeenCalledWith("/test", { recursive: true })
			expect(mockFs.writeFileSync).toHaveBeenCalledWith(
				configPath,
				expect.stringContaining('"apiProvider": "anthropic"'),
				"utf8",
			)
		})

		test("should create directory if it doesn't exist", async () => {
			const configPath = "/new/path/config.json"

			configManager = new CliConfigManager()
			await configManager.generateDefaultConfig(configPath)

			expect(mockFs.mkdirSync).toHaveBeenCalledWith("/new/path", { recursive: true })
		})
	})

	describe("validateConfiguration", () => {
		test("should validate correct configuration", () => {
			configManager = new CliConfigManager()

			const validConfig = {
				apiProvider: "anthropic",
				apiKey: "test-key",
				apiModelId: "claude-3-sonnet",
				autoApprovalEnabled: false,
			}

			const result = configManager.validateConfiguration(validConfig)
			expect(result.valid).toBe(true)
			expect(result.errors).toBeUndefined()
		})

		test("should return errors for invalid configuration", () => {
			configManager = new CliConfigManager()

			const invalidConfig = {
				apiProvider: "invalid-provider",
				autoApprovalEnabled: "not-boolean", // Should be boolean
			}

			const result = configManager.validateConfiguration(invalidConfig)
			expect(result.valid).toBe(false)
			expect(result.errors).toBeDefined()
			expect(result.errors!.length).toBeGreaterThan(0)
		})
	})

	describe("static methods", () => {
		test("getDefaultUserConfigDir should return correct path with default", () => {
			const result = CliConfigManager.getDefaultUserConfigDir()
			expect(result).toBe(`/home/user/${AGENTZ_DIR_NAME}`)
		})

		test("getDefaultUserConfigDir should return correct path with custom dir", () => {
			const result = CliConfigManager.getDefaultUserConfigDir(".roo-cli")
			expect(result).toBe("/home/user/.roo-cli")
		})

		test("getDefaultUserConfigPath should return correct path with default", () => {
			const result = CliConfigManager.getDefaultUserConfigPath()
			expect(result).toBe(`/home/user/${AGENTZ_DIR_NAME}/config.json`)
		})

		test("getDefaultUserConfigPath should return correct path with custom dir", () => {
			const result = CliConfigManager.getDefaultUserConfigPath(".roo-cli")
			expect(result).toBe("/home/user/.roo-cli/config.json")
		})
	})

	describe("configuration priority", () => {
		test("should merge configurations in correct priority order", async () => {
			// Setup environment variable
			process.env.ROO_API_KEY = "env-key"
			process.env.ROO_MODEL = "env-model"

			// Setup user config file
			mockFs.existsSync.mockImplementation((filePath) => {
				return (
					filePath === `/home/user/${AGENTZ_DIR_NAME}/config.json` ||
					filePath === path.join(tempDir, ".roo-cli.json")
				)
			})

			mockFs.readFileSync.mockImplementation((filePath, options) => {
				if (filePath === `/home/user/${AGENTZ_DIR_NAME}/config.json`) {
					return JSON.stringify({
						apiKey: "user-key",
						autoApprovalEnabled: true,
					}) as any
				}
				if (filePath === path.join(tempDir, ".roo-cli.json")) {
					return JSON.stringify({
						apiKey: "project-key",
						apiModelId: "project-model",
					}) as any
				}
				throw new Error("File not found")
			})

			configManager = new CliConfigManager({ cwd: tempDir })
			const config = await configManager.loadConfiguration()

			// Environment should override project config (documented priority)
			expect(config.apiModelId).toBe("env-model")
			expect(config.apiKey).toBe("env-key")

			// User config should be used when not overridden by environment or project
			expect(config.autoApprovalEnabled).toBe(true)
		})
	})

	describe("environment variable parsing", () => {
		test("should parse boolean environment variables correctly", async () => {
			process.env.ROO_AUTO_APPROVAL = "true"
			process.env.ROO_VERBOSE = "false"

			configManager = new CliConfigManager({ cwd: tempDir })
			const config = await configManager.loadConfiguration()

			expect(config.autoApprovalEnabled).toBe(true)
		})

		test("should parse numeric environment variables correctly", async () => {
			process.env.ROO_MAX_REQUESTS = "100"
			process.env.ROO_REQUEST_DELAY = "5"

			configManager = new CliConfigManager({ cwd: tempDir })
			const config = await configManager.loadConfiguration()

			expect(config.allowedMaxRequests).toBe(100)
			expect(config.requestDelaySeconds).toBe(5)
		})
	})
})
