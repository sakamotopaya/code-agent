import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import { IStorageService } from "../../interfaces/IStorageService"
import { getStoragePath } from "../../../shared/paths"

/**
 * CLI implementation of storage service
 * Uses file system for persistence and OS home directory for storage location
 */
export class CliStorageService implements IStorageService {
	private globalStoragePath: string
	private globalStateCache: Map<string, any> = new Map()
	private secretsCache: Map<string, string> = new Map()
	private verbose: boolean

	constructor(options: { globalStoragePath?: string; verbose?: boolean } = {}) {
		this.globalStoragePath = options.globalStoragePath || getStoragePath()
		this.verbose = options.verbose ?? false

		if (this.verbose) {
			console.log(`[CLI Storage] Using storage path: ${this.globalStoragePath}`)
		}
	}

	getGlobalStoragePath(): string {
		return this.globalStoragePath
	}

	getGlobalState<T>(key: string): T | undefined {
		return this.globalStateCache.get(key) as T | undefined
	}

	async setGlobalState<T>(key: string, value: T): Promise<void> {
		this.globalStateCache.set(key, value)

		if (this.verbose) {
			console.log(`[CLI Storage] Set global state: ${key}`)
		}

		// Optionally persist to file system
		try {
			await this.ensureStorageDirectory()
			const statePath = path.join(this.globalStoragePath, "global-state.json")
			const stateObject = Object.fromEntries(this.globalStateCache.entries())
			await fs.writeFile(statePath, JSON.stringify(stateObject, null, 2))
		} catch (error) {
			if (this.verbose) {
				console.error(`[CLI Storage] Failed to persist global state:`, error)
			}
		}
	}

	getSecret(key: string): string | undefined {
		return this.secretsCache.get(key)
	}

	async setSecret(key: string, value: string): Promise<void> {
		this.secretsCache.set(key, value)

		if (this.verbose) {
			console.log(`[CLI Storage] Set secret: ${key}`)
		}

		// Optionally persist to file system (in real implementation, this should be encrypted)
		try {
			await this.ensureStorageDirectory()
			const secretsPath = path.join(this.globalStoragePath, "secrets.json")
			const secretsObject = Object.fromEntries(this.secretsCache.entries())
			await fs.writeFile(secretsPath, JSON.stringify(secretsObject, null, 2))
		} catch (error) {
			if (this.verbose) {
				console.error(`[CLI Storage] Failed to persist secrets:`, error)
			}
		}
	}

	/**
	 * Load persisted state from file system
	 */
	async initialize(): Promise<void> {
		try {
			await this.ensureStorageDirectory()

			// Load global state
			const statePath = path.join(this.globalStoragePath, "global-state.json")
			try {
				const stateData = await fs.readFile(statePath, "utf-8")
				const stateObject = JSON.parse(stateData)
				this.globalStateCache = new Map(Object.entries(stateObject))

				if (this.verbose) {
					console.log(`[CLI Storage] Loaded ${this.globalStateCache.size} global state entries`)
				}
			} catch (error) {
				// File doesn't exist or is invalid, start with empty state
				if (this.verbose) {
					console.log(`[CLI Storage] No existing global state found`)
				}
			}

			// Load secrets
			const secretsPath = path.join(this.globalStoragePath, "secrets.json")
			try {
				const secretsData = await fs.readFile(secretsPath, "utf-8")
				const secretsObject = JSON.parse(secretsData)
				this.secretsCache = new Map(Object.entries(secretsObject))

				if (this.verbose) {
					console.log(`[CLI Storage] Loaded ${this.secretsCache.size} secrets`)
				}
			} catch (error) {
				// File doesn't exist or is invalid, start with empty secrets
				if (this.verbose) {
					console.log(`[CLI Storage] No existing secrets found`)
				}
			}
		} catch (error) {
			if (this.verbose) {
				console.error(`[CLI Storage] Failed to initialize storage:`, error)
			}
		}
	}

	private async ensureStorageDirectory(): Promise<void> {
		try {
			await fs.mkdir(this.globalStoragePath, { recursive: true })
		} catch (error) {
			// Directory already exists or creation failed
		}
	}
}
