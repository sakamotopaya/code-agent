/**
 * Error handling types for CLI utility
 */

export enum ErrorCategory {
	SYSTEM = "system",
	USER_INPUT = "user_input",
	NETWORK = "network",
	FILE_SYSTEM = "file_system",
	AUTHENTICATION = "authentication",
	PERMISSION = "permission",
	CONFIGURATION = "configuration",
	EXTERNAL_SERVICE = "external_service",
	INTERNAL = "internal",
}

export enum ErrorSeverity {
	CRITICAL = "critical",
	HIGH = "high",
	MEDIUM = "medium",
	LOW = "low",
	INFO = "info",
}

export enum LogLevel {
	ERROR = "error",
	WARN = "warn",
	INFO = "info",
	DEBUG = "debug",
	VERBOSE = "verbose",
}

export enum ErrorFormat {
	PLAIN = "plain",
	JSON = "json",
	STRUCTURED = "structured",
	USER_FRIENDLY = "user_friendly",
}

export interface ErrorContext {
	operationId: string
	userId?: string
	sessionId?: string
	command: string
	arguments: string[]
	workingDirectory: string
	environment: Record<string, string>
	timestamp: Date
	stackTrace: string[]
	systemInfo: SystemInfo
}

export interface SystemInfo {
	platform: string
	nodeVersion: string
	cliVersion: string
	memoryUsage: NodeJS.MemoryUsage
	uptime: number
}

export interface ClassifiedError {
	originalError: Error
	category: ErrorCategory
	severity: ErrorSeverity
	isRecoverable: boolean
	suggestedActions: string[]
	relatedDocumentation: string[]
}

export interface ErrorResult {
	success: boolean
	recovered: boolean
	errorReport?: ErrorReport
	suggestions?: string[]
	nextActions?: string[]
}

export interface PerformanceMetrics {
	executionTime: number
	memoryUsage: NodeJS.MemoryUsage
	cpuUsage?: NodeJS.CpuUsage
}

export interface NetworkLog {
	timestamp: Date
	method: string
	url: string
	statusCode?: number
	error?: string
	duration: number
}

export interface FileSystemOperation {
	timestamp: Date
	operation: string
	path: string
	success: boolean
	error?: string
}

export interface MemorySnapshot {
	timestamp: Date
	heapUsed: number
	heapTotal: number
	external: number
	arrayBuffers: number
}

export interface RecoveryResult {
	success: boolean
	attempt?: number
	finalError?: Error
	suggestions?: string[]
	rollbackRequired?: boolean
}

export interface DebugInfo {
	context: ErrorContext
	performanceMetrics: PerformanceMetrics
	networkLogs: NetworkLog[]
	fileSystemOperations: FileSystemOperation[]
	memorySnapshot: MemorySnapshot
}

export interface ErrorReport {
	id: string
	timestamp: Date
	error: ClassifiedError
	context: ErrorContext
	debugInfo?: DebugInfo
	userFeedback?: string
	resolution?: string
}

export interface AnonymizedErrorReport {
	id: string
	timestamp: Date
	error: Omit<ClassifiedError, "originalError"> & {
		originalError: {
			name: string
			message: string
			stack?: string
		}
	}
	context: Omit<ErrorContext, "userId" | "workingDirectory" | "arguments"> & {
		workingDirectory: string // hashed
		arguments: string[] // sanitized
	}
	debugInfo?: DebugInfo
}

export interface ErrorStatistics {
	totalErrors: number
	errorsByCategory: Record<ErrorCategory, number>
	errorsBySeverity: Record<ErrorSeverity, number>
	recentErrors: ErrorReport[]
	commonPatterns: string[]
	recoverySuccessRate: number
}

export interface ErrorHandlingOptions {
	debug?: boolean
	verbose?: boolean
	logLevel?: LogLevel
	errorReport?: boolean
	noRecovery?: boolean
	stackTrace?: boolean
}

export interface IErrorHandlingService {
	// Error processing
	handleError(error: Error, context: ErrorContext): Promise<ErrorResult>
	categorizeError(error: Error): ErrorCategory
	formatError(error: Error, format: ErrorFormat): string

	// Recovery mechanisms
	attemptRecovery(error: Error, context: ErrorContext): Promise<RecoveryResult>
	rollbackOperation(operationId: string): Promise<void>
	cleanupResources(context: ErrorContext): Promise<void>

	// Logging and reporting
	logError(error: Error, context: ErrorContext): Promise<void>
	reportError(error: Error, userConsent: boolean): Promise<void>
	getErrorStatistics(): Promise<ErrorStatistics>

	// Debug support
	enableDebugMode(enabled: boolean): void
	captureDebugInfo(error: Error): DebugInfo
	generateErrorReport(error: Error, context?: ErrorContext): Promise<ErrorReport>
}
