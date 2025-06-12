import { ITelemetryService } from "../../interfaces"

export interface ApiTelemetryOptions {
	enabled?: boolean
	verbose?: boolean
}

export class ApiTelemetryService implements ITelemetryService {
	private options: ApiTelemetryOptions

	constructor(options: ApiTelemetryOptions = {}) {
		this.options = {
			enabled: false,
			verbose: false,
			...options,
		}
	}

	private log(message: string): void {
		if (this.options.verbose) {
			console.log(`[API Telemetry] ${message}`)
		}
	}

	async sendEvent(eventName: string, properties?: Record<string, any>): Promise<void> {
		if (this.options.enabled) {
			this.log(`Event: ${eventName} ${properties ? JSON.stringify(properties) : ""}`)
		}
	}

	async sendError(error: Error, properties?: Record<string, any>): Promise<void> {
		if (this.options.enabled) {
			this.log(`Error: ${error.message} ${properties ? JSON.stringify(properties) : ""}`)
		}
	}

	async sendMetric(metricName: string, value: number, properties?: Record<string, any>): Promise<void> {
		if (this.options.enabled) {
			this.log(`Metric: ${metricName}=${value} ${properties ? JSON.stringify(properties) : ""}`)
		}
	}

	isEnabled(): boolean {
		return this.options.enabled
	}

	async flush(): Promise<void> {
		this.log("Telemetry flushed")
	}
}
