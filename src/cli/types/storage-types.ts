/**
 * Storage-related type definitions for session persistence
 */

import * as os from "os"
import * as path from "path"
import { getGlobalStoragePath } from "../../shared/paths"

// Storage backend interface
export interface ISessionStorage {
	saveSession(session: Session): Promise<void>
	loadSession(sessionId: string): Promise<Session>
	deleteSession(sessionId: string): Promise<void>
	listSessions(): Promise<SessionInfo[]>
	exists(sessionId: string): Promise<boolean>
	getSessionSize(sessionId: string): Promise<number>
	compress(data: string): Promise<Buffer>
	decompress(data: Buffer): Promise<string>
	calculateChecksum(data: any): string
	validateChecksum(sessionFile: SessionFile): boolean
}

// Session serialization interface
export interface ISessionSerializer {
	serialize(session: Session): Promise<string>
	deserialize(data: string): Promise<Session>
	sanitizeSession(session: Session): Session
	validateSession(session: Session): ValidationResult
}

// Validation result
export interface ValidationResult {
	valid: boolean
	errors: string[]
	warnings: string[]
}

// Storage configuration
export interface StorageConfig {
	sessionDirectory: string
	compressionLevel: number
	encryptionKey?: string
	backupEnabled: boolean
	backupInterval: number // hours
	maxBackups: number
	filePermissions: number
	lockTimeout: number // milliseconds
}

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
	sessionDirectory: getGlobalStoragePath(),
	compressionLevel: 6,
	backupEnabled: true,
	backupInterval: 24,
	maxBackups: 7,
	filePermissions: 0o600,
	lockTimeout: 5000,
}

// File lock interface
export interface IFileLock {
	acquire(filePath: string, timeout?: number): Promise<void>
	release(filePath: string): Promise<void>
	isLocked(filePath: string): boolean
}

// Import types from session-types
import type { Session, SessionInfo, SessionFile } from "./session-types"
