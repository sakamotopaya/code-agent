/**
 * Console Output Writer - implements Single Responsibility Principle
 * Only responsible for writing output to the console/terminal
 */

import { IOutputWriter } from "./interfaces"

/**
 * ConsoleOutputWriter handles all console output operations
 * Single Responsibility: Only handles output writing to console
 */
export class ConsoleOutputWriter implements IOutputWriter {
	private isQuiet: boolean

	constructor(isQuiet: boolean = false) {
		this.isQuiet = isQuiet
	}

	/**
	 * Write content to console output
	 */
	write(content: string): void {
		if (this.isQuiet || !content) {
			return
		}

		try {
			process.stdout.write(content)
		} catch (error) {
			// Fallback to console.log if stdout fails
			console.error("[ConsoleOutputWriter] Error writing to stdout:", error)
			console.log(content)
		}
	}

	/**
	 * Write a tool indicator to console
	 */
	writeToolIndicator(toolName: string): void {
		if (this.isQuiet || !toolName) {
			return
		}

		try {
			// Tool indicators get a newline before and after for visibility
			process.stdout.write(`\n${toolName}...\n`)
		} catch (error) {
			console.error("[ConsoleOutputWriter] Error writing tool indicator:", error)
			console.log(`\n${toolName}...\n`)
		}
	}

	/**
	 * Clear current line in terminal
	 */
	clearLine(): void {
		if (this.isQuiet) {
			return
		}

		try {
			process.stdout.write("\r\x1b[K")
		} catch (error) {
			// If we can't clear line, just continue - not critical
			console.error("[ConsoleOutputWriter] Error clearing line:", error)
		}
	}

	/**
	 * Set quiet mode
	 */
	setQuiet(quiet: boolean): void {
		this.isQuiet = quiet
	}

	/**
	 * Check if in quiet mode
	 */
	getQuiet(): boolean {
		return this.isQuiet
	}
}
