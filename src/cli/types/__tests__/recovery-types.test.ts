/**
 * Tests for recovery-types to demonstrate proper usage of unknown checkpoint type
 */

import { OperationState } from "../recovery-types"
import { ErrorContext } from "../error-types"

describe("OperationState", () => {
	describe("checkpoint property", () => {
		it("should accept any value for checkpoint property", () => {
			const mockContext: ErrorContext = {
				operationId: "test-op",
				command: "test-command",
				arguments: ["--test"],
				workingDirectory: "/test",
				environment: {},
				timestamp: new Date(),
				stackTrace: [],
				systemInfo: {
					platform: "test",
					nodeVersion: "v16.0.0",
					cliVersion: "1.0.0",
					memoryUsage: process.memoryUsage(),
					uptime: 100,
				},
			}

			// These should all compile successfully since unknown accepts any value
			const operationWithObjectCheckpoint: OperationState = {
				id: "test-1",
				operation: "test-operation",
				timestamp: new Date(),
				context: mockContext,
				checkpoint: { step: 1, data: "test" }, // object
			}

			const operationWithStringCheckpoint: OperationState = {
				id: "test-2",
				operation: "test-operation",
				timestamp: new Date(),
				context: mockContext,
				checkpoint: "some-checkpoint-id", // string
			}

			const operationWithNumberCheckpoint: OperationState = {
				id: "test-3",
				operation: "test-operation",
				timestamp: new Date(),
				context: mockContext,
				checkpoint: 12345, // number
			}

			const operationWithNullCheckpoint: OperationState = {
				id: "test-4",
				operation: "test-operation",
				timestamp: new Date(),
				context: mockContext,
				checkpoint: null, // null
			}

			// All should be valid
			expect(operationWithObjectCheckpoint.checkpoint).toBeDefined()
			expect(operationWithStringCheckpoint.checkpoint).toBeDefined()
			expect(operationWithNumberCheckpoint.checkpoint).toBeDefined()
			expect(operationWithNullCheckpoint.checkpoint).toBeNull()
		})

		it("should demonstrate proper runtime type checking for unknown checkpoint", () => {
			const mockContext: ErrorContext = {
				operationId: "test-op",
				command: "test-command",
				arguments: ["--test"],
				workingDirectory: "/test",
				environment: {},
				timestamp: new Date(),
				stackTrace: [],
				systemInfo: {
					platform: "test",
					nodeVersion: "v16.0.0",
					cliVersion: "1.0.0",
					memoryUsage: process.memoryUsage(),
					uptime: 100,
				},
			}

			const operation: OperationState = {
				id: "test-runtime-check",
				operation: "test-operation",
				timestamp: new Date(),
				context: mockContext,
				checkpoint: { step: 5, data: "example" },
			}

			// Proper runtime type checking before using the checkpoint
			function processCheckpoint(checkpoint: unknown): string {
				// Type guard to check if it's an object with expected properties
				if (
					checkpoint !== null &&
					typeof checkpoint === "object" &&
					"step" in checkpoint &&
					"data" in checkpoint
				) {
					const typedCheckpoint = checkpoint as { step: number; data: string }
					return `Step ${typedCheckpoint.step}: ${typedCheckpoint.data}`
				}

				// Handle string checkpoints
				if (typeof checkpoint === "string") {
					return `Checkpoint ID: ${checkpoint}`
				}

				// Handle number checkpoints
				if (typeof checkpoint === "number") {
					return `Checkpoint Index: ${checkpoint}`
				}

				// Default case
				return "Unknown checkpoint format"
			}

			const result = processCheckpoint(operation.checkpoint)
			expect(result).toBe("Step 5: example")

			// Test with different checkpoint types
			const stringOperation = { ...operation, checkpoint: "abc123" }
			expect(processCheckpoint(stringOperation.checkpoint)).toBe("Checkpoint ID: abc123")

			const numberOperation = { ...operation, checkpoint: 42 }
			expect(processCheckpoint(numberOperation.checkpoint)).toBe("Checkpoint Index: 42")

			const invalidOperation = { ...operation, checkpoint: true }
			expect(processCheckpoint(invalidOperation.checkpoint)).toBe("Unknown checkpoint format")
		})

		it("should prevent direct property access without type checking", () => {
			const mockContext: ErrorContext = {
				operationId: "test-op",
				command: "test-command",
				arguments: ["--test"],
				workingDirectory: "/test",
				environment: {},
				timestamp: new Date(),
				stackTrace: [],
				systemInfo: {
					platform: "test",
					nodeVersion: "v16.0.0",
					cliVersion: "1.0.0",
					memoryUsage: process.memoryUsage(),
					uptime: 100,
				},
			}

			const operation: OperationState = {
				id: "test-access",
				operation: "test-operation",
				timestamp: new Date(),
				context: mockContext,
				checkpoint: { step: 1, data: "test" },
			}

			// This would cause a TypeScript error (commented out to prevent compilation error):
			// const step = operation.checkpoint.step; // Error: Object is of type 'unknown'

			// Instead, we must use proper type checking:
			if (
				operation.checkpoint !== null &&
				typeof operation.checkpoint === "object" &&
				"step" in operation.checkpoint
			) {
				const typedCheckpoint = operation.checkpoint as { step: number }
				const step = typedCheckpoint.step // This is safe
				expect(step).toBe(1)
			}
		})
	})
})
