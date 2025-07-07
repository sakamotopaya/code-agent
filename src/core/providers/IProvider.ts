import { EventEmitter } from "events"
import type { ProviderSettings } from "@roo-code/types"

/**
 * Provider types for different execution contexts
 */
export enum ProviderType {
	VSCode = "vscode",
	FileSystem = "filesystem",
	Memory = "memory",
}

/**
 * Events emitted by providers
 */
export type ProviderEvent = "stateChanged" | "modeChanged" | "configurationChanged" | "initialized" | "disposed"

/**
 * Core provider state schema
 */
export interface ProviderState {
	// Core settings
	mode: string
	apiConfiguration: ProviderSettings

	// User preferences
	autoApprovalEnabled: boolean
	alwaysApproveResubmit: boolean
	requestDelaySeconds: number

	// Context settings
	autoCondenseContext: boolean
	autoCondenseContextPercent: number

	// UI settings (extension-specific)
	maxOpenTabsContext?: number
	terminalOutputLineLimit?: number
	maxWorkspaceFiles?: number
	showRooIgnoredFiles?: boolean

	// Custom settings
	customInstructions?: string
	language?: string
	experiments?: Record<string, boolean>

	// Mode configurations
	customModes?: any[]
	customModePrompts?: any[]

	// Session data
	lastUsed?: Date
	sessionId?: string
}

/**
 * Provider settings entry for API configurations
 */
export interface ProviderSettingsEntry {
	id: string
	name: string
	config: ProviderSettings
	isDefault?: boolean
	createdAt: Date
	updatedAt: Date
}

/**
 * Unified provider interface for all execution contexts
 */
export interface IProvider extends EventEmitter {
	// Identification
	readonly type: ProviderType
	readonly isInitialized: boolean

	// State management
	getState(): Promise<ProviderState>
	updateState(key: keyof ProviderState, value: any): Promise<void>
	setState(state: Partial<ProviderState>): Promise<void>

	// Mode management
	getCurrentMode(): Promise<string>
	setMode(mode: string): Promise<void>
	getModeHistory(): Promise<string[]>

	// Configuration management
	getApiConfiguration(): Promise<ProviderSettings>
	setApiConfiguration(config: ProviderSettings): Promise<void>
	listApiConfigurations(): Promise<ProviderSettingsEntry[]>

	// Storage
	getStoragePath(): string
	getGlobalStoragePath(): string

	// Factory methods for context-specific services
	createUrlContentFetcher(): any // IUrlContentFetcher when interface exists
	createBrowserSession(): any // IBrowserSession when interface exists
	createFileContextTracker(taskId: string): any // IFileContextTracker when interface exists

	// Lifecycle
	initialize(): Promise<void>
	dispose(): Promise<void>
}

/**
 * Base provider implementation with common functionality
 */
export abstract class BaseProvider extends EventEmitter implements IProvider {
	protected _isInitialized: boolean = false
	protected _type: ProviderType

	constructor(type: ProviderType) {
		super()
		this._type = type
	}

	get type(): ProviderType {
		return this._type
	}

	get isInitialized(): boolean {
		return this._isInitialized
	}

	// Abstract methods that must be implemented by concrete providers
	abstract getState(): Promise<ProviderState>
	abstract updateState(key: keyof ProviderState, value: any): Promise<void>
	abstract setState(state: Partial<ProviderState>): Promise<void>
	abstract getCurrentMode(): Promise<string>
	abstract setMode(mode: string): Promise<void>
	abstract getModeHistory(): Promise<string[]>
	abstract getApiConfiguration(): Promise<ProviderSettings>
	abstract setApiConfiguration(config: ProviderSettings): Promise<void>
	abstract listApiConfigurations(): Promise<ProviderSettingsEntry[]>
	abstract getStoragePath(): string
	abstract getGlobalStoragePath(): string
	abstract createUrlContentFetcher(): any
	abstract createBrowserSession(): any
	abstract createFileContextTracker(taskId: string): any
	abstract initialize(): Promise<void>
	abstract dispose(): Promise<void>

	/**
	 * Create default provider state
	 */
	protected createDefaultState(): ProviderState {
		return {
			mode: "code",
			apiConfiguration: {
				apiProvider: "anthropic",
				apiKey: "",
				apiModelId: "claude-3-5-sonnet-20241022",
			},
			autoApprovalEnabled: false,
			alwaysApproveResubmit: false,
			requestDelaySeconds: 0,
			autoCondenseContext: true,
			autoCondenseContextPercent: 100,
			lastUsed: new Date(),
		}
	}

	/**
	 * Generate a unique session ID
	 */
	protected generateSessionId(): string {
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Validate provider state schema
	 */
	protected validateState(state: any): state is ProviderState {
		return (
			typeof state === "object" &&
			typeof state.mode === "string" &&
			typeof state.apiConfiguration === "object" &&
			typeof state.autoApprovalEnabled === "boolean" &&
			typeof state.alwaysApproveResubmit === "boolean" &&
			typeof state.requestDelaySeconds === "number" &&
			typeof state.autoCondenseContext === "boolean" &&
			typeof state.autoCondenseContextPercent === "number"
		)
	}

	/**
	 * Emit state change event
	 */
	protected emitStateChanged(key: keyof ProviderState, value: any): void {
		this.emit("stateChanged", key, value)
	}

	/**
	 * Emit mode change event
	 */
	protected emitModeChanged(oldMode: string, newMode: string): void {
		this.emit("modeChanged", oldMode, newMode)
	}
}
