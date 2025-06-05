// CLI-specific telemetry exports that don't include VSCode dependencies
export * from "./BaseTelemetryClient"
export * from "./TelemetryService"

// Note: PostHogTelemetryClient is NOT exported here since it depends on vscode
