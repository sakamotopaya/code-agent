import { IStorageService } from "../../interfaces"

export interface ApiStorageOptions {
	verbose?: boolean
}

export class ApiStorageService implements IStorageService {
	private storage: Map<string, any> = new Map()
	private options: ApiStorageOptions

	constructor(options: ApiStorageOptions = {}) {
		this.options = {
			verbose: false,
			...options,
		}
	}

	private log(message: string): void {
		if (this.options.verbose) {
			console.log(`[API Storage] ${message}`)
		}
	}

	async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
		const value = this.storage.get(key)
		this.log(`Get: ${key} = ${value !== undefined ? "found" : "not found"}`)
		return value !== undefined ? value : defaultValue
	}

	async set<T>(key: string, value: T): Promise<void> {
		this.storage.set(key, value)
		this.log(`Set: ${key}`)
	}

	async delete(key: string): Promise<void> {
		const deleted = this.storage.delete(key)
		this.log(`Delete: ${key} ${deleted ? "success" : "not found"}`)
	}

	async clear(): Promise<void> {
		this.storage.clear()
		this.log(`Cleared all storage`)
	}

	async has(key: string): Promise<boolean> {
		const exists = this.storage.has(key)
		this.log(`Has: ${key} = ${exists}`)
		return exists
	}

	async keys(): Promise<string[]> {
		const keyList = Array.from(this.storage.keys())
		this.log(`Keys: ${keyList.length} found`)
		return keyList
	}

	async size(): Promise<number> {
		return this.storage.size
	}
}
