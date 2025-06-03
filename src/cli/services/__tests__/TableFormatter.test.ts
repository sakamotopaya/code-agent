import { TableFormatter } from "../TableFormatter"
import { ColorManager } from "../ColorManager"
import { DEFAULT_COLOR_SCHEME } from "../../types/ui-types"
import Table from "cli-table3"

// Mock cli-table3
jest.mock("cli-table3")

describe("TableFormatter", () => {
	let tableFormatter: TableFormatter
	let mockColorManager: jest.Mocked<ColorManager>
	let mockTable: any

	beforeEach(() => {
		// Create mock color manager
		mockColorManager = {
			muted: jest.fn((text) => `MUTED:${text}`),
			highlight: jest.fn((text) => `HIGHLIGHT:${text}`),
			bold: jest.fn((text) => `BOLD:${text}`),
			primary: jest.fn((text) => `PRIMARY:${text}`),
			success: jest.fn((text) => `SUCCESS:${text}`),
			error: jest.fn((text) => `ERROR:${text}`),
			warning: jest.fn((text) => `WARNING:${text}`),
			isColorsEnabled: jest.fn(() => true),
		} as any

		// Create mock table instance
		mockTable = {
			push: jest.fn(),
			toString: jest.fn(() => "formatted table output"),
			options: {},
		}

		// Mock Table constructor
		;(Table as jest.MockedClass<typeof Table>).mockImplementation(() => mockTable)

		tableFormatter = new TableFormatter(mockColorManager)
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe("Construction", () => {
		it("should create an instance with color manager", () => {
			expect(tableFormatter).toBeInstanceOf(TableFormatter)
		})
	})

	describe("formatTable", () => {
		it("should return message when no data provided", () => {
			const result = tableFormatter.formatTable([])
			expect(result).toBe("MUTED:No data to display")
		})

		it("should format array of objects", () => {
			const data = [
				{ name: "John", age: 30 },
				{ name: "Jane", age: 25 },
			]

			const result = tableFormatter.formatTable(data)

			expect(Table).toHaveBeenCalled()
			expect(mockTable.push).toHaveBeenCalledTimes(2)
			expect(result).toBe("formatted table output")
		})

		it("should format array of arrays", () => {
			const data = [
				["John", 30],
				["Jane", 25],
			]

			const result = tableFormatter.formatTable(data)

			expect(Table).toHaveBeenCalled()
			expect(mockTable.push).toHaveBeenCalledTimes(2)
			expect(result).toBe("formatted table output")
		})

		it("should use provided headers for object arrays", () => {
			const data = [{ name: "John", age: 30 }]
			const options = { head: ["Name", "Age"] }

			tableFormatter.formatTable(data, options)

			// Should use provided headers instead of auto-generating
			expect(mockTable.push).toHaveBeenCalledWith(["PRIMARY:John", "PRIMARY:30"])
		})

		it("should auto-generate headers for object arrays", () => {
			const data = [{ name: "John", age: 30 }]

			tableFormatter.formatTable(data)

			// Should auto-generate headers from first object
			expect(mockColorManager.bold).toHaveBeenCalledWith("name")
			expect(mockColorManager.bold).toHaveBeenCalledWith("age")
		})
	})

	describe("formatKeyValueTable", () => {
		it("should format key-value pairs", () => {
			const data = { name: "John", age: 30, active: true }

			const result = tableFormatter.formatKeyValueTable(data)

			expect(Table).toHaveBeenCalled()
			expect(mockTable.push).toHaveBeenCalledTimes(3)
			expect(result).toBe("formatted table output")
		})

		it("should use custom options", () => {
			const data = { name: "John" }
			const options = { head: ["Custom Property", "Custom Value"] }

			tableFormatter.formatKeyValueTable(data, options)

			expect(Table).toHaveBeenCalledWith(
				expect.objectContaining({
					head: ["Custom Property", "Custom Value"],
				}),
			)
		})
	})

	describe("formatColumnarTable", () => {
		it("should return message when no data provided", () => {
			const columns = [{ header: "Name", key: "name" }]
			const result = tableFormatter.formatColumnarTable([], columns)
			expect(result).toBe("MUTED:No data to display")
		})

		it("should format data with specified columns", () => {
			const data = [
				{ name: "John", age: 30, city: "NYC" },
				{ name: "Jane", age: 25, city: "LA" },
			]
			const columns = [
				{ header: "Name", key: "name" },
				{ header: "Age", key: "age" },
			]

			const result = tableFormatter.formatColumnarTable(data, columns)

			expect(mockColorManager.bold).toHaveBeenCalledWith("Name")
			expect(mockColorManager.bold).toHaveBeenCalledWith("Age")
			expect(mockTable.push).toHaveBeenCalledTimes(2)
			expect(result).toBe("formatted table output")
		})

		it("should apply column width constraints", () => {
			const data = [{ name: "John" }]
			const columns = [{ header: "Name", key: "name", width: 20 }]

			tableFormatter.formatColumnarTable(data, columns)

			expect(Table).toHaveBeenCalledWith(
				expect.objectContaining({
					colWidths: [20],
				}),
			)
		})

		it("should apply text alignment", () => {
			const data = [{ name: "John" }]
			const columns = [
				{
					header: "Name",
					key: "name",
					width: 10,
					alignment: "center" as const,
				},
			]

			const result = tableFormatter.formatColumnarTable(data, columns)

			// Alignment should be applied during formatting
			expect(result).toBe("formatted table output")
		})
	})

	describe("formatSummaryTable", () => {
		it("should return message when no data provided", () => {
			const result = tableFormatter.formatSummaryTable([], ["total"])
			expect(result).toBe("MUTED:No data to display")
		})

		it("should format data with summary row", () => {
			const data = [
				{ item: "A", quantity: 10, price: 5.0 },
				{ item: "B", quantity: 20, price: 3.0 },
			]
			const summaryColumns = ["quantity", "price"]

			const result = tableFormatter.formatSummaryTable(data, summaryColumns)

			expect(mockTable.push).toHaveBeenCalledTimes(3) // 2 data rows + 1 summary row
			expect(mockColorManager.bold).toHaveBeenCalledWith("Total:")
			expect(result).toBe("formatted table output")
		})

		it("should handle non-numeric values in summary columns", () => {
			const data = [
				{ item: "A", status: "active" },
				{ item: "B", status: "inactive" },
			]
			const summaryColumns = ["status"] // Non-numeric column

			expect(() => {
				tableFormatter.formatSummaryTable(data, summaryColumns)
			}).not.toThrow()
		})
	})

	describe("formatComparisonTable", () => {
		it("should format before/after comparison", () => {
			const before = { count: 10, status: "old" }
			const after = { count: 15, status: "new" }

			const result = tableFormatter.formatComparisonTable(before, after)

			expect(mockTable.push).toHaveBeenCalledTimes(2) // One row per property
			expect(mockColorManager.highlight).toHaveBeenCalledWith("count")
			expect(mockColorManager.highlight).toHaveBeenCalledWith("status")
			expect(result).toBe("formatted table output")
		})

		it("should handle missing properties", () => {
			const before = { count: 10 }
			const after = { count: 15, newProp: "value" }

			expect(() => {
				tableFormatter.formatComparisonTable(before, after)
			}).not.toThrow()
		})
	})

	describe("Value Formatting", () => {
		it("should format null/undefined values", () => {
			const data = [{ value: null, other: undefined }]
			tableFormatter.formatTable(data)

			// Should call muted for null/undefined values
			expect(mockColorManager.muted).toHaveBeenCalledWith("—")
		})

		it("should format boolean values", () => {
			const data = [{ active: true, disabled: false }]
			tableFormatter.formatTable(data)

			expect(mockColorManager.success).toHaveBeenCalledWith("✓")
			expect(mockColorManager.error).toHaveBeenCalledWith("✗")
		})

		it("should format number values", () => {
			const data = [{ count: 1234.56 }]
			tableFormatter.formatTable(data)

			expect(mockColorManager.primary).toHaveBeenCalledWith("1,234.56")
		})

		it("should format string values", () => {
			const data = [{ name: "John Doe" }]
			tableFormatter.formatTable(data)

			expect(mockColorManager.primary).toHaveBeenCalledWith("John Doe")
		})

		it("should truncate long strings", () => {
			const longString = "x".repeat(60)
			const data = [{ text: longString }]
			tableFormatter.formatTable(data)

			const truncated = longString.substring(0, 47) + "..."
			expect(mockColorManager.primary).toHaveBeenCalledWith(truncated)
		})

		it("should format object values", () => {
			const data = [{ obj: { nested: "value" } }]
			tableFormatter.formatTable(data)

			expect(mockColorManager.muted).toHaveBeenCalledWith("[Object]")
		})
	})

	describe("Change Indicators", () => {
		it("should show no change indicator", () => {
			const before = { value: 10 }
			const after = { value: 10 }

			tableFormatter.formatComparisonTable(before, after)

			expect(mockColorManager.muted).toHaveBeenCalledWith("—")
		})

		it("should show increase indicator for numbers", () => {
			const before = { value: 10 }
			const after = { value: 15 }

			tableFormatter.formatComparisonTable(before, after)

			expect(mockColorManager.success).toHaveBeenCalledWith("↑ 5")
		})

		it("should show decrease indicator for numbers", () => {
			const before = { value: 15 }
			const after = { value: 10 }

			tableFormatter.formatComparisonTable(before, after)

			expect(mockColorManager.error).toHaveBeenCalledWith("↓ 5")
		})

		it("should show generic change indicator for non-numbers", () => {
			const before = { status: "old" }
			const after = { status: "new" }

			tableFormatter.formatComparisonTable(before, after)

			expect(mockColorManager.warning).toHaveBeenCalledWith("Changed")
		})
	})

	describe("Table Options", () => {
		it("should apply default table options", () => {
			const data = [["test"]]
			tableFormatter.formatTable(data)

			expect(Table).toHaveBeenCalledWith(
				expect.objectContaining({
					style: expect.objectContaining({
						"padding-left": 1,
						"padding-right": 1,
						compact: false,
					}),
					chars: expect.objectContaining({
						top: "─",
						"top-mid": "┬",
						"top-left": "┌",
						"top-right": "┐",
					}),
				}),
			)
		})

		it("should merge custom options with defaults", () => {
			const data = [["test"]]
			const options = {
				style: { "padding-left": 2 },
				chars: { top: "=" },
			}

			tableFormatter.formatTable(data, options)

			expect(Table).toHaveBeenCalledWith(
				expect.objectContaining({
					style: expect.objectContaining({
						"padding-left": 2,
						"padding-right": 1, // Should keep default
					}),
					chars: expect.objectContaining({
						top: "=", // Should use custom
						"top-mid": "┬", // Should keep default
					}),
				}),
			)
		})

		it("should handle colors when disabled", () => {
			mockColorManager.isColorsEnabled.mockReturnValue(false)
			const formatter = new TableFormatter(mockColorManager)

			const data = [["test"]]
			formatter.formatTable(data)

			expect(Table).toHaveBeenCalledWith(
				expect.objectContaining({
					style: expect.objectContaining({
						head: [],
						border: [],
					}),
				}),
			)
		})
	})

	describe("Text Alignment", () => {
		it("should handle left alignment", () => {
			const data = [{ name: "test" }]
			const columns = [
				{
					header: "Name",
					key: "name",
					width: 10,
					alignment: "left" as const,
				},
			]

			expect(() => {
				tableFormatter.formatColumnarTable(data, columns)
			}).not.toThrow()
		})

		it("should handle center alignment", () => {
			const data = [{ name: "test" }]
			const columns = [
				{
					header: "Name",
					key: "name",
					width: 10,
					alignment: "center" as const,
				},
			]

			expect(() => {
				tableFormatter.formatColumnarTable(data, columns)
			}).not.toThrow()
		})

		it("should handle right alignment", () => {
			const data = [{ name: "test" }]
			const columns = [
				{
					header: "Name",
					key: "name",
					width: 10,
					alignment: "right" as const,
				},
			]

			expect(() => {
				tableFormatter.formatColumnarTable(data, columns)
			}).not.toThrow()
		})
	})
})
