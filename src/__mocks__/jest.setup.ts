import nock from "nock"

nock.disableNetConnect()

export function allowNetConnect(host?: string | RegExp) {
	if (host) {
		nock.enableNetConnect(host)
	} else {
		nock.enableNetConnect()
	}
}

// Mock the logger globally for all tests
jest.mock("../utils/logging", () => ({
	logger: {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		fatal: jest.fn(),
		child: jest.fn().mockReturnValue({
			debug: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			fatal: jest.fn(),
		}),
	},
}))

// Mock TelemetryService globally for all tests
jest.mock("../../packages/telemetry/src/TelemetryService", () => ({
	TelemetryService: {
		createInstance: jest.fn().mockReturnValue({
			register: jest.fn(),
			setProvider: jest.fn(),
			updateTelemetryState: jest.fn(),
			captureEvent: jest.fn(),
			captureTaskCreated: jest.fn(),
			captureTaskRestarted: jest.fn(),
			captureTaskCompleted: jest.fn(),
			captureConversationMessage: jest.fn(),
			captureModeSwitch: jest.fn(),
			captureToolUsage: jest.fn(),
			captureCheckpointCreated: jest.fn(),
			captureCheckpointDiffed: jest.fn(),
			captureCheckpointRestored: jest.fn(),
			captureSlidingWindowTruncation: jest.fn(),
			captureCodeActionUsed: jest.fn(),
			capturePromptEnhanced: jest.fn(),
			captureSchemaValidationError: jest.fn(),
			captureDiffApplicationError: jest.fn(),
			captureShellIntegrationError: jest.fn(),
			captureConsecutiveMistakeError: jest.fn(),
			captureTitleButtonClicked: jest.fn(),
			isTelemetryEnabled: jest.fn().mockReturnValue(false),
			shutdown: jest.fn(),
		}),
		instance: {
			register: jest.fn(),
			setProvider: jest.fn(),
			updateTelemetryState: jest.fn(),
			captureEvent: jest.fn(),
			captureTaskCreated: jest.fn(),
			captureTaskRestarted: jest.fn(),
			captureTaskCompleted: jest.fn(),
			captureConversationMessage: jest.fn(),
			captureModeSwitch: jest.fn(),
			captureToolUsage: jest.fn(),
			captureCheckpointCreated: jest.fn(),
			captureCheckpointDiffed: jest.fn(),
			captureCheckpointRestored: jest.fn(),
			captureSlidingWindowTruncation: jest.fn(),
			captureCodeActionUsed: jest.fn(),
			capturePromptEnhanced: jest.fn(),
			captureSchemaValidationError: jest.fn(),
			captureDiffApplicationError: jest.fn(),
			captureShellIntegrationError: jest.fn(),
			captureConsecutiveMistakeError: jest.fn(),
			captureTitleButtonClicked: jest.fn(),
			isTelemetryEnabled: jest.fn().mockReturnValue(false),
			shutdown: jest.fn(),
		},
		hasInstance: jest.fn().mockReturnValue(true),
	},
}))

// Add toPosix method to String prototype for all tests, mimicking src/utils/path.ts
// This is needed because the production code expects strings to have this method
// Note: In production, this is added via import in the entry point (extension.ts)
export {}

declare global {
	interface String {
		toPosix(): string
	}
}

// Implementation that matches src/utils/path.ts
function toPosixPath(p: string) {
	// Extended-Length Paths in Windows start with "\\?\" to allow longer paths
	// and bypass usual parsing. If detected, we return the path unmodified.
	const isExtendedLengthPath = p.startsWith("\\\\?\\")

	if (isExtendedLengthPath) {
		return p
	}

	return p.replace(/\\/g, "/")
}

if (!String.prototype.toPosix) {
	String.prototype.toPosix = function (this: string): string {
		return toPosixPath(this)
	}
}
