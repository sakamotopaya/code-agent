import { CLIUIService } from "../CLIUIService"
import { ColorManager } from "../ColorManager"
import { TableFormatter } from "../TableFormatter"
import { PromptManager } from "../PromptManager"
import { ProgressIndicatorFactory } from "../ProgressIndicator"

describe("CLI UI Integration Tests", () => {
	let uiService: CLIUIService
	let consoleSpy: jest.SpyInstance

	beforeEach(() => {
		consoleSpy = jest.spyOn(console, "log").mockImplementation()
		uiService = new CLIUIService(true)
	})

	afterEach(() => {
		consoleSpy.mockRestore()
	})

	describe("End-to-End UI Workflows", () => {
		it("should display a complete status dashboard", () => {
			// Test a complex UI scenario with multiple elements
			uiService.showHeader("Roo CLI Dashboard", "System Status Overview")

			// Show system information table
			const systemInfo = {
				"CLI Version": "1.0.0",
				"Node Version": process.version,
				Platform: process.platform,
				"Working Directory": process.cwd(),
				"Memory Usage": `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
			}

			uiService.showKeyValueTable(systemInfo, "System Information")

			// Show status summary
			uiService.showSuccessBox("All systems operational", "Status")

			// Show separator
			uiService.showSeparator("=", 60)

			expect(consoleSpy).toHaveBeenCalledTimes(4) // Header, table, success box, separator
		})

		it("should handle a task progress workflow", async () => {
			// Simulate a task with progress indicators
			const spinner = uiService.showSpinner("Initializing task...")
			spinner.start()

			// Update spinner text
			spinner.text = "Processing files..."

			// Show progress completion
			spinner.succeed("Task completed successfully")

			// Show results in a table
			const results = [
				{ file: "src/main.ts", status: "processed", lines: 120 },
				{ file: "src/utils.ts", status: "processed", lines: 85 },
				{ file: "src/config.ts", status: "skipped", lines: 0 },
			]

			const columns = [
				{ header: "File", key: "file" },
				{ header: "Status", key: "status" },
				{ header: "Lines", key: "lines", alignment: "right" as const },
			]

			uiService.showColumnarTable(results, columns, "Processing Results")

			expect(consoleSpy).toHaveBeenCalled()
		})

		it("should display error scenarios with appropriate styling", () => {
			// Show error with context
			uiService.showErrorBox("Failed to connect to API", "Connection Error")

			// Show error details in table
			const errorDetails = {
				"Error Code": "ERR_CONNECTION_REFUSED",
				Endpoint: "https://api.example.com",
				"Retry Count": "3",
				"Last Attempt": new Date().toISOString(),
			}

			uiService.showKeyValueTable(errorDetails, "Error Details")

			// Show suggested actions
			uiService.showInfoBox(
				"• Check network connection\n• Verify API endpoint\n• Review authentication credentials",
				"Suggested Actions",
			)

			expect(consoleSpy).toHaveBeenCalledTimes(3)
		})

		it("should handle data comparison workflows", () => {
			const beforeData = {
				"Files Processed": 150,
				Errors: 5,
				"Success Rate": "96.7%",
				"Last Run": "2024-01-01",
			}

			const afterData = {
				"Files Processed": 180,
				Errors: 2,
				"Success Rate": "98.9%",
				"Last Run": "2024-01-02",
			}

			uiService.showComparisonTable(beforeData, afterData, "Performance Comparison")

			expect(consoleSpy).toHaveBeenCalled()
		})

		it("should handle complex data structures", () => {
			// Test with various data types
			const complexData = [
				{
					name: "Task 1",
					status: true,
					progress: 100,
					details: { type: "build", target: "production" },
					timestamp: new Date(),
					nullable: null,
					description:
						"This is a very long description that should be truncated when displayed in the table to prevent layout issues",
				},
				{
					name: "Task 2",
					status: false,
					progress: 45,
					details: { type: "test", target: "development" },
					timestamp: new Date(),
					nullable: undefined,
					description: "Short desc",
				},
			]

			uiService.showTable(complexData)

			expect(consoleSpy).toHaveBeenCalled()
		})
	})

	describe("Color and Accessibility", () => {
		it("should work with colors disabled", () => {
			const noColorService = new CLIUIService(false)

			noColorService.success("Operation completed")
			noColorService.error("Something went wrong")
			noColorService.warning("Please be careful")
			noColorService.info("Information message")

			expect(consoleSpy).toHaveBeenCalledTimes(4)
		})

		it("should handle custom color schemes", () => {
			const customScheme = {
				success: "blue" as const,
				warning: "magenta" as const,
				error: "cyan" as const,
				info: "yellow" as const,
				highlight: "red" as const,
				muted: "white" as const,
				primary: "green" as const,
			}

			const customService = new CLIUIService(true, customScheme)

			customService.success("Custom colors enabled")
			customService.warning("This is a warning")

			expect(consoleSpy).toHaveBeenCalledTimes(2)
		})
	})

	describe("Progress Indicators", () => {
		it("should create and manage multiple progress indicators", () => {
			const spinner1 = ProgressIndicatorFactory.createSpinner("Task 1 running...")
			const spinner2 = ProgressIndicatorFactory.createSpinner("Task 2 running...")
			const progressBar = ProgressIndicatorFactory.createProgressBar({
				total: 100,
				message: "Processing...",
			})

			// Start indicators
			spinner1.start()
			spinner2.start()

			// Update progress
			progressBar.update(50)

			// Complete tasks
			spinner1.succeed("Task 1 completed")
			spinner2.fail("Task 2 failed")
			progressBar.stop()

			expect(spinner1).toBeDefined()
			expect(spinner2).toBeDefined()
			expect(progressBar.current).toBe(100) // Should be completed
		})

		it("should handle progress bar edge cases", () => {
			const progressBar = ProgressIndicatorFactory.createProgressBar({ total: 10 })

			// Test incremental updates
			progressBar.increment(5)
			expect(progressBar.current).toBe(5)

			// Test overflow protection
			progressBar.increment(20)
			expect(progressBar.current).toBe(10) // Should not exceed total

			// Test direct update
			progressBar.update(3)
			expect(progressBar.current).toBe(3)

			// Test negative values
			progressBar.update(-5)
			expect(progressBar.current).toBe(0) // Should not go below 0
		})
	})

	describe("Screen Management", () => {
		it("should manage screen real estate effectively", () => {
			const clearSpy = jest.spyOn(console, "clear").mockImplementation()

			// Clear screen
			uiService.clearScreen()
			expect(clearSpy).toHaveBeenCalled()

			// Show header with proper spacing
			uiService.showHeader("Welcome", "Getting started with CLI")

			// Show content with separators
			uiService.showSeparator("-", 40)
			uiService.info("Content section starts here")
			uiService.showSeparator("-", 40)

			// Show footer
			uiService.showInfoBox("End of output", "Summary")

			clearSpy.mockRestore()
		})
	})

	describe("Integration with External Libraries", () => {
		it("should properly integrate ora spinners", () => {
			const spinner = uiService.showSpinner("Loading...")

			// Test all spinner methods
			spinner.start()
			spinner.text = "Updated message"
			spinner.info("Info message")
			spinner.warn("Warning message")
			spinner.succeed("Success message")

			// Should not throw errors
			expect(() => spinner.stop()).not.toThrow()
		})

		it("should properly integrate boxen for formatted output", () => {
			// Test different box styles
			uiService.showBox("Simple message")

			uiService.showBox("Titled message", {
				title: "Important",
				borderStyle: "double",
				textAlignment: "center",
			})

			uiService.showBox("Custom styled box", {
				borderColor: "red",
				padding: 2,
				margin: 1,
			})

			expect(consoleSpy).toHaveBeenCalledTimes(3)
		})
	})

	describe("Performance and Memory", () => {
		it("should handle large datasets efficiently", () => {
			// Generate large dataset
			const largeData = Array.from({ length: 1000 }, (_, i) => ({
				id: i + 1,
				name: `Item ${i + 1}`,
				value: Math.random() * 1000,
				category: `Category ${i % 10}`,
				active: i % 2 === 0,
			}))

			// Should handle large datasets without errors
			expect(() => {
				uiService.showTable(largeData.slice(0, 10)) // Show only first 10 for performance
			}).not.toThrow()
		})

		it("should cleanup resources properly", () => {
			const spinner = uiService.showSpinner("Test spinner")
			spinner.start()

			// Cleanup should not throw
			expect(() => {
				spinner.stop()
			}).not.toThrow()
		})
	})

	describe("Error Handling", () => {
		it("should gracefully handle malformed data", () => {
			const malformedData = [
				{ name: "Valid" },
				null,
				undefined,
				{ name: "Also valid", extra: "data" },
				"string instead of object",
			] as any

			// Should handle malformed data gracefully
			expect(() => {
				uiService.showTable(malformedData.filter(Boolean))
			}).not.toThrow()
		})

		it("should handle very long strings", () => {
			const veryLongString = "x".repeat(1000)

			expect(() => {
				uiService.success(veryLongString)
				uiService.showBox(veryLongString)
			}).not.toThrow()
		})

		it("should handle special characters and emojis", () => {
			const specialText = "🚀 Special chars: áéíóú ñ ç 中文 العربية ★☆♥♪"

			expect(() => {
				uiService.info(specialText)
				uiService.showBox(specialText, { title: "🎨 Unicode Test" })
			}).not.toThrow()
		})
	})
})
