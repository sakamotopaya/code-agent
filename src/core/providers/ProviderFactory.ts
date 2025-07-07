import { IProvider, ProviderType } from "./IProvider"

/**
 * Options for creating providers
 */
export interface ProviderFactoryOptions {
	// VSCode specific
	context?: any // vscode.ExtensionContext

	// FileSystem specific
	configPath?: string

	// Memory specific
	sessionTimeout?: number
	maxSessions?: number
	persistenceAdapter?: any
	defaultState?: any

	// Common options
	enableLogging?: boolean
	logLevel?: "debug" | "info" | "warn" | "error"
}

/**
 * Factory for creating appropriate providers based on execution context
 */
export class ProviderFactory {
	private static registeredProviders: Map<ProviderType, () => Promise<any>> = new Map()

	/**
	 * Create a provider based on type or auto-detection
	 */
	static async createProvider(type?: ProviderType, options: ProviderFactoryOptions = {}): Promise<IProvider> {
		const providerType = type || this.detectProviderType()

		try {
			switch (providerType) {
				case ProviderType.VSCode:
					return await this.createVSCodeProvider(options)

				case ProviderType.FileSystem:
					return await this.createFileSystemProvider(options)

				case ProviderType.Memory:
					return await this.createMemoryProvider(options)

				default:
					throw new Error(`Unsupported provider type: ${providerType}`)
			}
		} catch (error) {
			console.error(`Failed to create provider of type ${providerType}:`, error)

			// Fallback to memory provider if creation fails
			if (providerType !== ProviderType.Memory) {
				console.warn(`Falling back to memory provider`)
				return await this.createMemoryProvider(options)
			}

			throw error
		}
	}

	/**
	 * Detect the appropriate provider type based on environment
	 */
	static detectProviderType(): ProviderType {
		// Check if running in VS Code extension context
		if (typeof globalThis !== "undefined" && (globalThis as any).vscode !== undefined) {
			return ProviderType.VSCode
		}

		// Check if running in CLI context
		if (
			(typeof process !== "undefined" && process.env.NODE_ENV === "cli") ||
			process.argv.some((arg) => arg.includes("cli"))
		) {
			return ProviderType.FileSystem
		}

		// Check for API server context
		if (typeof process !== "undefined" && (process.env.NODE_ENV === "api" || process.env.API_SERVER === "true")) {
			return ProviderType.Memory
		}

		// Default to memory provider for unknown contexts
		return ProviderType.Memory
	}

	/**
	 * Register a custom provider factory
	 */
	static registerProvider(type: ProviderType, factory: () => Promise<any>): void {
		this.registeredProviders.set(type, factory)
	}

	/**
	 * Check if a provider type is supported
	 */
	static isProviderSupported(type: ProviderType): boolean {
		return (
			this.registeredProviders.has(type) ||
			[ProviderType.VSCode, ProviderType.FileSystem, ProviderType.Memory].includes(type)
		)
	}

	/**
	 * Get list of supported provider types
	 */
	static getSupportedProviders(): ProviderType[] {
		const builtInProviders = [ProviderType.VSCode, ProviderType.FileSystem, ProviderType.Memory]
		const customProviders = Array.from(this.registeredProviders.keys())
		return [...builtInProviders, ...customProviders]
	}

	/**
	 * Create VSCode provider
	 */
	private static async createVSCodeProvider(options: ProviderFactoryOptions): Promise<IProvider> {
		try {
			// For now, fall back to memory provider until VSCodeProvider is implemented
			console.warn("VSCodeProvider not yet implemented, falling back to MemoryProvider")
			return await this.createMemoryProvider(options)
		} catch (error) {
			throw new Error(`Failed to create VSCode provider: ${error.message}`)
		}
	}

	/**
	 * Create FileSystem provider
	 */
	private static async createFileSystemProvider(options: ProviderFactoryOptions): Promise<IProvider> {
		try {
			const { FileSystemProvider } = await import("./FileSystemProvider")
			const provider = new FileSystemProvider(options.configPath)
			await provider.initialize()
			return provider
		} catch (error) {
			throw new Error(`Failed to create FileSystem provider: ${error.message}`)
		}
	}

	/**
	 * Create Memory provider
	 */
	private static async createMemoryProvider(options: ProviderFactoryOptions): Promise<IProvider> {
		try {
			const { MemoryProvider } = await import("./MemoryProvider")

			const memoryOptions = {
				sessionTimeout: options.sessionTimeout,
				maxSessions: options.maxSessions,
				persistenceAdapter: options.persistenceAdapter,
				defaultState: options.defaultState,
			}

			const provider = new MemoryProvider(memoryOptions)
			await provider.initialize()
			return provider
		} catch (error) {
			throw new Error(`Failed to create Memory provider: ${error.message}`)
		}
	}

	/**
	 * Create provider with error handling and fallbacks
	 */
	static async createProviderSafe(type?: ProviderType, options: ProviderFactoryOptions = {}): Promise<IProvider> {
		try {
			return await this.createProvider(type, options)
		} catch (error) {
			console.error("Provider creation failed, using fallback:", error)

			// Create a minimal memory provider as last resort
			const { MemoryProvider } = await import("./MemoryProvider")
			const fallbackProvider = new MemoryProvider({
				defaultState: options.defaultState,
			})
			await fallbackProvider.initialize()
			return fallbackProvider
		}
	}
}

/**
 * Convenience function to create provider with auto-detection
 */
export async function createProvider(options: ProviderFactoryOptions = {}): Promise<IProvider> {
	return ProviderFactory.createProvider(undefined, options)
}

/**
 * Convenience function to create provider safely with fallbacks
 */
export async function createProviderSafe(options: ProviderFactoryOptions = {}): Promise<IProvider> {
	return ProviderFactory.createProviderSafe(undefined, options)
}
