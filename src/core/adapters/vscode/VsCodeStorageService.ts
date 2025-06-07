import * as vscode from "vscode"
import { IStorageService } from "../../interfaces/IStorageService"

/**
 * VSCode implementation of storage service
 * Uses VSCode's built-in storage mechanisms
 */
export class VsCodeStorageService implements IStorageService {
	constructor(private context: vscode.ExtensionContext) {}

	/**
	 * Get the global storage path for this environment
	 */
	getGlobalStoragePath(): string {
		return this.context.globalStorageUri?.fsPath || ""
	}

	/**
	 * Get a value from global state
	 */
	getGlobalState<T>(key: string): T | undefined {
		return this.context.globalState.get(key)
	}

	/**
	 * Set a value in global state
	 */
	async setGlobalState<T>(key: string, value: T): Promise<void> {
		await this.context.globalState.update(key, value)
	}

	/**
	 * Get a secret value
	 */
	getSecret(key: string): string | undefined {
		// Note: VSCode secrets are async, but interface expects sync
		// This is a limitation - in practice, secrets would need to be cached
		// or the interface would need to be async
		return undefined
	}

	/**
	 * Set a secret value
	 */
	async setSecret(key: string, value: string): Promise<void> {
		await this.context.secrets.store(key, value)
	}
}
