/**
 * Session-related type definitions for CLI session persistence
 */

export interface Session {
	id: string
	name: string
	description?: string
	metadata: SessionMetadata
	state: SessionState
	history: ConversationHistory
	tools: ToolState[]
	files: FileSystemState
	config: SessionConfig
}

export interface SessionMetadata {
	createdAt: Date
	updatedAt: Date
	lastAccessedAt: Date
	version: string
	tags: string[]
	duration: number // in milliseconds
	commandCount: number
	status: SessionStatus
}

export enum SessionStatus {
	ACTIVE = "active",
	COMPLETED = "completed",
	ABORTED = "aborted",
	ARCHIVED = "archived",
}

export interface SessionState {
	workingDirectory: string
	environment: Record<string, string>
	activeProcesses: ProcessInfo[]
	openFiles: string[]
	watchedFiles: string[]
	mcpConnections: MCPConnectionInfo[]
}

export interface ProcessInfo {
	pid: number
	command: string
	args: string[]
	cwd: string
	startTime: Date
	status: "running" | "stopped" | "killed"
}

export interface MCPConnectionInfo {
	serverId: string
	serverUrl: string
	connected: boolean
	lastConnected?: Date
}

export interface ConversationHistory {
	messages: ConversationMessage[]
	context: ContextInfo
	checkpoints: Checkpoint[]
}

export interface ConversationMessage {
	id: string
	timestamp: Date
	role: "user" | "assistant" | "system"
	content: string
	metadata?: {
		model?: string
		tokens?: number
		duration?: number
		[key: string]: any
	}
}

export interface ContextInfo {
	workspaceRoot: string
	activeFiles: string[]
	gitBranch?: string
	gitCommit?: string
	environmentVariables: Record<string, string>
}

export interface Checkpoint {
	id: string
	timestamp: Date
	description: string
	messageIndex: number
	state: Partial<SessionState>
}

export interface ToolState {
	toolName: string
	configuration: any
	cache: any
	lastUsed: Date
	usageCount: number
	results: ToolResult[]
}

export interface ToolResult {
	timestamp: Date
	input: any
	output: any
	success: boolean
	error?: string
}

export interface FileSystemState {
	watchedDirectories: string[]
	ignoredPatterns: string[]
	lastScanTime: Date
	fileChecksums: Record<string, string>
}

export interface SessionConfig {
	autoSave: boolean
	autoSaveInterval: number // minutes
	maxHistoryLength: number
	compressionEnabled: boolean
	encryptionEnabled: boolean
	retentionDays: number
	maxSessionSize: number // MB
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
	autoSave: true,
	autoSaveInterval: 5,
	maxHistoryLength: 1000,
	compressionEnabled: true,
	encryptionEnabled: false,
	retentionDays: 30,
	maxSessionSize: 100,
}

// Session file format
export interface SessionFile {
	version: string
	session: Session
	checksum: string
	compressed: boolean
}

// Session information for listing
export interface SessionInfo {
	id: string
	name: string
	description?: string
	createdAt: Date
	updatedAt: Date
	lastAccessedAt: Date
	tags: string[]
	status: SessionStatus
	size: number // bytes
	messageCount: number
	duration: number
}

// Session filter options
export interface SessionFilter {
	status?: SessionStatus
	tags?: string[]
	createdAfter?: Date
	createdBefore?: Date
	namePattern?: string
	limit?: number
	offset?: number
}

// Export and import formats
export enum ExportFormat {
	JSON = "json",
	YAML = "yaml",
	MARKDOWN = "markdown",
	ARCHIVE = "archive",
}

// Retention policy configuration
export interface RetentionPolicy {
	maxAge: number // days
	maxCount: number
	keepArchived: boolean
	keepTagged: string[] // tags to always keep
}

// Storage information
export interface StorageInfo {
	totalSessions: number
	totalSize: number // bytes
	oldestSession?: Date
	newestSession?: Date
	availableSpace?: number // bytes
}

// Session manager interface
export interface ISessionManager {
	// Session lifecycle
	createSession(name?: string, description?: string): Promise<Session>
	saveSession(sessionId: string): Promise<void>
	loadSession(sessionId: string): Promise<Session>
	deleteSession(sessionId: string): Promise<void>

	// Session discovery
	listSessions(filter?: SessionFilter): Promise<SessionInfo[]>
	findSessions(query: string): Promise<SessionInfo[]>
	getActiveSession(): Session | null

	// Session operations
	exportSession(sessionId: string, format: ExportFormat): Promise<string>
	importSession(filePath: string): Promise<Session>
	archiveSession(sessionId: string): Promise<void>

	// Cleanup operations
	cleanupOldSessions(retentionPolicy: RetentionPolicy): Promise<number>
	getStorageUsage(): Promise<StorageInfo>
}

// Session events
export interface SessionEvents {
	sessionCreated: (session: Session) => void
	sessionSaved: (sessionId: string) => void
	sessionLoaded: (session: Session) => void
	sessionDeleted: (sessionId: string) => void
	sessionArchived: (sessionId: string) => void
	autoSaveTriggered: (sessionId: string) => void
	cleanupCompleted: (deletedCount: number) => void
}

export const SESSION_FORMAT_VERSION = "1.0.0"
