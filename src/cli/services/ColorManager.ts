import chalk, { ChalkInstance } from "chalk"
import { ChalkColor, ColorScheme, DEFAULT_COLOR_SCHEME } from "../types/ui-types"

export class ColorManager {
	private colorScheme: ColorScheme
	private colorsEnabled: boolean

	constructor(colorScheme: ColorScheme = DEFAULT_COLOR_SCHEME, enableColors: boolean = true) {
		this.colorScheme = colorScheme
		this.colorsEnabled = enableColors && this.supportsColor()

		// Disable chalk if colors are not supported or disabled
		if (!this.colorsEnabled) {
			chalk.level = 0
		}
	}

	/**
	 * Colorize text with a specific color
	 */
	colorize(text: string, color: ChalkColor): string {
		if (!this.colorsEnabled) {
			return text
		}

		const chalkColor = chalk[color] as ChalkInstance
		return chalkColor ? chalkColor(text) : text
	}

	/**
	 * Apply success styling
	 */
	success(message: string): string {
		return this.colorize(`✓ ${message}`, this.colorScheme.success)
	}

	/**
	 * Apply warning styling
	 */
	warning(message: string): string {
		return this.colorize(`⚠ ${message}`, this.colorScheme.warning)
	}

	/**
	 * Apply error styling
	 */
	error(message: string): string {
		return this.colorize(`✗ ${message}`, this.colorScheme.error)
	}

	/**
	 * Apply info styling
	 */
	info(message: string): string {
		return this.colorize(`ℹ ${message}`, this.colorScheme.info)
	}

	/**
	 * Apply highlight styling
	 */
	highlight(message: string): string {
		return this.colorize(message, this.colorScheme.highlight)
	}

	/**
	 * Apply muted styling
	 */
	muted(message: string): string {
		return this.colorize(message, this.colorScheme.muted)
	}

	/**
	 * Apply primary styling
	 */
	primary(message: string): string {
		return this.colorize(message, this.colorScheme.primary)
	}

	/**
	 * Get colored chalk instance for direct use
	 */
	getChalk(color: ChalkColor): ChalkInstance {
		if (!this.colorsEnabled) {
			return chalk as ChalkInstance
		}
		return chalk[color] as ChalkInstance
	}

	/**
	 * Check if the terminal supports colors
	 */
	private supportsColor(): boolean {
		// Check environment variables
		if (process.env.NO_COLOR || process.env.NODE_DISABLE_COLORS) {
			return false
		}

		if (process.env.FORCE_COLOR) {
			return true
		}

		// Check if running in CI without color support
		if (process.env.CI && !process.env.GITHUB_ACTIONS) {
			return false
		}

		// Check terminal capabilities
		return process.stdout.isTTY && chalk.level > 0
	}

	/**
	 * Update color scheme
	 */
	setColorScheme(scheme: Partial<ColorScheme>): void {
		this.colorScheme = { ...this.colorScheme, ...scheme }
	}

	/**
	 * Enable or disable colors
	 */
	setColorsEnabled(enabled: boolean): void {
		this.colorsEnabled = enabled && this.supportsColor()
		chalk.level = this.colorsEnabled ? chalk.level || 1 : 0
	}

	/**
	 * Get current color support status
	 */
	isColorsEnabled(): boolean {
		return this.colorsEnabled
	}

	/**
	 * Get current color scheme
	 */
	getColorScheme(): ColorScheme {
		return { ...this.colorScheme }
	}

	/**
	 * Create a gradient effect (for special cases)
	 */
	gradient(text: string, colors: ChalkColor[]): string {
		if (!this.colorsEnabled || colors.length === 0) {
			return text
		}

		if (colors.length === 1) {
			return this.colorize(text, colors[0])
		}

		const chars = text.split("")
		const step = Math.max(1, Math.floor(chars.length / colors.length))

		return chars
			.map((char, index) => {
				const colorIndex = Math.min(Math.floor(index / step), colors.length - 1)
				return this.colorize(char, colors[colorIndex])
			})
			.join("")
	}

	/**
	 * Apply dim styling
	 */
	dim(message: string): string {
		if (!this.colorsEnabled) {
			return message
		}
		return chalk.dim(message)
	}

	/**
	 * Apply bold styling
	 */
	bold(message: string): string {
		if (!this.colorsEnabled) {
			return message
		}
		return chalk.bold(message)
	}

	/**
	 * Apply italic styling
	 */
	italic(message: string): string {
		if (!this.colorsEnabled) {
			return message
		}
		return chalk.italic(message)
	}

	/**
	 * Apply underline styling
	 */
	underline(message: string): string {
		if (!this.colorsEnabled) {
			return message
		}
		return chalk.underline(message)
	}

	/**
	 * Apply strikethrough styling
	 */
	strikethrough(message: string): string {
		if (!this.colorsEnabled) {
			return message
		}
		return chalk.strikethrough(message)
	}
}
