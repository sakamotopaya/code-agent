/**
 * Tests for RecoveryManager
 */

import { RecoveryManager } from "../RecoveryManager"
import { NetworkRecoveryStrategy, FileSystemRecoveryStrategy } from "../../recovery"
import { ErrorContext, RecoveryResult } from "../../types/error-types"
import { RecoveryStrategy, OperationState, CleanupResource } from "../../types/recovery-types"
import { NetworkError } from "../../errors/NetworkError"
import { FileSystemError } from "../../errors/FileSystemError"

describe("RecoveryManager", () => {
	let recoveryManager: RecoveryManager
	let mockContext: ErrorContext

	beforeEach(() => {
		recoveryManager = new RecoveryManager()

		mockContext = {
			operationId: "test-op-123",
			command: "test-command",
			arguments: ["--test"],
			workingDirectory: "/test/dir",
			environment: { NODE_ENV: "test" },
			timestamp: new Date(),
			stackTrace: ["line 1", "line 2"],
			systemInfo: {
				platform: "test",
				nodeVersion: "v16.0.0",
				cliVersion: "1.0.0",
				memoryUsage: process.memoryUsage(),
				uptime: 100,
			},
		}

		// Mock console methods
		jest.spyOn(console, "debug").mockImplementation()
		jest.spyOn(console, "warn").mockImplementation()
		jest.spyOn(console, "error").mockImplementation()
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with default recovery strategies", () => {
			const stats = recoveryManager.getRecoveryStatistics()
			expect(stats.totalOperations).toBe(0)
			expect(stats.activeOperations).toBe(0)
			expect(stats.trackedResources).toBe(0)
		})
	})

	describe("strategy management", () => {
		it("should add and remove strategies", () => {
			const customStrategy: RecoveryStrategy = {
				canRecover: jest.fn().mockReturnValue(true),
				recover: jest.fn().mockResolvedValue({ success: true }),
				rollback: jest.fn().mockResolvedValue(undefined),
			}

			recoveryManager.addStrategy(customStrategy)
			recoveryManager.removeStrategy(customStrategy)

			// Should not throw errors
			expect(true).toBe(true)
		})
	})

	describe("attemptRecovery", () => {
		it("should attempt recovery with applicable strategies", async () => {
			const networkError = new NetworkError("Connection failed", "NET_ERROR", 500)
			const result = await recoveryManager.attemptRecovery(networkError, mockContext)

			expect(result).toBeDefined()
			expect(typeof result.success).toBe("boolean")
		})

		it("should handle file system errors", async () => {
			const fsError = new FileSystemError("File not found", "FS_ERROR", "/test/file.txt", "read")
			const result = await recoveryManager.attemptRecovery(fsError, mockContext)

			expect(result).toBeDefined()
			expect(typeof result.success).toBe("boolean")
		})

		it("should return failure when no strategies are applicable", async () => {
			const unsupportedError = new Error("Unsupported error type")
			const result = await recoveryManager.attemptRecovery(unsupportedError, mockContext)

			expect(result.success).toBe(false)
			expect(result.suggestions).toContain("No recovery strategies available for this error type")
		})

		it("should handle strategy execution failures", async () => {
			const failingStrategy: RecoveryStrategy = {
				canRecover: jest.fn().mockReturnValue(true),
				recover: jest.fn().mockRejectedValue(new Error("Strategy failed")),
				rollback: jest.fn().mockResolvedValue(undefined),
			}

			recoveryManager.addStrategy(failingStrategy)

			const error = new Error("Test error")
			const result = await recoveryManager.attemptRecovery(error, mockContext)

			expect(result.success).toBe(false)
			expect(result.suggestions).toContain("All recovery strategies failed")
		})

		it("should attempt rollback when recovery fails and rollback is enabled", async () => {
			const strategyWithRollback: RecoveryStrategy = {
				canRecover: jest.fn().mockReturnValue(true),
				recover: jest.fn().mockResolvedValue({ success: false, rollbackRequired: true }),
				rollback: jest.fn().mockResolvedValue(undefined),
			}

			recoveryManager.addStrategy(strategyWithRollback)

			const error = new Error("Test error")
			await recoveryManager.attemptRecovery(error, mockContext, { enableRollback: true })

			expect(strategyWithRollback.rollback).toHaveBeenCalledWith(error, mockContext)
		})

		it("should skip rollback when disabled", async () => {
			const strategyWithRollback: RecoveryStrategy = {
				canRecover: jest.fn().mockReturnValue(true),
				recover: jest.fn().mockResolvedValue({ success: false, rollbackRequired: true }),
				rollback: jest.fn().mockResolvedValue(undefined),
			}

			recoveryManager.addStrategy(strategyWithRollback)

			const error = new Error("Test error")
			await recoveryManager.attemptRecovery(error, mockContext, { enableRollback: false })

			expect(strategyWithRollback.rollback).not.toHaveBeenCalled()
		})

		it("should respect timeout option and fail recovery if timeout is exceeded", async () => {
			const slowStrategy: RecoveryStrategy = {
				canRecover: jest.fn().mockReturnValue(true),
				recover: jest.fn().mockImplementation(async () => {
					// Simulate a slow recovery operation
					await new Promise((resolve) => setTimeout(resolve, 200))
					return { success: true }
				}),
				rollback: jest.fn().mockResolvedValue(undefined),
			}

			// Clear existing strategies and add only our slow strategy
			recoveryManager = new RecoveryManager()
			recoveryManager.addStrategy(slowStrategy)

			const error = new Error("Test error")
			const result = await recoveryManager.attemptRecovery(error, mockContext, {
				timeout: 100, // Very short timeout
			})

			expect(result.success).toBe(false)
			expect(result.finalError?.message).toContain("Recovery timeout after 100ms")
			expect(result.suggestions).toContain("Recovery operation timed out")
		})

		it("should complete recovery if within timeout", async () => {
			const fastStrategy: RecoveryStrategy = {
				canRecover: jest.fn().mockReturnValue(true),
				recover: jest.fn().mockResolvedValue({ success: true }),
				rollback: jest.fn().mockResolvedValue(undefined),
			}

			// Clear existing strategies and add only our fast strategy
			recoveryManager = new RecoveryManager()
			recoveryManager.addStrategy(fastStrategy)

			const error = new Error("Test error")
			const result = await recoveryManager.attemptRecovery(error, mockContext, {
				timeout: 1000, // Generous timeout
			})

			expect(result.success).toBe(true)
			expect(fastStrategy.recover).toHaveBeenCalledWith(error, mockContext)
		})

		it("should handle custom maxAttempts and backoffMultiplier options", async () => {
			const networkError = new NetworkError("Connection failed", "NET_ERROR", 500)

			const result = await recoveryManager.attemptRecovery(networkError, mockContext, {
				backoffMultiplier: 1.5,
				maxAttempts: 2,
			})

			// The test should complete without errors - the implementation creates a new strategy internally
			expect(result).toBeDefined()
			expect(typeof result.success).toBe("boolean")
		})

		it("should use default options when none provided", async () => {
			const mockStrategy: RecoveryStrategy = {
				canRecover: jest.fn().mockReturnValue(true),
				recover: jest.fn().mockResolvedValue({ success: true }),
				rollback: jest.fn().mockResolvedValue(undefined),
			}

			// Clear existing strategies and add only our mock strategy
			recoveryManager = new RecoveryManager()
			recoveryManager.addStrategy(mockStrategy)

			const error = new Error("Test error")
			const result = await recoveryManager.attemptRecovery(error, mockContext)

			expect(result.success).toBe(true)
			expect(mockStrategy.recover).toHaveBeenCalledWith(error, mockContext)
		})

		it("should handle timeout option properly", async () => {
			const networkError = new NetworkError("Connection failed", "NET_ERROR", 500)

			const result = await recoveryManager.attemptRecovery(networkError, mockContext, {
				timeout: 5000, // 5 second timeout
			})

			// Should complete within reasonable time
			expect(result).toBeDefined()
			expect(typeof result.success).toBe("boolean")
		})
	})

	describe("operation state management", () => {
		it("should save and retrieve operation state", async () => {
			const operationState: OperationState = {
				id: "test-op-456",
				operation: "test-operation",
				timestamp: new Date(),
				context: mockContext,
				checkpoint: { step: 1, data: "test" },
				rollbackActions: [],
			}

			await recoveryManager.saveOperationState(operationState)
			const retrieved = await recoveryManager.getOperationState("test-op-456")

			expect(retrieved).toEqual(operationState)
		})

		it("should return null for non-existent operation state", async () => {
			const retrieved = await recoveryManager.getOperationState("non-existent")
			expect(retrieved).toBeNull()
		})
	})

	describe("rollbackOperation", () => {
		it("should execute rollback actions in priority order", async () => {
			const executionOrder: number[] = []

			const operationState: OperationState = {
				id: "test-rollback-op",
				operation: "test-operation",
				timestamp: new Date(),
				context: mockContext,
				rollbackActions: [
					{
						id: "action-1",
						description: "Low priority action",
						priority: 1,
						execute: async () => {
							executionOrder.push(1)
						},
					},
					{
						id: "action-2",
						description: "High priority action",
						priority: 3,
						execute: async () => {
							executionOrder.push(3)
						},
					},
					{
						id: "action-3",
						description: "Medium priority action",
						priority: 2,
						execute: async () => {
							executionOrder.push(2)
						},
					},
				],
			}

			await recoveryManager.saveOperationState(operationState)
			await recoveryManager.rollbackOperation("test-rollback-op")

			// Should execute in reverse priority order (highest first)
			expect(executionOrder).toEqual([3, 2, 1])
		})

		it("should continue rollback even if some actions fail", async () => {
			const executionOrder: string[] = []

			const operationState: OperationState = {
				id: "test-failing-rollback",
				operation: "test-operation",
				timestamp: new Date(),
				context: mockContext,
				rollbackActions: [
					{
						id: "action-1",
						description: "Failing action",
						priority: 2,
						execute: async () => {
							executionOrder.push("action-1")
							throw new Error("Rollback action failed")
						},
					},
					{
						id: "action-2",
						description: "Succeeding action",
						priority: 1,
						execute: async () => {
							executionOrder.push("action-2")
						},
					},
				],
			}

			await recoveryManager.saveOperationState(operationState)
			await recoveryManager.rollbackOperation("test-failing-rollback")

			expect(executionOrder).toEqual(["action-1", "action-2"])
			expect(console.error).toHaveBeenCalledWith(
				expect.stringContaining("Rollback action failed: Failing action"),
				expect.any(Error),
			)
		})

		it("should throw error for non-existent operation", async () => {
			await expect(recoveryManager.rollbackOperation("non-existent")).rejects.toThrow(
				"Operation state not found for ID: non-existent",
			)
		})
	})

	describe("resource cleanup", () => {
		it("should cleanup resources for operation", async () => {
			const cleanupExecuted: string[] = []

			const resources: CleanupResource[] = [
				{
					id: "resource-1",
					type: "file",
					critical: false,
					cleanup: async () => {
						cleanupExecuted.push("resource-1")
					},
				},
				{
					id: "resource-2",
					type: "process",
					critical: true,
					cleanup: async () => {
						cleanupExecuted.push("resource-2")
					},
				},
			]

			// Register resources for the operation
			resources.forEach((resource) => {
				recoveryManager.registerOperationCleanupResource(mockContext.operationId, resource)
			})

			await recoveryManager.cleanupResources(mockContext)

			// Critical resources should be cleaned up first
			expect(cleanupExecuted).toEqual(["resource-2", "resource-1"])
		})

		it("should handle cleanup failures gracefully", async () => {
			const cleanupExecuted: string[] = []

			const resources: CleanupResource[] = [
				{
					id: "failing-resource",
					type: "file",
					critical: false,
					cleanup: async () => {
						cleanupExecuted.push("failing-resource")
						throw new Error("Cleanup failed")
					},
				},
				{
					id: "working-resource",
					type: "process",
					critical: false,
					cleanup: async () => {
						cleanupExecuted.push("working-resource")
					},
				},
			]

			resources.forEach((resource) => {
				recoveryManager.registerOperationCleanupResource(mockContext.operationId, resource)
			})

			await recoveryManager.cleanupResources(mockContext)

			expect(cleanupExecuted).toEqual(["failing-resource", "working-resource"])
			expect(console.error).toHaveBeenCalledWith(
				expect.stringContaining("Failed to cleanup resource: failing-resource"),
				expect.any(Error),
			)
		})

		it("should register global cleanup resources", () => {
			const resource: CleanupResource = {
				id: "global-resource",
				type: "memory",
				critical: true,
				cleanup: async () => {},
			}

			recoveryManager.registerCleanupResource(resource)

			const stats = recoveryManager.getRecoveryStatistics()
			expect(stats.trackedResources).toBe(1)
		})
	})

	describe("emergencyCleanup", () => {
		it("should cleanup all tracked resources", async () => {
			const cleanupExecuted: string[] = []

			// Register some resources
			const resources: CleanupResource[] = [
				{
					id: "emergency-resource-1",
					type: "file",
					critical: true,
					cleanup: async () => {
						cleanupExecuted.push("emergency-resource-1")
					},
				},
				{
					id: "emergency-resource-2",
					type: "process",
					critical: false,
					cleanup: async () => {
						cleanupExecuted.push("emergency-resource-2")
					},
				},
			]

			resources.forEach((resource) => {
				recoveryManager.registerOperationCleanupResource("emergency-op", resource)
			})

			await recoveryManager.emergencyCleanup()

			expect(cleanupExecuted).toContain("emergency-resource-1")
			expect(cleanupExecuted).toContain("emergency-resource-2")
			expect(console.warn).toHaveBeenCalledWith("Performing emergency cleanup of all tracked resources")

			// Should clear all tracking
			const stats = recoveryManager.getRecoveryStatistics()
			expect(stats.trackedResources).toBe(0)
			expect(stats.totalOperations).toBe(0)
		})

		it("should handle emergency cleanup failures", async () => {
			const resource: CleanupResource = {
				id: "failing-emergency-resource",
				type: "file",
				critical: true,
				cleanup: async () => {
					throw new Error("Emergency cleanup failed")
				},
			}

			recoveryManager.registerCleanupResource(resource)

			await recoveryManager.emergencyCleanup()

			expect(console.error).toHaveBeenCalledWith(
				expect.stringContaining("Emergency cleanup failed: failing-emergency-resource"),
				expect.any(Error),
			)
		})
	})

	describe("getRecoveryStatistics", () => {
		it("should return current statistics", async () => {
			// Add some operation state and resources
			const operationState: OperationState = {
				id: "stats-test-op",
				operation: "test",
				timestamp: new Date(),
				context: mockContext,
			}

			await recoveryManager.saveOperationState(operationState)

			const resource: CleanupResource = {
				id: "stats-resource",
				type: "file",
				critical: false,
				cleanup: async () => {},
			}

			recoveryManager.registerCleanupResource(resource)

			const stats = recoveryManager.getRecoveryStatistics()

			expect(stats.totalOperations).toBe(1)
			expect(stats.activeOperations).toBe(1)
			expect(stats.trackedResources).toBe(1)
		})
	})
})
