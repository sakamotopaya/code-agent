import { IStorageService } from "../../interfaces"

export interface ApiStorageOptions {
	verbose?: boolean
}

export class ApiStorageService implements IStorageService {
	private globalState: Map<string, any> = new Map()
	private secrets: Map<string, string> = new Map()
	private options: ApiStorageOptions
	private globalStoragePath: string

	constructor(options: ApiStorageOptions = {}) {
		this.options = {
			verbose: false,
			...options,
		}
		// In API context, this would be a real path
		this.globalStoragePath = "/tmp/api-storage"
	}

	private log(message: string): void {
		if (this.options.verbose) {
			console.log(`[API Storage] ${message}`)
		}
	}

	getGlobalStoragePath(): string {
		return this.globalStoragePath
	}

	getGlobalState<T>(key: string): T | undefined {
		const value = this.globalState.get(key)
		this.log(`Get global state: ${key} = ${value !== undefined ? "found" : "not found"}`)
		return value
	}

	async setGlobalState<T>(key: string, value: T): Promise<void> {
		this.globalState.set(key, value)
		this.log(`Set global state: ${key}`)
	}

	getSecret(key: string): string | undefined {
		const value = this.secrets.get(key)
		this.log(`Get secret: ${key} = ${value !== undefined ? "found" : "not found"}`)
		return value
	}

	async setSecret(key: string, value: string): Promise<void> {
		this.secrets.set(key, value)
		this.log(`Set secret: ${key}`)
	}
}
