import { UnifiedCustomModesService } from "../UnifiedCustomModesService"
import { NoOpFileWatcher } from "../watchers/NoOpFileWatcher"
import { FileWatcherInterface } from "../watchers/FileWatcherInterface"
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"

// Mock dependencies
jest.mock("fs/promises")
jest.mock("../../../utils/fs")
jest.mock("../../modes", () => ({
	modes: [
		{ slug: "code", name: "Code", roleDefinition: "Built-in code mode", groups: ["read", "edit"] },
		{ slug: "debug", name: "Debug", roleDefinition: "Built-in debug mode", groups: ["read"] },
	],
}))

const mockFs = fs as jest.Mocked<typeof fs>
const mockFileExists = require("../../../utils/fs").fileExistsAtPath as jest.MockedFunction<any>

describe("UnifiedCustomModesService", () => {
	let service: UnifiedCustomModesService
	let mockFileWatcher: jest.Mocked<FileWatcherInterface>

	beforeEach(() => {
		jest.clearAllMocks()

		mockFileWatcher = {
			watch: jest.fn(),
			dispose: jest.fn(),
		}

		// Default mock implementations
		mockFileExists.mockResolvedValue(false)
		mockFs.readFile.mockRejectedValue(new Error("File not found"))
	})

	afterEach(() => {
		service?.dispose()
	})

	describe("initialization", () => {
		it("should initialize without file watcher", () => {
			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
			})

			expect(service).toBeDefined()
		})

		it("should initialize with file watcher", () => {
			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
				fileWatcher: mockFileWatcher,
			})

			expect(mockFileWatcher.watch).toHaveBeenCalledWith(
				expect.arrayContaining([
					"/test/storage/settings/custom_modes.yaml",
					"/test/storage/settings/custom_modes.json",
				]),
				expect.any(Function),
			)
		})

		it("should watch project files when enabled", () => {
			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
				fileWatcher: mockFileWatcher,
				enableProjectModes: true,
				workspacePath: "/test/workspace",
			})

			expect(mockFileWatcher.watch).toHaveBeenCalledWith(
				expect.arrayContaining(["/test/workspace/.roomodes"]),
				expect.any(Function),
			)
		})
	})

	describe("loadCustomModes", () => {
		it("should return empty array when no files exist", async () => {
			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
			})

			const modes = await service.loadCustomModes()
			expect(modes).toEqual([])
		})

		it("should load modes from YAML file", async () => {
			const customModes = [
				{ slug: "custom-mode", name: "Custom Mode", roleDefinition: "Custom role", groups: ["read"] },
			]
			const yamlContent = yaml.stringify({ customModes })

			mockFileExists.mockImplementation(async (filePath: string) => {
				return filePath.endsWith("custom_modes.yaml")
			})
			mockFs.readFile.mockImplementation(async (filePath: any) => {
				if (typeof filePath === "string" && filePath.endsWith("custom_modes.yaml")) {
					return yamlContent
				}
				throw new Error("File not found")
			})

			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
			})

			const modes = await service.loadCustomModes()
			expect(modes).toHaveLength(1)
			expect(modes[0]).toMatchObject({
				slug: "custom-mode",
				name: "Custom Mode",
				source: "global",
			})
		})

		it("should load modes from JSON file when YAML not available", async () => {
			const customModes = [
				{ slug: "json-mode", name: "JSON Mode", roleDefinition: "JSON role", groups: ["read"] },
			]
			const jsonContent = JSON.stringify({ customModes })

			mockFileExists.mockImplementation(async (filePath: string) => {
				return filePath.endsWith("custom_modes.json")
			})
			mockFs.readFile.mockImplementation(async (filePath: any) => {
				if (typeof filePath === "string" && filePath.endsWith("custom_modes.json")) {
					return jsonContent
				}
				throw new Error("File not found")
			})

			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
			})

			const modes = await service.loadCustomModes()
			expect(modes).toHaveLength(1)
			expect(modes[0]).toMatchObject({
				slug: "json-mode",
				name: "JSON Mode",
				source: "global",
			})
		})

		it("should merge project and global modes with project precedence", async () => {
			const globalModes = [
				{ slug: "global-mode", name: "Global Mode", roleDefinition: "Global role", groups: ["read"] },
				{ slug: "shared-mode", name: "Global Shared", roleDefinition: "Global shared", groups: ["read"] },
			]
			const projectModes = [
				{ slug: "project-mode", name: "Project Mode", roleDefinition: "Project role", groups: ["edit"] },
				{ slug: "shared-mode", name: "Project Shared", roleDefinition: "Project shared", groups: ["edit"] },
			]

			mockFileExists.mockImplementation(async (filePath: string) => {
				return filePath.endsWith("custom_modes.yaml") || filePath.endsWith(".roomodes")
			})
			mockFs.readFile.mockImplementation(async (filePath: any) => {
				if (typeof filePath === "string") {
					if (filePath.endsWith("custom_modes.yaml")) {
						return yaml.stringify({ customModes: globalModes })
					}
					if (filePath.endsWith(".roomodes")) {
						return yaml.stringify({ customModes: projectModes })
					}
				}
				throw new Error("File not found")
			})

			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
				enableProjectModes: true,
				workspacePath: "/test/workspace",
			})

			const modes = await service.loadCustomModes()
			expect(modes).toHaveLength(3)

			// Project modes should come first
			expect(modes[0]).toMatchObject({ slug: "project-mode", source: "project" })
			expect(modes[1]).toMatchObject({ slug: "shared-mode", source: "project" }) // Project overrides global
			expect(modes[2]).toMatchObject({ slug: "global-mode", source: "global" })
		})

		it("should handle invalid YAML gracefully", async () => {
			mockFileExists.mockResolvedValue(true)
			mockFs.readFile.mockResolvedValue("invalid: yaml: content:")

			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
			})

			const modes = await service.loadCustomModes()
			expect(modes).toEqual([])
		})

		it("should cache results", async () => {
			const customModes = [
				{ slug: "cached-mode", name: "Cached Mode", roleDefinition: "Cached role", groups: ["read"] },
			]

			mockFileExists.mockResolvedValue(true)
			mockFs.readFile.mockResolvedValue(yaml.stringify({ customModes }))

			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
			})

			// First call
			const modes1 = await service.loadCustomModes()
			expect(mockFs.readFile).toHaveBeenCalledTimes(1)

			// Second call should use cache
			const modes2 = await service.loadCustomModes()
			expect(mockFs.readFile).toHaveBeenCalledTimes(1) // No additional calls
			expect(modes1).toEqual(modes2)
		})
	})

	describe("getAllModes", () => {
		it("should merge built-in and custom modes", async () => {
			const customModes = [
				{ slug: "custom-mode", name: "Custom Mode", roleDefinition: "Custom role", groups: ["read"] },
				{ slug: "code", name: "Custom Code", roleDefinition: "Custom code override", groups: ["edit"] }, // Override built-in
			]

			mockFileExists.mockResolvedValue(true)
			mockFs.readFile.mockResolvedValue(yaml.stringify({ customModes }))

			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
			})

			const allModes = await service.getAllModes()

			// Should have built-in modes + custom modes, with custom overriding built-in
			expect(allModes).toHaveLength(3) // code (overridden), debug, custom-mode

			const codeMode = allModes.find((m) => m.slug === "code")
			expect(codeMode?.name).toBe("Custom Code") // Should be overridden

			const customMode = allModes.find((m) => m.slug === "custom-mode")
			expect(customMode).toBeDefined()

			const debugMode = allModes.find((m) => m.slug === "debug")
			expect(debugMode?.name).toBe("Debug") // Should remain built-in
		})
	})

	describe("getMode", () => {
		it("should return specific mode by slug", async () => {
			const customModes = [
				{ slug: "target-mode", name: "Target Mode", roleDefinition: "Target role", groups: ["read"] },
			]

			mockFileExists.mockResolvedValue(true)
			mockFs.readFile.mockResolvedValue(yaml.stringify({ customModes }))

			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
			})

			const mode = await service.getMode("target-mode")
			expect(mode).toMatchObject({
				slug: "target-mode",
				name: "Target Mode",
			})
		})

		it("should return undefined for non-existent mode", async () => {
			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
			})

			const mode = await service.getMode("non-existent")
			expect(mode).toBeUndefined()
		})
	})

	describe("file watching", () => {
		it("should invalidate cache when files change", async () => {
			let watchCallback: (() => void) | undefined

			mockFileWatcher.watch.mockImplementation((paths, callback) => {
				watchCallback = callback
			})

			const customModes = [
				{ slug: "watched-mode", name: "Watched Mode", roleDefinition: "Watched role", groups: ["read"] },
			]

			mockFileExists.mockResolvedValue(true)
			mockFs.readFile.mockResolvedValue(yaml.stringify({ customModes }))

			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
				fileWatcher: mockFileWatcher,
			})

			// Load modes to populate cache
			await service.loadCustomModes()
			expect(mockFs.readFile).toHaveBeenCalledTimes(1)

			// Simulate file change
			watchCallback?.()

			// Next load should re-read files
			await service.loadCustomModes()
			expect(mockFs.readFile).toHaveBeenCalledTimes(2)
		})
	})

	describe("dispose", () => {
		it("should dispose file watcher and clear cache", () => {
			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
				fileWatcher: mockFileWatcher,
			})

			service.dispose()

			expect(mockFileWatcher.dispose).toHaveBeenCalled()
		})

		it("should return empty array after disposal", async () => {
			service = new UnifiedCustomModesService({
				storagePath: "/test/storage",
			})

			service.dispose()

			const modes = await service.loadCustomModes()
			expect(modes).toEqual([])
		})
	})
})
