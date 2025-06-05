/* eslint-env node */
// Mock telemetry module for CLI context

class BaseTelemetryClient {
	constructor() {}
	capture() {}
	identify() {}
	flush() {}
}

class MockTelemetryService {
	constructor() {
		this.instance = null
	}

	static createInstance() {
		return new MockTelemetryService()
	}

	register() {}
	captureSchemaValidationError() {}
}

// eslint-disable-next-line no-undef
module.exports = {
	BaseTelemetryClient,
	TelemetryService: MockTelemetryService,
	PostHogTelemetryClient: class MockPostHogTelemetryClient extends BaseTelemetryClient {
		constructor() {
			super()
		}
		capture() {}
		identify() {}
		flush() {}
	},
}
