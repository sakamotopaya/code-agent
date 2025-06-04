/**
 * Recovery mechanism types for CLI error handling
 */

import { ErrorContext, RecoveryResult } from "./error-types"

export type { RecoveryResult }

export interface RecoveryStrategy {
	canRecover(error: Error, context: ErrorContext): boolean
	recover(error: Error, context: ErrorContext): Promise<RecoveryResult>
	rollback(error: Error, context: ErrorContext): Promise<void>
}

export interface RecoveryOptions {
	maxAttempts?: number
	backoffMultiplier?: number
	timeout?: number
	enableRollback?: boolean
	strategies?: RecoveryStrategy[]
}

export interface OperationState {
	id: string
	operation: string
	timestamp: Date
	context: ErrorContext
	checkpoint?: any
	rollbackActions?: RollbackAction[]
}

export interface RollbackAction {
	id: string
	description: string
	execute: () => Promise<void>
	priority: number
}

export interface CleanupResource {
	id: string
	type: "file" | "process" | "connection" | "memory" | "other"
	cleanup: () => Promise<void>
	critical: boolean
}

export interface IRecoveryManager {
	addStrategy(strategy: RecoveryStrategy): void
	removeStrategy(strategy: RecoveryStrategy): void
	attemptRecovery(error: Error, context: ErrorContext, options?: RecoveryOptions): Promise<RecoveryResult>
	rollbackOperation(operationId: string): Promise<void>
	saveOperationState(state: OperationState): Promise<void>
	getOperationState(operationId: string): Promise<OperationState | null>
	cleanupResources(context: ErrorContext): Promise<void>
	registerCleanupResource(resource: CleanupResource): void
}
