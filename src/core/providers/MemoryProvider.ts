import { BaseProvider, IProvider, ProviderType, ProviderState, ProviderSettingsEntry } from "./IProvider"
import type { ProviderSettings } from "@roo-code/types"

/**
 * Session data for memory provider
 */
interface SessionData {
	id: string
	state: ProviderState
	createdAt: Date
	lastAccessed: Date
	expiresAt: Date
}

/**
 * Options for memory provider
 */
export interface MemoryProviderOptions {
	// Session management
	sessionTimeout?: number // Session expiration time in ms
	maxSessions?: number // Maximum concurrent sessions
	cleanupInterval?: number // Cleanup timer interval in ms

	// Persistence
	persistenceAdapter?: IPersistenceAdapter

	// Performance
	enableSessionIsolation?: boolean // Enable per-session state isolation
	enableStatePersistence?: boolean // Enable state persistence
	enableSessionCleanup?: boolean // Enable automatic session cleanup

	// Default state
	defaultState?: Partial<ProviderState>
}

/**
 * Persistence adapter interface
 */
export interface IPersistenceAdapter {
	initialize(): Promise<void>
	saveState(state: ProviderState): Promise<void>
	loadState(): Promise<ProviderState | null>
	saveSessionState(sessionId: string, state: ProviderState): Promise<void>
	loadSessionState(sessionId: string): Promise<ProviderState | null>
	deleteSessionState(sessionId: string): Promise<void>
	cleanup(): Promise<void>
}

/**
 * In-memory provider for API usage with optional persistence
 */
export class MemoryProvider extends BaseProvider {
	private state: ProviderState
	private sessionStates: Map<string, SessionData>
	private persistenceAdapter?: IPersistenceAdapter
	private sessionTimeout: number
	private maxSessions: number
	private cleanupInterval: NodeJS.Timeout | null = null
	private cleanupIntervalMs: number
	private enableSessionIsolation: boolean
	private enableStatePersistence: boolean
	private enableSessionCleanup: boolean
	private apiConfigurations: Map<string, ProviderSettingsEntry>
	private modeHistory: string[]

	constructor(options: MemoryProviderOptions = {}) {
		super(ProviderType.Memory)

		// Initialize configuration
		this.sessionTimeout = options.sessionTimeout || 3600000 // 1 hour
		this.maxSessions = options.maxSessions || 1000
		this.cleanupIntervalMs = options.cleanupInterval || 300000 // 5 minutes
		this.enableSessionIsolation = options.enableSessionIsolation ?? false
		this.enableStatePersistence = options.enableStatePersistence ?? false
		this.enableSessionCleanup = options.enableSessionCleanup ?? true
		this.persistenceAdapter = options.persistenceAdapter

		// Initialize state
		this.state = { ...this.createDefaultState(), ...options.defaultState }
		this.sessionStates = new Map()
		this.apiConfigurations = new Map()
		this.modeHistory = [this.state.mode]

		// Set session ID if not provided
		if (!this.state.sessionId) {
			this.state.sessionId = this.generateSessionId()
		}
	}

	async initialize(): Promise<void> {
		try {
			// Initialize persistence adapter if provided
			if (this.persistenceAdapter) {
				await this.persistenceAdapter.initialize()

				if (this.enableStatePersistence) {
					const persistedState = await this.persistenceAdapter.loadState()
					if (persistedState) {
						this.state = { ...this.state, ...persistedState }
					}
				}
			}

			// Start cleanup timer if enabled
			if (this.enableSessionCleanup) {
				this.startCleanupTimer()
			}

			this._isInitialized = true
			this.emit("initialized")
		} catch (error) {
			console.error("Failed to initialize MemoryProvider:", error)
			throw error
		}
	}

	async dispose(): Promise<void> {
		try {
			// Stop cleanup timer
			if (this.cleanupInterval) {
				clearInterval(this.cleanupInterval)
				this.cleanupInterval = null
			}

			// Save state if persistence is enabled
			if (this.persistenceAdapter && this.enableStatePersistence) {
				await this.persistenceAdapter.saveState(this.state)
			}

			// Cleanup persistence adapter
			if (this.persistenceAdapter) {
				await this.persistenceAdapter.cleanup()
			}

			// Clear session states
			this.sessionStates.clear()
			this.apiConfigurations.clear()

			this._isInitialized = false
			this.emit("disposed")
		} catch (error) {
			console.error("Failed to dispose MemoryProvider:", error)
			throw error
		}
	}

	async getState(sessionId?: string): Promise<ProviderState> {
		if (this.enableSessionIsolation && sessionId) {
			const sessionData = this.sessionStates.get(sessionId)
			if (sessionData) {
				sessionData.lastAccessed = new Date()
				return { ...sessionData.state }
			}

			// Create new session if it doesn't exist
			return this.createSessionState(sessionId)
		}

		return { ...this.state }
	}

	async updateState(key: keyof ProviderState, value: any, sessionId?: string): Promise<void> {
		if (this.enableSessionIsolation && sessionId) {
			const sessionData = this.getOrCreateSessionData(sessionId)
			;(sessionData.state as any)[key] = value
			sessionData.state.lastUsed = new Date()
			sessionData.lastAccessed = new Date()

			if (this.persistenceAdapter) {
				await this.persistenceAdapter.saveSessionState(sessionId, sessionData.state)
			}
		} else {
			;(this.state as any)[key] = value
			this.state.lastUsed = new Date()

			if (this.persistenceAdapter && this.enableStatePersistence) {
				await this.persistenceAdapter.saveState(this.state)
			}
		}

		this.emitStateChanged(key, value)
	}

	async setState(state: Partial<ProviderState>, sessionId?: string): Promise<void> {
		if (this.enableSessionIsolation && sessionId) {
			const sessionData = this.getOrCreateSessionData(sessionId)
			sessionData.state = { ...sessionData.state, ...state }
			sessionData.state.lastUsed = new Date()
			sessionData.lastAccessed = new Date()

			if (this.persistenceAdapter) {
				await this.persistenceAdapter.saveSessionState(sessionId, sessionData.state)
			}
		} else {
			this.state = { ...this.state, ...state }
			this.state.lastUsed = new Date()

			if (this.persistenceAdapter && this.enableStatePersistence) {
				await this.persistenceAdapter.saveState(this.state)
			}
		}

		this.emit("stateChanged", state)
	}

	async getCurrentMode(sessionId?: string): Promise<string> {
		const state = await this.getState(sessionId)
		return state.mode
	}

	async setMode(mode: string, sessionId?: string): Promise<void> {
		const oldMode = await this.getCurrentMode(sessionId)
		await this.updateState("mode", mode, sessionId)

		// Update mode history
		if (!this.modeHistory.includes(mode)) {
			this.modeHistory.push(mode)
			// Keep only last 10 modes
			if (this.modeHistory.length > 10) {
				this.modeHistory = this.modeHistory.slice(-10)
			}
		}

		this.emitModeChanged(oldMode, mode)
	}

	async getModeHistory(): Promise<string[]> {
		return [...this.modeHistory]
	}

	async getApiConfiguration(sessionId?: string): Promise<ProviderSettings> {
		const state = await this.getState(sessionId)
		return state.apiConfiguration
	}

	async setApiConfiguration(config: ProviderSettings, sessionId?: string): Promise<void> {
		await this.updateState("apiConfiguration", config, sessionId)
		this.emit("configurationChanged", config)
	}

	async listApiConfigurations(): Promise<ProviderSettingsEntry[]> {
		return Array.from(this.apiConfigurations.values())
	}

	getStoragePath(): string {
		return process.env.AGENTZ_STORAGE_PATH || `${require("os").homedir()}/.agentz/storage`
	}

	getGlobalStoragePath(): string {
		return process.env.AGENTZ_GLOBAL_STORAGE_PATH || `${require("os").homedir()}/.agentz/global`
	}

	createUrlContentFetcher(): any {
		// Import and create UrlContentFetcher with null context for API runtime
		const { UrlContentFetcher } = require("../../services/browser/UrlContentFetcher")
		return new UrlContentFetcher(null)
	}

	createBrowserSession(): any {
		// Import and create BrowserSession with null context for API runtime
		const { BrowserSession } = require("../../services/browser/BrowserSession")
		return new BrowserSession(null)
	}

	createFileContextTracker(taskId: string): any {
		// API runtime needs file tracking - use Node.js file watcher
		const fs = require("fs")
		const path = require("path")

		return {
			taskId,
			watchers: new Map(),

			watchFile(filePath: string) {
				if (!this.watchers.has(filePath)) {
					try {
						const watcher = fs.watch(filePath, (eventType: string) => {
							// Emit file change event
							console.log(`File ${filePath} changed: ${eventType}`)
						})
						this.watchers.set(filePath, watcher)
					} catch (error) {
						console.warn(`Failed to watch file ${filePath}:`, error)
					}
				}
			},

			unwatchFile(filePath: string) {
				const watcher = this.watchers.get(filePath)
				if (watcher) {
					watcher.close()
					this.watchers.delete(filePath)
				}
			},

			dispose() {
				for (const watcher of this.watchers.values()) {
					watcher.close()
				}
				this.watchers.clear()
			},
		}
	}

	/**
	 * Create a new session
	 */
	createSession(): string {
		const sessionId = this.generateSessionId()
		this.createSessionState(sessionId)
		return sessionId
	}

	/**
	 * Delete a session
	 */
	async deleteSession(sessionId: string): Promise<void> {
		this.sessionStates.delete(sessionId)

		if (this.persistenceAdapter) {
			await this.persistenceAdapter.deleteSessionState(sessionId)
		}

		this.emit("sessionDeleted", sessionId)
	}

	/**
	 * Get list of active sessions
	 */
	getActiveSessions(): string[] {
		return Array.from(this.sessionStates.keys())
	}

	/**
	 * Get session count
	 */
	getSessionCount(): number {
		return this.sessionStates.size
	}

	/**
	 * Create or get session data
	 */
	private getOrCreateSessionData(sessionId: string): SessionData {
		let sessionData = this.sessionStates.get(sessionId)

		if (!sessionData) {
			sessionData = {
				id: sessionId,
				state: this.createSessionState(sessionId),
				createdAt: new Date(),
				lastAccessed: new Date(),
				expiresAt: new Date(Date.now() + this.sessionTimeout),
			}

			this.sessionStates.set(sessionId, sessionData)

			// Check session limit
			if (this.sessionStates.size > this.maxSessions) {
				this.evictOldestSession()
			}
		}

		return sessionData
	}

	/**
	 * Create state for a new session
	 */
	private createSessionState(sessionId: string): ProviderState {
		const sessionState = {
			...this.createDefaultState(),
			sessionId,
			lastUsed: new Date(),
		}

		return sessionState
	}

	/**
	 * Start cleanup timer for expired sessions
	 */
	private startCleanupTimer(): void {
		this.cleanupInterval = setInterval(async () => {
			await this.cleanupExpiredSessions()
		}, this.cleanupIntervalMs)
	}

	/**
	 * Cleanup expired sessions
	 */
	private async cleanupExpiredSessions(): Promise<void> {
		const now = new Date()
		const expiredSessions: string[] = []

		for (const [sessionId, sessionData] of this.sessionStates) {
			if (sessionData.expiresAt < now) {
				expiredSessions.push(sessionId)
			}
		}

		for (const sessionId of expiredSessions) {
			await this.deleteSession(sessionId)
		}

		if (expiredSessions.length > 0) {
			this.emit("sessionsCleanedUp", expiredSessions)
		}
	}

	/**
	 * Evict oldest session when limit is reached
	 */
	private evictOldestSession(): void {
		let oldestSession: string | null = null
		let oldestTime = Date.now()

		for (const [sessionId, sessionData] of this.sessionStates) {
			if (sessionData.lastAccessed.getTime() < oldestTime) {
				oldestTime = sessionData.lastAccessed.getTime()
				oldestSession = sessionId
			}
		}

		if (oldestSession) {
			this.sessionStates.delete(oldestSession)
			this.emit("sessionEvicted", oldestSession)
		}
	}
}
