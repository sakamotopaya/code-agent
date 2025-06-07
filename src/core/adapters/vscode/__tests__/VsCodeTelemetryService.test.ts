import * as vscode from "vscode"
import { TelemetryEventName } from "@roo-code/types"
import { VsCodeTelemetryService } from "../VsCodeTelemetryService"

// Mock vscode
jest.mock("vscode", () => ({
	env: {
		isTelemetryEnabled: true,
		machineId: "test-machine-id",
	},
}))

describe("VsCodeTelemetryService", () => {
	let service: VsCodeTelemetryService
	let mockContext: vscode.ExtensionContext
	let mockClient: any

	beforeEach(() => {
		mockContext = {} as vscode.ExtensionContext
		service = new VsCodeTelemetryService(mockContext)

		mockClient = {
			capture: jest.fn().mockResolvedValue(undefined),
			setProvider: jest.fn(),
			updateTelemetryState: jest.fn(),
			isTelemetryEnabled: jest.fn().mockReturnValue(true),
			shutdown: jest.fn().mockResolvedValue(undefined),
		}
	})

	describe("captureEvent", () => {
		it("should call capture method on registered clients with correct format", async () => {
			// Register a mock client
			service.register(mockClient)

			// Capture an event
			service.captureEvent(TelemetryEventName.TASK_CREATED, { taskId: "test-task" })

			// Verify the client.capture was called with correct TelemetryEvent format
			expect(mockClient.capture).toHaveBeenCalledWith({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-task" },
			})
		})

		it("should handle clients without properties", async () => {
			service.register(mockClient)

			service.captureEvent(TelemetryEventName.TASK_COMPLETED)

			expect(mockClient.capture).toHaveBeenCalledWith({
				event: TelemetryEventName.TASK_COMPLETED,
				properties: undefined,
			})
		})

		it("should handle multiple clients", async () => {
			const mockClient2 = {
				capture: jest.fn().mockResolvedValue(undefined),
				setProvider: jest.fn(),
				updateTelemetryState: jest.fn(),
				isTelemetryEnabled: jest.fn().mockReturnValue(true),
				shutdown: jest.fn().mockResolvedValue(undefined),
			}

			service.register(mockClient)
			service.register(mockClient2)

			service.captureEvent(TelemetryEventName.TOOL_USED, { tool: "test-tool" })

			expect(mockClient.capture).toHaveBeenCalledWith({
				event: TelemetryEventName.TOOL_USED,
				properties: { tool: "test-tool" },
			})
			expect(mockClient2.capture).toHaveBeenCalledWith({
				event: TelemetryEventName.TOOL_USED,
				properties: { tool: "test-tool" },
			})
		})

		it("should handle client capture errors gracefully", async () => {
			const consoleSpy = jest.spyOn(console, "warn").mockImplementation()
			mockClient.capture.mockRejectedValue(new Error("Capture failed"))

			service.register(mockClient)
			service.captureEvent(TelemetryEventName.TASK_CREATED, { taskId: "test" })

			// Wait for async catch block
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(consoleSpy).toHaveBeenCalledWith("Failed to send telemetry event:", expect.any(Error))
			consoleSpy.mockRestore()
		})

		it("should not capture events when telemetry is disabled", () => {
			service.updateTelemetryState(false)
			service.register(mockClient)

			service.captureEvent(TelemetryEventName.TASK_CREATED, { taskId: "test" })

			expect(mockClient.capture).not.toHaveBeenCalled()
		})
	})

	describe("isTelemetryEnabled", () => {
		it("should return true when both service and vscode telemetry are enabled", () => {
			expect(service.isTelemetryEnabled()).toBe(true)
		})
	})
})
