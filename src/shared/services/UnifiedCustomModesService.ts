import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "yaml"
import { type ModeConfig, customModesSettingsSchema } from "@roo-code/types"
import { fileExistsAtPath } from "../../utils/fs"
import { FileWatcherInterface } from "./watchers/FileWatcherInterface"
import { GlobalFileNames } from "../globalFileNames"

const ROOMODES_FILENAME = ".roomodes"

export interface CustomModesServiceOptions {
	storagePath: string
	fileWatcher?: FileWatcherInterface
	enableProjectModes?: boolean
	workspacePath?: string
	onUpdate?: () => Promise<void>
}

/**
 * Unified custom modes service that works across all execution contexts
 * Supports dependency injection for file watching and configurable storage paths
 */
export class UnifiedCustomModesService {
	private static readonly cacheTTL = 10_000 // 10 seconds

	private cachedModes: ModeConfig[] | null = null
	private cachedAt: number = 0
	private isDisposed = false
	private isWriting = false
	private writeQueue: Array<() => Promise<void>> = []

	constructor(private options: CustomModesServiceOptions) {
		this.setupFileWatching()
	}

	/**
	 * Load custom modes from configured storage paths
	 * Merges global and project modes with project taking precedence
	 */
	async loadCustomModes(): Promise<ModeConfig[]> {
		if (this.isDisposed) {
			return []
		}

		// Check cache first
		const now = Date.now()
		if (this.cachedModes && now - this.cachedAt < UnifiedCustomModesService.cacheTTL) {
			return this.cachedModes
		}

		try {
			// Load global modes from storage path
			const globalModes = await this.loadGlobalModes()

			// Load project modes if enabled
			const projectModes = this.options.enableProjectModes ? await this.loadProjectModes() : []

			// Merge modes with project taking precedence
			const mergedModes = this.mergeModes(projectModes, globalModes)

			// Update cache
			this.cachedModes = mergedModes
			this.cachedAt = now

			return mergedModes
		} catch (error) {
			console.warn("Failed to load custom modes:", error)
			return []
		}
	}

	/**
	 * Get a specific mode by slug
	 */
	async getMode(slug: string): Promise<ModeConfig | undefined> {
		const modes = await this.loadCustomModes()
		return modes.find((mode) => mode.slug === slug)
	}

	/**
	 * Get all available modes (built-in + custom)
	 */
	async getAllModes(): Promise<ModeConfig[]> {
		// Import built-in modes
		const { modes: builtInModes } = await import("../modes")
		const customModes = await this.loadCustomModes()

		// Merge with custom modes overriding built-in modes by slug
		const allModes = [...builtInModes]

		customModes.forEach((customMode) => {
			const index = allModes.findIndex((mode) => mode.slug === customMode.slug)
			if (index >= 0) {
				// Override built-in mode
				allModes[index] = customMode
			} else {
				// Add new custom mode
				allModes.push(customMode)
			}
		})

		return allModes
	}

	/**
	 * Invalidate cache (called by file watchers)
	 */
	invalidateCache(): void {
		this.cachedModes = null
		this.cachedAt = 0
	}

	/**
	 * Clean up resources
	 */
	dispose(): void {
		this.isDisposed = true
		this.options.fileWatcher?.dispose()
		this.invalidateCache()
	}

	/**
	 * Load global custom modes from storage path
	 */
	private async loadGlobalModes(): Promise<ModeConfig[]> {
		const settingsDir = path.join(this.options.storagePath, "settings")

		// Try YAML first, then JSON
		const yamlPath = path.join(settingsDir, GlobalFileNames.customModes)
		const jsonPath = path.join(settingsDir, "custom_modes.json")

		// Try YAML file first
		if (await fileExistsAtPath(yamlPath)) {
			return this.loadModesFromFile(yamlPath, "global")
		}

		// Fallback to JSON file
		if (await fileExistsAtPath(jsonPath)) {
			return this.loadModesFromFile(jsonPath, "global")
		}

		// No custom modes files found
		return []
	}

	/**
	 * Load project custom modes from .roomodes file
	 */
	private async loadProjectModes(): Promise<ModeConfig[]> {
		if (!this.options.workspacePath) {
			return []
		}

		const roomodesPath = path.join(this.options.workspacePath, ROOMODES_FILENAME)

		if (await fileExistsAtPath(roomodesPath)) {
			return this.loadModesFromFile(roomodesPath, "project")
		}

		return []
	}

	/**
	 * Load modes from a specific file
	 */
	private async loadModesFromFile(filePath: string, source: "global" | "project"): Promise<ModeConfig[]> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const settings = yaml.parse(content)
			const result = customModesSettingsSchema.safeParse(settings)

			if (!result.success) {
				console.warn(`Invalid custom modes format in ${filePath}:`, result.error.errors)
				return []
			}

			// Add source to each mode
			return result.data.customModes.map((mode) => ({ ...mode, source }))
		} catch (error) {
			console.warn(`Failed to load modes from ${filePath}:`, error)
			return []
		}
	}

	/**
	 * Merge project and global modes with project taking precedence
	 */
	private mergeModes(projectModes: ModeConfig[], globalModes: ModeConfig[]): ModeConfig[] {
		const slugs = new Set<string>()
		const merged: ModeConfig[] = []

		// Add project modes first (higher precedence)
		projectModes.forEach((mode) => {
			if (!slugs.has(mode.slug)) {
				merged.push(mode)
				slugs.add(mode.slug)
			}
		})

		// Add global modes that don't conflict
		globalModes.forEach((mode) => {
			if (!slugs.has(mode.slug)) {
				merged.push(mode)
				slugs.add(mode.slug)
			}
		})

		return merged
	}

	/**
	 * Set up file watching if file watcher is provided
	 */
	private setupFileWatching(): void {
		if (!this.options.fileWatcher) {
			return
		}

		const watchPaths: string[] = []

		// Watch global settings files
		const settingsDir = path.join(this.options.storagePath, "settings")
		watchPaths.push(
			path.join(settingsDir, GlobalFileNames.customModes),
			path.join(settingsDir, "custom_modes.json"),
		)

		// Watch project .roomodes file if enabled
		if (this.options.enableProjectModes && this.options.workspacePath) {
			watchPaths.push(path.join(this.options.workspacePath, ROOMODES_FILENAME))
		}

		// Set up file watching with cache invalidation callback
		this.options.fileWatcher.watch(watchPaths, () => {
			this.invalidateCache()
			// Call onUpdate callback if provided (for VSCode extension)
			if (this.options.onUpdate) {
				this.options.onUpdate().catch((error) => {
					console.warn("Error in onUpdate callback:", error)
				})
			}
		})
	}

	// VSCode-specific methods for compatibility with CustomModesManager

	/**
	 * Get custom modes (alias for loadCustomModes for VSCode compatibility)
	 */
	async getCustomModes(): Promise<ModeConfig[]> {
		return this.loadCustomModes()
	}

	/**
	 * Get the path to the custom modes file (VSCode-specific)
	 */
	async getCustomModesFilePath(): Promise<string> {
		const settingsDir = path.join(this.options.storagePath, "settings")
		await fs.mkdir(settingsDir, { recursive: true })

		const filePath = path.join(settingsDir, GlobalFileNames.customModes)
		const fileExists = await fileExistsAtPath(filePath)

		if (!fileExists) {
			await this.queueWrite(() => fs.writeFile(filePath, yaml.stringify({ customModes: [] })))
		}

		return filePath
	}

	/**
	 * Update or create a custom mode (VSCode-specific)
	 */
	async updateCustomMode(slug: string, config: ModeConfig): Promise<void> {
		try {
			const isProjectMode = config.source === "project"
			let targetPath: string

			if (isProjectMode) {
				if (!this.options.workspacePath) {
					throw new Error("No workspace path configured for project-specific mode")
				}
				targetPath = path.join(this.options.workspacePath, ROOMODES_FILENAME)
			} else {
				targetPath = await this.getCustomModesFilePath()
			}

			await this.queueWrite(async () => {
				// Ensure source is set correctly based on target file
				const modeWithSource = {
					...config,
					source: isProjectMode ? ("project" as const) : ("global" as const),
				}

				await this.updateModesInFile(targetPath, (modes) => {
					const updatedModes = modes.filter((m) => m.slug !== slug)
					updatedModes.push(modeWithSource)
					return updatedModes
				})

				this.invalidateCache()
				if (this.options.onUpdate) {
					await this.options.onUpdate()
				}
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error("Failed to update custom mode:", { slug, error: errorMessage })
			throw error
		}
	}

	/**
	 * Delete a custom mode (VSCode-specific)
	 */
	async deleteCustomMode(slug: string): Promise<void> {
		try {
			const settingsPath = await this.getCustomModesFilePath()
			const roomodesPath = this.options.workspacePath
				? path.join(this.options.workspacePath, ROOMODES_FILENAME)
				: null

			const settingsModes = await this.loadModesFromFile(settingsPath, "global")
			const roomodesModes =
				roomodesPath && (await fileExistsAtPath(roomodesPath))
					? await this.loadModesFromFile(roomodesPath, "project")
					: []

			// Find the mode in either file
			const projectMode = roomodesModes.find((m) => m.slug === slug)
			const globalMode = settingsModes.find((m) => m.slug === slug)

			if (!projectMode && !globalMode) {
				throw new Error("Mode not found")
			}

			await this.queueWrite(async () => {
				// Delete from project first if it exists there
				if (projectMode && roomodesPath) {
					await this.updateModesInFile(roomodesPath, (modes) => modes.filter((m) => m.slug !== slug))
				}

				// Delete from global settings if it exists there
				if (globalMode) {
					await this.updateModesInFile(settingsPath, (modes) => modes.filter((m) => m.slug !== slug))
				}

				this.invalidateCache()
				if (this.options.onUpdate) {
					await this.options.onUpdate()
				}
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error("Failed to delete custom mode:", { slug, error: errorMessage })
			throw error
		}
	}

	/**
	 * Reset all custom modes (VSCode-specific)
	 */
	async resetCustomModes(): Promise<void> {
		try {
			const filePath = await this.getCustomModesFilePath()
			await fs.writeFile(filePath, yaml.stringify({ customModes: [] }))
			this.invalidateCache()
			if (this.options.onUpdate) {
				await this.options.onUpdate()
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error("Failed to reset custom modes:", errorMessage)
			throw error
		}
	}

	/**
	 * Queue write operations to prevent conflicts (VSCode-specific)
	 */
	private async queueWrite(operation: () => Promise<void>): Promise<void> {
		this.writeQueue.push(operation)

		if (!this.isWriting) {
			await this.processWriteQueue()
		}
	}

	/**
	 * Process queued write operations (VSCode-specific)
	 */
	private async processWriteQueue(): Promise<void> {
		if (this.isWriting || this.writeQueue.length === 0) {
			return
		}

		this.isWriting = true

		try {
			while (this.writeQueue.length > 0) {
				const operation = this.writeQueue.shift()
				if (operation) {
					await operation()
				}
			}
		} finally {
			this.isWriting = false
		}
	}

	/**
	 * Update modes in a specific file (VSCode-specific)
	 */
	private async updateModesInFile(filePath: string, operation: (modes: ModeConfig[]) => ModeConfig[]): Promise<void> {
		let content = "{}"

		try {
			content = await fs.readFile(filePath, "utf-8")
		} catch (error) {
			// File might not exist yet
			content = yaml.stringify({ customModes: [] })
		}

		let settings

		try {
			settings = yaml.parse(content)
		} catch (error) {
			console.error(`Failed to parse YAML from ${filePath}:`, error)
			settings = { customModes: [] }
		}

		settings.customModes = operation(settings.customModes || [])
		await fs.writeFile(filePath, yaml.stringify(settings), "utf-8")
	}
}
