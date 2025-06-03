import ora, { Ora } from "ora"
import { ISpinner, IProgressBar, ProgressOptions } from "../types/ui-types"

export class SpinnerWrapper implements ISpinner {
	private spinner: Ora

	constructor(message: string) {
		this.spinner = ora(message)
	}

	start(): void {
		this.spinner.start()
	}

	stop(): void {
		this.spinner.stop()
	}

	succeed(message?: string): void {
		this.spinner.succeed(message)
	}

	fail(message?: string): void {
		this.spinner.fail(message)
	}

	warn(message?: string): void {
		this.spinner.warn(message)
	}

	info(message?: string): void {
		this.spinner.info(message)
	}

	get text(): string {
		return this.spinner.text
	}

	set text(value: string) {
		this.spinner.text = value
	}
}

export class ProgressBarWrapper implements IProgressBar {
	private _total: number
	private _current: number
	private startTime: number
	private message: string
	private lastUpdate: number
	private updateThreshold: number = 100 // ms

	constructor(options: ProgressOptions) {
		this._total = options.total
		this._current = 0
		this.message = options.message || "Processing..."
		this.startTime = Date.now()
		this.lastUpdate = 0
	}

	increment(value: number = 1): void {
		this._current = Math.min(this._current + value, this._total)
		this.render()
	}

	update(current: number): void {
		this._current = Math.min(Math.max(0, current), this._total)
		this.render()
	}

	stop(): void {
		this._current = this._total
		this.render()
		process.stdout.write("\n")
	}

	get total(): number {
		return this._total
	}

	get current(): number {
		return this._current
	}

	private render(): void {
		const now = Date.now()
		if (now - this.lastUpdate < this.updateThreshold && this._current < this._total) {
			return
		}
		this.lastUpdate = now

		const percentage = Math.round((this._current / this._total) * 100)
		const elapsed = now - this.startTime
		const estimated = this._current > 0 ? (elapsed / this._current) * this._total : 0
		const remaining = Math.max(0, estimated - elapsed)

		const barLength = 30
		const filled = Math.round((this._current / this._total) * barLength)
		const bar = "█".repeat(filled) + "░".repeat(barLength - filled)

		const eta = remaining > 0 ? this.formatTime(remaining) : "00:00"
		const speed = this._current > 0 ? (this._current / (elapsed / 1000)).toFixed(1) : "0.0"

		const line = `\r${this.message} [${bar}] ${percentage}% | ${this._current}/${this._total} | ETA: ${eta} | Speed: ${speed}/s`

		process.stdout.write(line)
	}

	private formatTime(ms: number): string {
		const seconds = Math.floor(ms / 1000)
		const minutes = Math.floor(seconds / 60)
		const remainingSeconds = seconds % 60
		return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
	}
}

export class ProgressIndicatorFactory {
	static createSpinner(message: string): ISpinner {
		return new SpinnerWrapper(message)
	}

	static createProgressBar(options: ProgressOptions): IProgressBar {
		return new ProgressBarWrapper(options)
	}
}
