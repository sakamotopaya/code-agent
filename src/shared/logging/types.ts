/**
 * Types for API chunk logging functionality
 */

export interface ApiChunkLogContext {
	taskId?: string
	requestId?: string
	host: string
	port: number
	endpoint: string
	timestamp: string
	requestMetadata?: any
}

export interface ApiChunkLoggerOptions {
	enabled?: boolean
	logDir?: string
	context?: string
}

export interface ChunkLogEntry {
	chunk: string
	timestamp: string
	sequenceNumber: number
}
