import ora, { Ora } from "ora"
import chalk from "chalk"

/**
 * CLI progress indicator using ora spinner
 */
export class CliProgressIndicator {
	private spinner: Ora
	private isComplete: boolean = false

	constructor(title: string) {
		this.spinner = ora({
			text: title,
			color: "blue",
			spinner: "dots",
		})
	}

	/**
	 * Start the progress indicator
	 */
	start(): void {
		if (!this.isComplete) {
			this.spinner.start()
		}
	}

	/**
	 * Update the progress message
	 * @param message The new progress message
	 * @param progress Optional progress percentage (0-100)
	 */
	update(message: string, progress?: number): void {
		if (!this.isComplete) {
			const displayMessage = progress !== undefined ? `${message} (${progress}%)` : message
			this.spinner.text = displayMessage
		}
	}

	/**
	 * Mark progress as successful and stop
	 * @param message Optional success message
	 */
	succeed(message?: string): void {
		if (!this.isComplete) {
			this.isComplete = true
			this.spinner.succeed(message || this.spinner.text)
		}
	}

	/**
	 * Mark progress as failed and stop
	 * @param message Optional failure message
	 */
	fail(message?: string): void {
		if (!this.isComplete) {
			this.isComplete = true
			this.spinner.fail(message || this.spinner.text)
		}
	}

	/**
	 * Mark progress as warning and stop
	 * @param message Optional warning message
	 */
	warn(message?: string): void {
		if (!this.isComplete) {
			this.isComplete = true
			this.spinner.warn(message || this.spinner.text)
		}
	}

	/**
	 * Stop the progress indicator
	 * @param finalText Optional final text to display
	 */
	stop(finalText?: string): void {
		if (!this.isComplete) {
			this.isComplete = true
			this.spinner.stop()
			if (finalText) {
				console.log(finalText)
			}
		}
	}

	/**
	 * Check if the progress indicator is still running
	 */
	isRunning(): boolean {
		return !this.isComplete && this.spinner.isSpinning
	}

	/**
	 * Change the spinner type
	 * @param spinnerName The name of the spinner to use
	 */
	setSpinner(spinnerName: string): void {
		if (!this.isComplete) {
			this.spinner.spinner = spinnerName as any
		}
	}

	/**
	 * Change the spinner color
	 * @param color The color to use
	 */
	setColor(color: string): void {
		if (!this.isComplete) {
			this.spinner.color = color as any
		}
	}
}
