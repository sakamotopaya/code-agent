import { CLIUIService } from "../CLIUIService"
import { PREDEFINED_COLOR_SCHEMES } from "../../types/ui-types"

describe("Color Scheme Integration", () => {
	let consoleSpy: jest.SpyInstance

	beforeEach(() => {
		consoleSpy = jest.spyOn(console, "log").mockImplementation()
	})

	afterEach(() => {
		consoleSpy.mockRestore()
	})

	describe("Predefined Color Schemes", () => {
		it("should use default color scheme when none specified", () => {
			const ui = new CLIUIService(true)
			expect(ui.getColorManager().getColorScheme()).toEqual(PREDEFINED_COLOR_SCHEMES.default)
		})

		it("should use dark color scheme when specified", () => {
			const ui = new CLIUIService(true, PREDEFINED_COLOR_SCHEMES.dark)
			expect(ui.getColorManager().getColorScheme()).toEqual(PREDEFINED_COLOR_SCHEMES.dark)
		})

		it("should use light color scheme when specified", () => {
			const ui = new CLIUIService(true, PREDEFINED_COLOR_SCHEMES.light)
			expect(ui.getColorManager().getColorScheme()).toEqual(PREDEFINED_COLOR_SCHEMES.light)
		})

		it("should use high-contrast color scheme when specified", () => {
			const ui = new CLIUIService(true, PREDEFINED_COLOR_SCHEMES["high-contrast"])
			expect(ui.getColorManager().getColorScheme()).toEqual(PREDEFINED_COLOR_SCHEMES["high-contrast"])
		})

		it("should use minimal color scheme when specified", () => {
			const ui = new CLIUIService(true, PREDEFINED_COLOR_SCHEMES.minimal)
			expect(ui.getColorManager().getColorScheme()).toEqual(PREDEFINED_COLOR_SCHEMES.minimal)
		})
	})

	describe("Color Scheme Behavior", () => {
		it("should display different colored output based on scheme", () => {
			const darkUI = new CLIUIService(true, PREDEFINED_COLOR_SCHEMES.dark)
			const lightUI = new CLIUIService(true, PREDEFINED_COLOR_SCHEMES.light)

			// Both should work without throwing errors
			expect(() => {
				darkUI.success("Success message")
				darkUI.error("Error message")
				darkUI.warning("Warning message")
				darkUI.info("Info message")
			}).not.toThrow()

			expect(() => {
				lightUI.success("Success message")
				lightUI.error("Error message")
				lightUI.warning("Warning message")
				lightUI.info("Info message")
			}).not.toThrow()

			expect(consoleSpy).toHaveBeenCalledTimes(8)
		})

		it("should work with colors disabled", () => {
			const ui = new CLIUIService(false, PREDEFINED_COLOR_SCHEMES.dark)

			expect(() => {
				ui.success("Success message")
				ui.error("Error message")
				ui.showBox("Boxed message")
			}).not.toThrow()

			expect(consoleSpy).toHaveBeenCalled()
		})
	})

	describe("Runtime Color Scheme Changes", () => {
		it("should allow runtime color scheme updates", () => {
			const ui = new CLIUIService(true, PREDEFINED_COLOR_SCHEMES.default)

			// Update to dark scheme
			ui.setColorScheme(PREDEFINED_COLOR_SCHEMES.dark)
			expect(ui.getColorManager().getColorScheme()).toEqual(PREDEFINED_COLOR_SCHEMES.dark)

			// Update to high contrast
			ui.setColorScheme(PREDEFINED_COLOR_SCHEMES["high-contrast"])
			expect(ui.getColorManager().getColorScheme()).toEqual(PREDEFINED_COLOR_SCHEMES["high-contrast"])
		})

		it("should allow partial color scheme updates", () => {
			const ui = new CLIUIService(true, PREDEFINED_COLOR_SCHEMES.default)
			const originalScheme = ui.getColorManager().getColorScheme()

			// Update only success color
			ui.setColorScheme({ success: "magenta" })
			const updatedScheme = ui.getColorManager().getColorScheme()

			expect(updatedScheme.success).toBe("magenta")
			expect(updatedScheme.error).toBe(originalScheme.error)
			expect(updatedScheme.warning).toBe(originalScheme.warning)
		})
	})

	describe("Accessibility", () => {
		it("should provide meaningful output when colors are disabled", () => {
			const ui = new CLIUIService(false, PREDEFINED_COLOR_SCHEMES.minimal)

			ui.success("Success message")
			ui.error("Error message")
			ui.warning("Warning message")
			ui.info("Info message")

			// Should still include symbols for accessibility
			const calls = consoleSpy.mock.calls
			expect(calls.some((call) => call[0].includes("✓"))).toBe(true) // Success symbol
			expect(calls.some((call) => call[0].includes("✗"))).toBe(true) // Error symbol
			expect(calls.some((call) => call[0].includes("⚠"))).toBe(true) // Warning symbol
			expect(calls.some((call) => call[0].includes("ℹ"))).toBe(true) // Info symbol
		})
	})
})
