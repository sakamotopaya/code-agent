/**
 * Recovery manager for coordinating error recovery strategies
 */

import { ErrorContext, RecoveryResult } from "../types/error-types"
import {
	RecoveryStrategy,
	RecoveryOptions,
	OperationState,
	CleanupResource,
	IRecoveryManager,
} from "../types/recovery-types"
import { NetworkRecoveryStrategy, FileSystemRecoveryStrategy } from "../recovery"

export class RecoveryManager implements IRecoveryManager {
	private strategies: RecoveryStrategy[] = []
	private operationStates: Map<string, OperationState> = new Map()
	private trackedResources: Map<string, CleanupResource[]> = new Map()

	constructor() {
		// Register default recovery strategies
		this.addStrategy(new NetworkRecoveryStrategy())
		this.addStrategy(new FileSystemRecoveryStrategy())
	}

	addStrategy(strategy: RecoveryStrategy): void {
		this.strategies.push(strategy)
	}

	removeStrategy(strategy: RecoveryStrategy): void {
		const index = this.strategies.indexOf(strategy)
		if (index !== -1) {
			this.strategies.splice(index, 1)
		}
	}

	async attemptRecovery(error: Error, context: ErrorContext, options: RecoveryOptions = {}): Promise<RecoveryResult> {
		const {
			maxAttempts = 3,
			enableRollback = true,
			strategies = this.strategies,
			timeout,
			backoffMultiplier,
		} = options

		const recoveryPromise = this.executeRecoveryStrategies(
			error,
			context,
			strategies,
			maxAttempts,
			enableRollback,
			backoffMultiplier,
		)

		// Set up overall timeout if specified
		if (timeout) {
			const timeoutPromise = new Promise<RecoveryResult>((_, reject) => {
				setTimeout(() => {
					reject(new Error(`Recovery timeout after ${timeout}ms`))
				}, timeout)
			})

			try {
				return await Promise.race([recoveryPromise, timeoutPromise])
			} catch (timeoutError) {
				return {
					success: false,
					finalError: timeoutError instanceof Error ? timeoutError : new Error(String(timeoutError)),
					suggestions: [
						"Recovery operation timed out",
						"Consider increasing timeout value",
						"Check for hanging operations",
					],
				}
			}
		} else {
			return await recoveryPromise
		}
	}

	private async executeRecoveryStrategies(
		error: Error,
		context: ErrorContext,
		strategies: RecoveryStrategy[],
		maxAttempts: number,
		enableRollback: boolean,
		backoffMultiplier?: number,
	): Promise<RecoveryResult> {
		// Find applicable recovery strategies
		const applicableStrategies = strategies.filter((strategy) => strategy.canRecover(error, context))

		if (applicableStrategies.length === 0) {
			return {
				success: false,
				suggestions: ["No recovery strategies available for this error type"],
			}
		}

		// Try each strategy in order
		for (const strategy of applicableStrategies) {
			try {
				// Pass backoff configuration to strategies that support it
				const result = await this.executeStrategyWithOptions(
					strategy,
					error,
					context,
					maxAttempts,
					backoffMultiplier,
				)

				if (result.success) {
					return result
				}

				// If recovery failed and rollback is enabled, attempt rollback
				if (enableRollback && result.rollbackRequired) {
					try {
						await strategy.rollback(error, context)
					} catch (rollbackError) {
						console.warn("Rollback failed:", rollbackError)
					}
				}
			} catch (recoveryError) {
				console.warn(`Recovery strategy failed: ${strategy.constructor.name}`, recoveryError)

				// If this was the last strategy, attempt rollback
				if (enableRollback && strategy === applicableStrategies[applicableStrategies.length - 1]) {
					try {
						await strategy.rollback(error, context)
					} catch (rollbackError) {
						console.warn("Final rollback failed:", rollbackError)
					}
				}
			}
		}

		return {
			success: false,
			suggestions: [
				"All recovery strategies failed",
				"Manual intervention may be required",
				"Check error logs for details",
			],
		}
	}

	private async executeStrategyWithOptions(
		strategy: RecoveryStrategy,
		error: Error,
		context: ErrorContext,
		maxAttempts: number,
		backoffMultiplier?: number,
	): Promise<RecoveryResult> {
		// Check if strategy supports configurable options and if custom options are provided
		if (
			strategy.constructor.name === "NetworkRecoveryStrategy" &&
			(maxAttempts !== 3 || backoffMultiplier !== undefined)
		) {
			// Only create configured strategy if error can be handled by NetworkRecoveryStrategy
			if (strategy.canRecover(error, context)) {
				const configurableStrategy = new NetworkRecoveryStrategy(maxAttempts, undefined, backoffMultiplier)
				// NetworkRecoveryStrategy.canRecover already verified this is a compatible error
				return await configurableStrategy.recover(error as any, context)
			}
		}

		// Use strategy as-is for other strategies or default configuration
		return await strategy.recover(error, context)
	}

	async rollbackOperation(operationId: string): Promise<void> {
		const operationState = this.operationStates.get(operationId)
		if (!operationState) {
			throw new Error(`Operation state not found for ID: ${operationId}`)
		}

		const rollbackActions = operationState.rollbackActions || []

		// Execute rollback actions in reverse order (LIFO)
		const sortedActions = rollbackActions.sort((a, b) => b.priority - a.priority)

		for (const action of sortedActions) {
			try {
				await action.execute()
				console.debug(`Rollback action completed: ${action.description}`)
			} catch (rollbackError) {
				console.error(`Rollback action failed: ${action.description}`, rollbackError)
				// Continue with other rollback actions even if one fails
			}
		}

		// Clean up resources for this operation
		await this.cleanupResources({ operationId } as ErrorContext)

		// Remove operation state
		this.operationStates.delete(operationId)
	}

	async saveOperationState(state: OperationState): Promise<void> {
		this.operationStates.set(state.id, state)

		// Optional: Persist to disk for crash recovery
		try {
			const stateData = JSON.stringify({
				...state,
				rollbackActions: state.rollbackActions?.map((action) => ({
					id: action.id,
					description: action.description,
					priority: action.priority,
					// Note: Cannot serialize function, would need to reconstruct
				})),
			})

			// In a real implementation, save to a recovery file
			console.debug(`Operation state saved: ${state.id}`)
		} catch (error) {
			console.warn("Failed to persist operation state:", error)
		}
	}

	async getOperationState(operationId: string): Promise<OperationState | null> {
		return this.operationStates.get(operationId) || null
	}

	async cleanupResources(context: ErrorContext): Promise<void> {
		const resources = this.trackedResources.get(context.operationId) || []

		// Sort by criticality - cleanup critical resources first
		const sortedResources = resources.sort((a, b) => {
			if (a.critical && !b.critical) return -1
			if (!a.critical && b.critical) return 1
			return 0
		})

		const cleanupPromises = sortedResources.map(async (resource) => {
			try {
				await resource.cleanup()
				console.debug(`Resource cleaned up: ${resource.id} (${resource.type})`)
			} catch (cleanupError) {
				console.error(`Failed to cleanup resource: ${resource.id}`, cleanupError)
			}
		})

		// Wait for all cleanup operations to complete
		await Promise.allSettled(cleanupPromises)

		// Remove resources from tracking
		this.trackedResources.delete(context.operationId)
	}

	registerCleanupResource(resource: CleanupResource): void {
		// For now, register resources globally
		// In practice, would associate with specific operation IDs
		const globalKey = "global"
		const resources = this.trackedResources.get(globalKey) || []
		resources.push(resource)
		this.trackedResources.set(globalKey, resources)
	}

	/**
	 * Register cleanup resource for specific operation
	 */
	registerOperationCleanupResource(operationId: string, resource: CleanupResource): void {
		const resources = this.trackedResources.get(operationId) || []
		resources.push(resource)
		this.trackedResources.set(operationId, resources)
	}

	/**
	 * Get recovery statistics
	 */
	getRecoveryStatistics(): {
		totalOperations: number
		activeOperations: number
		trackedResources: number
	} {
		let totalResources = 0
		for (const resources of this.trackedResources.values()) {
			totalResources += resources.length
		}

		return {
			totalOperations: this.operationStates.size,
			activeOperations: this.operationStates.size,
			trackedResources: totalResources,
		}
	}

	/**
	 * Perform emergency cleanup - cleanup all tracked resources
	 */
	async emergencyCleanup(): Promise<void> {
		console.warn("Performing emergency cleanup of all tracked resources")

		const cleanupPromises: Promise<void>[] = []

		for (const [operationId, resources] of this.trackedResources.entries()) {
			const operationCleanup = resources.map(async (resource) => {
				try {
					await resource.cleanup()
					console.debug(`Emergency cleanup completed: ${resource.id}`)
				} catch (error) {
					console.error(`Emergency cleanup failed: ${resource.id}`, error)
				}
			})

			cleanupPromises.push(...operationCleanup)
		}

		await Promise.allSettled(cleanupPromises)

		// Clear all tracking
		this.trackedResources.clear()
		this.operationStates.clear()
	}
}
