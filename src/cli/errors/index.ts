/**
 * Error types for CLI utility
 */

export { CLIError } from "./CLIError"
export { FileSystemError, FileNotFoundError, PermissionDeniedError, DiskSpaceError } from "./FileSystemError"
export {
	NetworkError,
	ConnectionTimeoutError,
	DNSResolutionError,
	RateLimitError,
	AuthenticationError,
} from "./NetworkError"
export {
	ConfigurationError,
	InvalidConfigSyntaxError,
	MissingConfigError,
	InvalidConfigValueError,
	MissingRequiredConfigError,
} from "./ConfigurationError"
