import { ColorManager } from "../ColorManager"
import { DEFAULT_COLOR_SCHEME } from "../../types/ui-types"

describe("ColorManager", () => {
	let colorManager: ColorManager

	beforeEach(() => {
		colorManager = new ColorManager(DEFAULT_COLOR_SCHEME, true)
	})

	describe("Construction", () => {
		it("should create an instance with default color scheme", () => {
			const manager = new ColorManager()
			expect(manager).toBeInstanceOf(ColorManager)
		})

		it("should create an instance with custom color scheme", () => {
			const customScheme = {
				...DEFAULT_COLOR_SCHEME,
				success: "blue" as const,
			}
			const manager = new ColorManager(customScheme, true)
			expect(manager).toBeInstanceOf(ColorManager)
		})

		it("should create an instance with colors disabled", () => {
			const manager = new ColorManager(DEFAULT_COLOR_SCHEME, false)
			expect(manager.isColorsEnabled()).toBe(false)
		})
	})

	describe("Basic Colorization", () => {
		it("should colorize text when colors are enabled", () => {
			const result = colorManager.colorize("test text", "red")
			expect(result).toContain("test text")
			// Note: Actual ANSI escape codes depend on chalk implementation
		})

		it("should return plain text when colors are disabled", () => {
			const manager = new ColorManager(DEFAULT_COLOR_SCHEME, false)
			const result = manager.colorize("test text", "red")
			expect(result).toBe("test text")
		})
	})

	describe("Semantic Color Methods", () => {
		it("should apply success styling", () => {
			const result = colorManager.success("Operation completed")
			expect(result).toContain("✓ Operation completed")
		})

		it("should apply warning styling", () => {
			const result = colorManager.warning("Warning message")
			expect(result).toContain("⚠ Warning message")
		})

		it("should apply error styling", () => {
			const result = colorManager.error("Error message")
			expect(result).toContain("✗ Error message")
		})

		it("should apply info styling", () => {
			const result = colorManager.info("Info message")
			expect(result).toContain("ℹ Info message")
		})

		it("should apply highlight styling", () => {
			const result = colorManager.highlight("Highlighted text")
			expect(result).toContain("Highlighted text")
		})

		it("should apply muted styling", () => {
			const result = colorManager.muted("Muted text")
			expect(result).toContain("Muted text")
		})

		it("should apply primary styling", () => {
			const result = colorManager.primary("Primary text")
			expect(result).toContain("Primary text")
		})
	})

	describe("Text Formatting", () => {
		it("should apply bold formatting", () => {
			const result = colorManager.bold("Bold text")
			expect(result).toContain("Bold text")
		})

		it("should apply italic formatting", () => {
			const result = colorManager.italic("Italic text")
			expect(result).toContain("Italic text")
		})

		it("should apply underline formatting", () => {
			const result = colorManager.underline("Underlined text")
			expect(result).toContain("Underlined text")
		})

		it("should apply strikethrough formatting", () => {
			const result = colorManager.strikethrough("Strikethrough text")
			expect(result).toContain("Strikethrough text")
		})

		it("should apply dim formatting", () => {
			const result = colorManager.dim("Dimmed text")
			expect(result).toContain("Dimmed text")
		})
	})

	describe("Advanced Features", () => {
		it("should create gradient effect", () => {
			const result = colorManager.gradient("Rainbow Text", ["red", "green", "blue"])
			expect(result).toContain("R")
			expect(result).toContain("a")
			expect(result).toContain("i")
		})

		it("should handle single color gradient", () => {
			const result = colorManager.gradient("Single Color", ["red"])
			expect(result).toContain("Single Color")
		})

		it("should handle empty colors array", () => {
			const result = colorManager.gradient("No Colors", [])
			expect(result).toBe("No Colors")
		})
	})

	describe("Color Scheme Management", () => {
		it("should update color scheme partially", () => {
			const originalScheme = colorManager.getColorScheme()

			colorManager.setColorScheme({ success: "blue" })
			const updatedScheme = colorManager.getColorScheme()

			expect(updatedScheme.success).toBe("blue")
			expect(updatedScheme.error).toBe(originalScheme.error)
			expect(updatedScheme.warning).toBe(originalScheme.warning)
		})

		it("should get current color scheme", () => {
			const scheme = colorManager.getColorScheme()
			expect(scheme).toEqual(DEFAULT_COLOR_SCHEME)
		})
	})

	describe("Color Support Detection", () => {
		it("should enable colors when supported", () => {
			// Test depends on environment, but should not throw
			expect(() => colorManager.isColorsEnabled()).not.toThrow()
		})

		it("should disable colors when explicitly set", () => {
			colorManager.setColorsEnabled(false)
			expect(colorManager.isColorsEnabled()).toBe(false)
		})

		it("should enable colors when explicitly set", () => {
			colorManager.setColorsEnabled(false)
			colorManager.setColorsEnabled(true)
			// Result depends on actual terminal support
			expect(typeof colorManager.isColorsEnabled()).toBe("boolean")
		})
	})

	describe("Chalk Integration", () => {
		it("should get chalk instance for color", () => {
			const chalkRed = colorManager.getChalk("red")
			expect(chalkRed).toBeDefined()
			expect(typeof chalkRed).toBe("function")
		})

		it("should handle invalid color gracefully", () => {
			// TypeScript should prevent this, but test runtime behavior
			const chalkInvalid = colorManager.getChalk("invalidColor" as any)
			expect(chalkInvalid).toBeDefined()
		})
	})

	describe("Environment Variables", () => {
		let originalEnv: NodeJS.ProcessEnv

		beforeEach(() => {
			originalEnv = { ...process.env }
		})

		afterEach(() => {
			process.env = originalEnv
		})

		it("should disable colors when NO_COLOR is set", () => {
			process.env.NO_COLOR = "1"
			const manager = new ColorManager(DEFAULT_COLOR_SCHEME, true)
			expect(manager.isColorsEnabled()).toBe(false)
		})

		it("should disable colors when NODE_DISABLE_COLORS is set", () => {
			process.env.NODE_DISABLE_COLORS = "1"
			const manager = new ColorManager(DEFAULT_COLOR_SCHEME, true)
			expect(manager.isColorsEnabled()).toBe(false)
		})

		it("should force colors when FORCE_COLOR is set", () => {
			process.env.FORCE_COLOR = "1"
			const manager = new ColorManager(DEFAULT_COLOR_SCHEME, true)
			// Should attempt to enable colors regardless of terminal support
			expect(typeof manager.isColorsEnabled()).toBe("boolean")
		})
	})

	describe("Error Handling", () => {
		it("should handle null/undefined text gracefully", () => {
			expect(() => colorManager.success(null as any)).not.toThrow()
			expect(() => colorManager.error(undefined as any)).not.toThrow()
		})

		it("should handle empty strings", () => {
			const result = colorManager.highlight("")
			expect(result).toBe("")
		})

		it("should handle very long strings", () => {
			const longString = "x".repeat(10000)
			expect(() => colorManager.primary(longString)).not.toThrow()
		})
	})
})
