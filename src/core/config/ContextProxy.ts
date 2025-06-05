import { ZodError } from "zod"

import {
	PROVIDER_SETTINGS_KEYS,
	GLOBAL_SETTINGS_KEYS,
	SECRET_STATE_KEYS,
	GLOBAL_STATE_KEYS,
	type ProviderSettings,
	type GlobalSettings,
	type SecretState,
	type GlobalState,
	type RooCodeSettings,
	providerSettingsSchema,
	globalSettingsSchema,
	isSecretStateKey,
} from "@roo-code/types"

import { logger } from "../../utils/logging"
import { getPlatformServicesSync, isVsCodeContext } from "../adapters/PlatformServiceFactory"

// Dynamic imports for VSCode-specific functionality
function getVsCodeModule() {
	try {
		return require("vscode")
	} catch {
		return null
	}
}

function getTelemetryService() {
	try {
		return require("@roo-code/telemetry").TelemetryService
	} catch {
		return null
	}
}

type GlobalStateKey = keyof GlobalState
type SecretStateKey = keyof SecretState
type RooCodeSettingsKey = keyof RooCodeSettings

const PASS_THROUGH_STATE_KEYS = ["taskHistory"]

export const isPassThroughStateKey = (key: string) => PASS_THROUGH_STATE_KEYS.includes(key)

const globalSettingsExportSchema = globalSettingsSchema.omit({
	taskHistory: true,
	listApiConfigMeta: true,
	currentApiConfigName: true,
})

export class ContextProxy {
	private readonly originalContext: any // VSCode ExtensionContext or null for CLI
	private readonly platformServices: any

	private stateCache: GlobalState
	private secretCache: SecretState
	private _isInitialized = false

	constructor(context?: any) {
		this.originalContext = context || null
		this.platformServices = isVsCodeContext() ? null : getPlatformServicesSync()
		this.stateCache = {}
		this.secretCache = {}
		this._isInitialized = false
	}

	/**
	 * Helper method to get values from either VSCode context or platform services
	 */
	private getFromStorage<T>(key: string, storageType: "globalState" | "secrets" = "globalState"): T | undefined {
		if (isVsCodeContext() && this.originalContext) {
			if (storageType === "secrets") {
				return this.originalContext.secrets.get(key)
			}
			return this.originalContext.globalState.get(key)
		} else if (this.platformServices) {
			if (storageType === "secrets") {
				// In CLI mode, secrets are stored as prefixed config keys
				return this.platformServices.configuration.get(`secret:${key}`) as T
			}
			return this.platformServices.configuration.get(key) as T
		}
		return undefined
	}

	/**
	 * Helper method to set values to either VSCode context or platform services
	 */
	private async setToStorage<T>(
		key: string,
		value: T,
		storageType: "globalState" | "secrets" = "globalState",
	): Promise<void> {
		if (isVsCodeContext() && this.originalContext) {
			if (storageType === "secrets") {
				return value === undefined
					? this.originalContext.secrets.delete(key)
					: this.originalContext.secrets.store(key, value)
			}
			return this.originalContext.globalState.update(key, value)
		} else if (this.platformServices) {
			if (storageType === "secrets") {
				// In CLI mode, store secrets as regular config (not ideal but functional)
				// TODO: Implement proper secret storage for CLI
				return this.platformServices.configuration.set(`secret:${key}`, value)
			}
			return this.platformServices.configuration.set(key, value)
		}
	}

	public get isInitialized() {
		return this._isInitialized
	}

	public async initialize() {
		for (const key of GLOBAL_STATE_KEYS) {
			try {
				this.stateCache[key] = this.getFromStorage(key)
			} catch (error) {
				logger.error(`Error loading global ${key}: ${error instanceof Error ? error.message : String(error)}`)
			}
		}

		const promises = SECRET_STATE_KEYS.map(async (key) => {
			try {
				this.secretCache[key] = await this.getFromStorage(key, "secrets")
			} catch (error) {
				logger.error(`Error loading secret ${key}: ${error instanceof Error ? error.message : String(error)}`)
			}
		})

		await Promise.all(promises)

		this._isInitialized = true
	}

	public get extensionUri() {
		return this.originalContext.extensionUri
	}

	public get extensionPath() {
		return this.originalContext.extensionPath
	}

	public get globalStorageUri() {
		return this.originalContext.globalStorageUri
	}

	public get logUri() {
		return this.originalContext.logUri
	}

	public get extension() {
		return this.originalContext.extension
	}

	public get extensionMode() {
		return this.originalContext.extensionMode
	}

	/**
	 * ExtensionContext.globalState
	 * https://code.visualstudio.com/api/references/vscode-api#ExtensionContext.globalState
	 */

	getGlobalState<K extends GlobalStateKey>(key: K): GlobalState[K]
	getGlobalState<K extends GlobalStateKey>(key: K, defaultValue: GlobalState[K]): GlobalState[K]
	getGlobalState<K extends GlobalStateKey>(key: K, defaultValue?: GlobalState[K]): GlobalState[K] {
		if (isPassThroughStateKey(key)) {
			const value = this.getFromStorage<GlobalState[K]>(key)
			return value === undefined || value === null ? defaultValue : value
		}

		const value = this.stateCache[key]
		return value !== undefined ? value : defaultValue
	}

	async updateGlobalState<K extends GlobalStateKey>(key: K, value: GlobalState[K]) {
		if (isPassThroughStateKey(key)) {
			return this.setToStorage(key, value)
		}

		this.stateCache[key] = value
		return this.setToStorage(key, value)
	}

	private getAllGlobalState(): GlobalState {
		return Object.fromEntries(GLOBAL_STATE_KEYS.map((key) => [key, this.getGlobalState(key)]))
	}

	/**
	 * ExtensionContext.secrets
	 * https://code.visualstudio.com/api/references/vscode-api#ExtensionContext.secrets
	 */

	getSecret(key: SecretStateKey) {
		return this.secretCache[key]
	}

	async storeSecret(key: SecretStateKey, value?: string) {
		// Update cache.
		this.secretCache[key] = value

		// Write directly to context or platform storage
		return this.setToStorage(key, value, "secrets")
	}

	private getAllSecretState(): SecretState {
		return Object.fromEntries(SECRET_STATE_KEYS.map((key) => [key, this.getSecret(key)]))
	}

	/**
	 * GlobalSettings
	 */

	public getGlobalSettings(): GlobalSettings {
		const values = this.getValues()

		try {
			return globalSettingsSchema.parse(values)
		} catch (error) {
			if (error instanceof ZodError) {
				const TelemetryService = getTelemetryService()
				if (TelemetryService?.instance) {
					TelemetryService.instance.captureSchemaValidationError({ schemaName: "GlobalSettings", error })
				}
			}

			return GLOBAL_SETTINGS_KEYS.reduce((acc, key) => ({ ...acc, [key]: values[key] }), {} as GlobalSettings)
		}
	}

	/**
	 * ProviderSettings
	 */

	public getProviderSettings(): ProviderSettings {
		const values = this.getValues()

		try {
			return providerSettingsSchema.parse(values)
		} catch (error) {
			if (error instanceof ZodError) {
				const TelemetryService = getTelemetryService()
				if (TelemetryService?.instance) {
					TelemetryService.instance.captureSchemaValidationError({ schemaName: "ProviderSettings", error })
				}
			}

			return PROVIDER_SETTINGS_KEYS.reduce((acc, key) => ({ ...acc, [key]: values[key] }), {} as ProviderSettings)
		}
	}

	public async setProviderSettings(values: ProviderSettings) {
		// Explicitly clear out any old API configuration values before that
		// might not be present in the new configuration.
		// If a value is not present in the new configuration, then it is assumed
		// that the setting's value should be `undefined` and therefore we
		// need to remove it from the state cache if it exists.

		// Ensure openAiHeaders is always an object even when empty
		// This is critical for proper serialization/deserialization through IPC
		if (values.openAiHeaders !== undefined) {
			// Check if it's empty or null
			if (!values.openAiHeaders || Object.keys(values.openAiHeaders).length === 0) {
				values.openAiHeaders = {}
			}
		}

		await this.setValues({
			...PROVIDER_SETTINGS_KEYS.filter((key) => !isSecretStateKey(key))
				.filter((key) => !!this.stateCache[key])
				.reduce((acc, key) => ({ ...acc, [key]: undefined }), {} as ProviderSettings),
			...values,
		})
	}

	/**
	 * RooCodeSettings
	 */

	public setValue<K extends RooCodeSettingsKey>(key: K, value: RooCodeSettings[K]) {
		return isSecretStateKey(key) ? this.storeSecret(key, value as string) : this.updateGlobalState(key, value)
	}

	public getValue<K extends RooCodeSettingsKey>(key: K): RooCodeSettings[K] {
		return isSecretStateKey(key)
			? (this.getSecret(key) as RooCodeSettings[K])
			: (this.getGlobalState(key) as RooCodeSettings[K])
	}

	public getValues(): RooCodeSettings {
		return { ...this.getAllGlobalState(), ...this.getAllSecretState() }
	}

	public async setValues(values: RooCodeSettings) {
		const entries = Object.entries(values) as [RooCodeSettingsKey, unknown][]
		await Promise.all(entries.map(([key, value]) => this.setValue(key, value)))
	}

	/**
	 * Import / Export
	 */

	public async export(): Promise<GlobalSettings | undefined> {
		try {
			const globalSettings = globalSettingsExportSchema.parse(this.getValues())

			// Exports should only contain global settings, so this skips project custom modes (those exist in the .roomode folder)
			globalSettings.customModes = globalSettings.customModes?.filter((mode) => mode.source === "global")

			return Object.fromEntries(Object.entries(globalSettings).filter(([_, value]) => value !== undefined))
		} catch (error) {
			if (error instanceof ZodError) {
				const TelemetryService = getTelemetryService()
				if (TelemetryService?.instance) {
					TelemetryService.instance.captureSchemaValidationError({ schemaName: "GlobalSettings", error })
				}
			}

			return undefined
		}
	}

	/**
	 * Resets all global state, secrets, and in-memory caches.
	 * This clears all data from both the in-memory caches and the VSCode storage.
	 * @returns A promise that resolves when all reset operations are complete
	 */
	public async resetAllState() {
		// Clear in-memory caches
		this.stateCache = {}
		this.secretCache = {}

		await Promise.all([
			...GLOBAL_STATE_KEYS.map((key) => this.setToStorage(key, undefined)),
			...SECRET_STATE_KEYS.map((key) => this.setToStorage(key, undefined, "secrets")),
		])

		await this.initialize()
	}

	private static _instance: ContextProxy | null = null

	static get instance() {
		if (!this._instance) {
			throw new Error("ContextProxy not initialized")
		}

		if (!this._instance.isInitialized) {
			throw new Error("ContextProxy not initialized")
		}

		return this._instance
	}

	static async getInstance(context?: any) {
		if (this._instance && this._instance.isInitialized) {
			return this._instance
		}

		this._instance = new ContextProxy(context)
		await this._instance.initialize()

		return this._instance
	}

	/**
	 * Initialize a test instance without requiring a VSCode context
	 * This is useful for unit tests that need a ContextProxy instance
	 */
	static initializeTestInstance(): ContextProxy {
		// Create a mock context for testing
		const mockContext = {
			globalState: {
				get: () => undefined,
				update: () => Promise.resolve(),
			},
			secrets: {
				get: () => Promise.resolve(undefined),
				store: () => Promise.resolve(),
				delete: () => Promise.resolve(),
			},
			extensionUri: {} as any,
			extensionPath: "/test/path",
			globalStorageUri: {} as any,
			logUri: {} as any,
			extension: {} as any,
			extensionMode: 1 as any,
		} as any

		this._instance = new ContextProxy(mockContext)
		this._instance._isInitialized = true
		this._instance.stateCache = {}
		this._instance.secretCache = {}

		return this._instance
	}

	/**
	 * Reset the singleton instance (useful for tests)
	 */
	static reset() {
		this._instance = null
	}
}
