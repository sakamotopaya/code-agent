import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { spawn, ChildProcess } from "child_process"

export interface CLIResult {
	exitCode: number
	stdout: string
	stderr: string
}

export class TestHelpers {
	/**
	 * Create a temporary workspace directory for testing
	 */
	static async createTempWorkspace(): Promise<string> {
		const tempDir = path.join(os.tmpdir(), `roo-cli-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
		await fs.mkdir(tempDir, { recursive: true })
		return tempDir
	}

	/**
	 * Clean up a temporary workspace directory
	 */
	static async cleanupTempWorkspace(workspace: string): Promise<void> {
		try {
			await fs.rm(workspace, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors in tests
			console.warn(`Warning: Could not clean up workspace ${workspace}:`, error)
		}
	}

	/**
	 * Run a CLI command and return the result
	 */
	static async runCLICommand(
		args: string[],
		options: {
			cwd?: string
			timeout?: number
			input?: string
			env?: Record<string, string>
		} = {},
	): Promise<CLIResult> {
		const { cwd = process.cwd(), timeout = 10000, input, env = {} } = options

		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				child.kill("SIGTERM")
				reject(new Error(`Command timed out after ${timeout}ms`))
			}, timeout)

			const child = spawn("node", [path.resolve(__dirname, "../../index.js"), ...args], {
				stdio: "pipe",
				cwd,
				env: { ...process.env, ...env },
			})

			let stdout = ""
			let stderr = ""

			child.stdout?.on("data", (data) => {
				stdout += data.toString()
			})

			child.stderr?.on("data", (data) => {
				stderr += data.toString()
			})

			if (input && child.stdin) {
				child.stdin.write(input)
				child.stdin.end()
			}

			child.on("close", (code) => {
				clearTimeout(timeoutId)
				resolve({
					exitCode: code || 0,
					stdout: stdout.trim(),
					stderr: stderr.trim(),
				})
			})

			child.on("error", (error) => {
				clearTimeout(timeoutId)
				reject(error)
			})
		})
	}

	/**
	 * Create a large test file for performance testing
	 */
	static async createLargeTestFile(size: number, filePath?: string): Promise<string> {
		const targetPath = filePath || path.join(os.tmpdir(), `large-test-${Date.now()}.txt`)
		const writeStream = (await import("fs")).createWriteStream(targetPath)

		const chunkSize = 1024
		const chunks = Math.ceil(size / chunkSize)

		return new Promise((resolve, reject) => {
			let written = 0

			const writeChunk = () => {
				if (written >= chunks) {
					writeStream.end()
					resolve(targetPath)
					return
				}

				const remainingSize = size - written * chunkSize
				const currentChunkSize = Math.min(chunkSize, remainingSize)
				const chunk = "x".repeat(currentChunkSize) + "\n"

				writeStream.write(chunk, (error) => {
					if (error) {
						reject(error)
						return
					}
					written++
					setImmediate(writeChunk)
				})
			}

			writeChunk()
		})
	}

	/**
	 * Create a test project structure
	 */
	static async createTestProject(workspace: string, template: "simple" | "react" | "node" = "simple"): Promise<void> {
		const templates = {
			simple: {
				"package.json": JSON.stringify(
					{
						name: "test-project",
						version: "1.0.0",
						description: "Test project",
						main: "index.js",
					},
					null,
					2,
				),
				"index.js": 'console.log("Hello, World!");',
				"README.md": "# Test Project\n\nThis is a test project.",
			},
			react: {
				"package.json": JSON.stringify(
					{
						name: "test-react-app",
						version: "1.0.0",
						dependencies: {
							react: "^18.0.0",
							"react-dom": "^18.0.0",
						},
					},
					null,
					2,
				),
				"src/App.jsx": "export default function App() { return <div>Hello React</div>; }",
				"src/index.js": 'import React from "react"; import ReactDOM from "react-dom";',
				"public/index.html":
					'<!DOCTYPE html><html><head><title>Test App</title></head><body><div id="root"></div></body></html>',
			},
			node: {
				"package.json": JSON.stringify(
					{
						name: "test-node-app",
						version: "1.0.0",
						main: "server.js",
						scripts: {
							start: "node server.js",
							test: "jest",
						},
					},
					null,
					2,
				),
				"server.js": 'const http = require("http"); const server = http.createServer(); server.listen(3000);',
				"lib/utils.js": "module.exports = { add: (a, b) => a + b };",
			},
		}

		const files = templates[template]
		for (const [filePath, content] of Object.entries(files)) {
			const fullPath = path.join(workspace, filePath)
			await fs.mkdir(path.dirname(fullPath), { recursive: true })
			await fs.writeFile(fullPath, content, "utf8")
		}
	}

	/**
	 * Wait for a condition to be met
	 */
	static async waitFor(
		condition: () => Promise<boolean> | boolean,
		timeout: number = 5000,
		interval: number = 100,
	): Promise<void> {
		const startTime = Date.now()

		while (Date.now() - startTime < timeout) {
			if (await condition()) {
				return
			}
			await new Promise((resolve) => setTimeout(resolve, interval))
		}

		throw new Error(`Condition not met within ${timeout}ms`)
	}

	/**
	 * Mock user input for interactive prompts
	 */
	static mockUserInput(inputs: string[]): string {
		return inputs.join("\n") + "\n"
	}

	/**
	 * Measure execution time
	 */
	static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
		const startTime = Date.now()
		const result = await fn()
		const duration = Date.now() - startTime
		return { result, duration }
	}

	/**
	 * Get memory usage snapshot
	 */
	static getMemoryUsage(): NodeJS.MemoryUsage {
		return process.memoryUsage()
	}

	/**
	 * Create a mock configuration file
	 */
	static async createMockConfig(workspace: string, config: Record<string, any>): Promise<string> {
		const configPath = path.join(workspace, ".roo-cli.json")
		await fs.writeFile(configPath, JSON.stringify(config, null, 2))
		return configPath
	}

	/**
	 * Simulate file system errors
	 */
	static async simulateFileSystemError(filePath: string, errorType: "ENOENT" | "EACCES" | "EMFILE"): Promise<void> {
		const mockError = new Error(`Mock ${errorType} error`) as any
		mockError.code = errorType

		// This would typically be used with jest.spyOn to mock fs operations
		throw mockError
	}

	/**
	 * Create a test session file
	 */
	static async createTestSession(workspace: string, sessionData: any): Promise<string> {
		const sessionPath = path.join(workspace, ".roo-sessions", "test-session.json")
		await fs.mkdir(path.dirname(sessionPath), { recursive: true })
		await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2))
		return sessionPath
	}

	/**
	 * Validate CLI output format
	 */
	static validateOutputFormat(output: string, format: "json" | "yaml" | "table" | "plain"): boolean {
		try {
			switch (format) {
				case "json":
					JSON.parse(output)
					return true
				case "yaml":
					// Basic YAML validation - should start with --- or contain key: value pairs
					return /^---\s|\w+:\s/.test(output.trim())
				case "table":
					// Check for table-like structure with borders
					return /[┌┐└┘│─┼┤├┬┴]/.test(output) || /\|.*\|/.test(output)
				case "plain":
					// Plain text should not contain special formatting characters
					return !/[┌┐└┘│─┼┤├┬┴]/.test(output) && !output.startsWith("{")
				default:
					return false
			}
		} catch {
			return false
		}
	}

	/**
	 * Generate test data for performance testing
	 */
	static generateTestData(size: "small" | "medium" | "large"): any {
		const sizes = {
			small: 100,
			medium: 1000,
			large: 10000,
		}

		const count = sizes[size]
		return Array.from({ length: count }, (_, i) => ({
			id: i,
			name: `Item ${i}`,
			value: Math.random() * 1000,
			timestamp: new Date().toISOString(),
			metadata: {
				tags: [`tag${i % 10}`, `category${i % 5}`],
				description: `This is test item number ${i}`.repeat(Math.floor(Math.random() * 3) + 1),
			},
		}))
	}
}

export default TestHelpers
