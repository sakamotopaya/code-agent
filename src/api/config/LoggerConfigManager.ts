import { ApiConfigManager } from "./ApiConfigManager"
import path from "path"
import fs from "fs"

/**
 * Enhanced logger configuration manager for Fastify/Pino
 * Provides both console and file logging using streams (no workers)
 * Includes console interception to capture all application logs
 */
export class LoggerConfigManager {
	private static fileStreams: { api?: fs.WriteStream; error?: fs.WriteStream } = {}
	private static originalConsole: { log: any; warn: any; error: any; info: any; debug: any } = {
		log: console.log,
		warn: console.warn,
		error: console.error,
		info: console.info,
		debug: console.debug,
	}
	private static consoleIntercepted = false

	/**
	 * Create enhanced Pino logger configuration for Fastify
	 * Uses streams instead of transport targets to avoid worker dependencies
	 */
	static createLoggerConfig(config: ApiConfigManager): any {
		console.log("[LoggerConfigManager] 🔥 METHOD CALLED - START OF createLoggerConfig")
		const serverConfig = config.getConfiguration()
		const logsDir = process.env.LOGS_PATH || "./logs"
		const fileLoggingEnabled = process.env.LOG_FILE_ENABLED === "true"
		const isDevelopment = process.env.NODE_ENV === "development"

		console.log("[LoggerConfigManager] 🚀 Initializing logger configuration...")
		console.log("[LoggerConfigManager] Environment:", {
			NODE_ENV: process.env.NODE_ENV,
			logsDir,
			fileLoggingEnabled,
			isDevelopment,
			debugMode: serverConfig.debug,
		})

		// Ensure logs directory exists when file logging is enabled
		if (fileLoggingEnabled) {
			try {
				fs.mkdirSync(logsDir, { recursive: true })
				console.log(`[LoggerConfigManager] ✅ Created logs directory: ${logsDir}`)
			} catch (error) {
				console.warn(`[LoggerConfigManager] ❌ Failed to create logs directory ${logsDir}:`, error)
			}
		}

		try {
			const loggerOptions: any = {
				level: serverConfig.debug ? "debug" : "info",
				formatters: {
					time: (timestamp: number) => `,"time":"${new Date(timestamp).toISOString()}"`,
					level: (label: string) => ({ level: label }),
				},
				serializers: {
					req: (req: any) => ({
						method: req.method,
						url: req.url,
						headers: {
							"user-agent": req.headers["user-agent"],
							"content-type": req.headers["content-type"],
							authorization: req.headers.authorization ? "[REDACTED]" : undefined,
						},
						remoteAddress: req.ip,
						remotePort: req.socket?.remotePort,
					}),
					res: (res: any) => ({
						statusCode: res.statusCode,
						headers: {
							"content-type": res.headers["content-type"],
							"content-length": res.headers["content-length"],
						},
					}),
					err: (err: Error) => ({
						type: err.constructor.name,
						message: err.message,
						stack: err.stack || "",
						code: (err as any).code,
						statusCode: (err as any).statusCode,
					}),
				},
			}

			// Set up streams for multi-destination logging
			if (fileLoggingEnabled) {
				console.log("[LoggerConfigManager] 📁 Setting up file logging with streams...")

				const apiLogPath = path.join(logsDir, "api.log")
				const errorLogPath = path.join(logsDir, "api-error.log")

				console.log("[LoggerConfigManager] 📄 API log file:", apiLogPath)
				console.log("[LoggerConfigManager] 🚨 Error log file:", errorLogPath)

				// Create write streams for file logging
				this.fileStreams.api = fs.createWriteStream(apiLogPath, { flags: "a" })
				this.fileStreams.error = fs.createWriteStream(errorLogPath, { flags: "a" })

				// Create a custom stream that writes to both console and file
				const multiWriteStream = {
					write: (chunk: string) => {
						// Write to console (stdout)
						process.stdout.write(chunk)
						// Write to API log file
						this.fileStreams.api?.write(chunk)
						// Write to error log if it's an error level
						if (chunk.includes('"level":"error"') || chunk.includes('"level":50')) {
							this.fileStreams.error?.write(chunk)
						}
					},
				}

				// Use the custom multi-write stream
				loggerOptions.stream = multiWriteStream
				console.log("[LoggerConfigManager] 📊 Configured multi-write stream for console + file output")

				// Set up console interception to capture all application logs
				this.setupConsoleInterception()
			} else {
				console.log("[LoggerConfigManager] 📺 Console-only logging enabled")
				// Console output only - use default stream (stdout)
			}

			console.log("[LoggerConfigManager] 🎯 Logger configuration created successfully")
			console.log("[LoggerConfigManager] 🔧 Config level:", loggerOptions.level)
			console.log("[LoggerConfigManager] 📁 File logging:", fileLoggingEnabled ? "enabled" : "disabled")

			return loggerOptions
		} catch (error) {
			console.error("[LoggerConfigManager] Failed to create logger config:", error)
			// Return basic fallback configuration
			return {
				level: serverConfig.debug ? "debug" : "info",
			}
		}
	}

	/**
	 * Set up console interception to capture all console.log/warn/error calls
	 * and write them to log files while maintaining console output
	 */
	private static setupConsoleInterception(): void {
		if (this.consoleIntercepted) {
			console.log("[LoggerConfigManager] 🔄 Console interception already set up")
			return
		}

		console.log("[LoggerConfigManager] 🎯 Setting up console interception for file logging...")

		// Helper function to write to file streams
		const writeToFiles = (level: string, message: string) => {
			const timestamp = new Date().toISOString()
			const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`

			// Write to main API log
			if (this.fileStreams.api) {
				this.fileStreams.api.write(logEntry)
			}

			// Write errors to error log as well
			if (level === "error" && this.fileStreams.error) {
				this.fileStreams.error.write(logEntry)
			}
		}

		// Intercept console.log
		console.log = (...args: any[]) => {
			const message = args
				.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(" ")
			writeToFiles("info", message)
			this.originalConsole.log(...args) // Still show in console
		}

		// Intercept console.info
		console.info = (...args: any[]) => {
			const message = args
				.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(" ")
			writeToFiles("info", message)
			this.originalConsole.info(...args) // Still show in console
		}

		// Intercept console.warn
		console.warn = (...args: any[]) => {
			const message = args
				.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(" ")
			writeToFiles("warn", message)
			this.originalConsole.warn(...args) // Still show in console
		}

		// Intercept console.error
		console.error = (...args: any[]) => {
			const message = args
				.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(" ")
			writeToFiles("error", message)
			this.originalConsole.error(...args) // Still show in console
		}

		// Intercept console.debug
		console.debug = (...args: any[]) => {
			const message = args
				.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(" ")
			writeToFiles("debug", message)
			this.originalConsole.debug(...args) // Still show in console
		}

		this.consoleIntercepted = true
		console.log("[LoggerConfigManager] ✅ Console interception set up successfully")
	}

	/**
	 * Restore original console methods (for cleanup/testing)
	 */
	static restoreConsole(): void {
		if (!this.consoleIntercepted) return

		console.log = this.originalConsole.log
		console.info = this.originalConsole.info
		console.warn = this.originalConsole.warn
		console.error = this.originalConsole.error
		console.debug = this.originalConsole.debug

		this.consoleIntercepted = false
		console.log("[LoggerConfigManager] 🔄 Console methods restored")
	}

	/**
	 * Close file streams (for cleanup)
	 */
	static cleanup(): void {
		if (this.fileStreams.api) {
			this.fileStreams.api.end()
			this.fileStreams.api = undefined
		}
		if (this.fileStreams.error) {
			this.fileStreams.error.end()
			this.fileStreams.error = undefined
		}
		this.restoreConsole()
		console.log("[LoggerConfigManager] 🧹 Cleanup completed")
	}

	/**
	 * Get logging configuration summary for startup logging
	 */
	static getLoggingInfo(): {
		logsDir: string
		fileLoggingEnabled: boolean
		rotationEnabled: boolean
		logLevel: string
	} {
		return {
			logsDir: process.env.LOGS_PATH || "/app/logs",
			fileLoggingEnabled: process.env.LOG_FILE_ENABLED === "true",
			rotationEnabled: process.env.LOG_ROTATION_ENABLED === "true",
			logLevel: process.env.LOG_LEVEL || "info",
		}
	}

	/**
	 * Validate logging configuration and environment
	 */
	static validateLoggingSetup(): { valid: boolean; warnings: string[] } {
		const warnings: string[] = []
		const logsDir = process.env.LOGS_PATH || "./logs"
		const fileLoggingEnabled = process.env.LOG_FILE_ENABLED === "true"

		// Check if logs directory is writable when file logging is enabled
		if (fileLoggingEnabled) {
			try {
				fs.accessSync(logsDir, fs.constants.W_OK)
			} catch (error) {
				try {
					// Try to create the directory
					fs.mkdirSync(logsDir, { recursive: true })
				} catch (createError) {
					warnings.push(`Logs directory ${logsDir} is not writable and cannot be created`)
				}
			}
		}

		// Validate log level
		const logLevel = process.env.LOG_LEVEL
		const validLevels = ["trace", "debug", "info", "warn", "error", "fatal"]
		if (logLevel && !validLevels.includes(logLevel)) {
			warnings.push(`Invalid LOG_LEVEL: ${logLevel}. Valid levels: ${validLevels.join(", ")}`)
		}

		// Check rotation settings
		const maxSize = process.env.LOG_MAX_SIZE
		if (maxSize && !/^\d+[KMGT]?B?$/i.test(maxSize)) {
			warnings.push(`Invalid LOG_MAX_SIZE format: ${maxSize}. Use format like "10MB", "1GB"`)
		}

		const maxFiles = process.env.LOG_MAX_FILES
		if (maxFiles && (isNaN(parseInt(maxFiles)) || parseInt(maxFiles) < 1)) {
			warnings.push(`Invalid LOG_MAX_FILES: ${maxFiles}. Must be a positive integer`)
		}

		return {
			valid: warnings.length === 0,
			warnings,
		}
	}
}
