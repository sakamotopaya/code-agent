import chalk from "chalk"

/**
 * Utility for formatting CLI output consistently
 */
export class OutputFormatter {
	/**
	 * Format an info message
	 * @param message The message to format
	 * @returns Formatted message
	 */
	static info(message: string): string {
		return chalk.blue(`ℹ ${message}`)
	}

	/**
	 * Format a warning message
	 * @param message The message to format
	 * @returns Formatted message
	 */
	static warning(message: string): string {
		return chalk.yellow(`⚠ ${message}`)
	}

	/**
	 * Format an error message
	 * @param message The message to format
	 * @returns Formatted message
	 */
	static error(message: string): string {
		return chalk.red(`✖ ${message}`)
	}

	/**
	 * Format a success message
	 * @param message The message to format
	 * @returns Formatted message
	 */
	static success(message: string): string {
		return chalk.green(`✓ ${message}`)
	}

	/**
	 * Format a debug message
	 * @param message The message to format
	 * @returns Formatted message
	 */
	static debug(message: string): string {
		return chalk.gray(`🐛 ${message}`)
	}

	/**
	 * Format a command
	 * @param command The command to format
	 * @returns Formatted command
	 */
	static command(command: string): string {
		return chalk.cyan(`$ ${command}`)
	}

	/**
	 * Format a file path
	 * @param path The path to format
	 * @returns Formatted path
	 */
	static path(path: string): string {
		return chalk.magenta(path)
	}

	/**
	 * Format a URL
	 * @param url The URL to format
	 * @returns Formatted URL
	 */
	static url(url: string): string {
		return chalk.blue.underline(url)
	}

	/**
	 * Format a header with separators
	 * @param title The header title
	 * @param width Optional width (default: 50)
	 * @returns Formatted header
	 */
	static header(title: string, width: number = 50): string {
		const separator = "=".repeat(width)
		const centeredTitle = title.length >= width ? title : " ".repeat(Math.floor((width - title.length) / 2)) + title

		return chalk.bold(`\n${separator}\n${centeredTitle}\n${separator}`)
	}

	/**
	 * Format a section header
	 * @param title The section title
	 * @returns Formatted section header
	 */
	static section(title: string): string {
		return chalk.bold.underline(`\n${title}`)
	}

	/**
	 * Format a timestamp
	 * @param date Optional date (default: now)
	 * @returns Formatted timestamp
	 */
	static timestamp(date?: Date): string {
		const timestamp = (date || new Date()).toISOString()
		return chalk.gray(`[${timestamp}]`)
	}

	/**
	 * Format JSON with syntax highlighting
	 * @param obj The object to format
	 * @param indent Optional indentation (default: 2)
	 * @returns Formatted JSON
	 */
	static json(obj: any, indent: number = 2): string {
		const json = JSON.stringify(obj, null, indent)
		return json
			.replace(/"([^"]+)":/g, chalk.blue('"$1"') + ":")
			.replace(/: "([^"]+)"/g, ": " + chalk.green('"$1"'))
			.replace(/: (\d+)/g, ": " + chalk.yellow("$1"))
			.replace(/: (true|false)/g, ": " + chalk.magenta("$1"))
			.replace(/: null/g, ": " + chalk.gray("null"))
	}

	/**
	 * Format a progress bar
	 * @param progress Progress percentage (0-100)
	 * @param width Optional width (default: 20)
	 * @returns Formatted progress bar
	 */
	static progressBar(progress: number, width: number = 20): string {
		const filled = Math.floor((progress / 100) * width)
		const empty = width - filled
		const bar = "█".repeat(filled) + "░".repeat(empty)
		return chalk.cyan(`[${bar}] ${progress}%`)
	}

	/**
	 * Format a table row
	 * @param columns Array of column values
	 * @param widths Array of column widths
	 * @returns Formatted table row
	 */
	static tableRow(columns: string[], widths: number[]): string {
		return columns.map((col, i) => col.padEnd(widths[i] || 10)).join(" | ")
	}

	/**
	 * Format a horizontal divider
	 * @param width Optional width (default: 50)
	 * @param char Optional character (default: -)
	 * @returns Formatted divider
	 */
	static divider(width: number = 50, char: string = "-"): string {
		return chalk.gray(char.repeat(width))
	}
}
