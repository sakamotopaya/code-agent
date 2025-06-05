#!/usr/bin/env node
/**
 * Performance benchmark script for CLI optimizations
 */

const { performance } = require("perf_hooks")
const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")

async function runBenchmark() {
	console.log("🚀 CLI Performance Benchmark")
	console.log("=" * 50)

	const results = {
		coldStart: [],
		warmStart: [],
		memory: [],
		commands: [],
	}

	// Test cold start performance
	console.log("\n📊 Testing cold start performance...")
	for (let i = 0; i < 3; i++) {
		const startTime = performance.now()

		try {
			await runCLICommand(["--help"], { timeout: 10000 })
			const duration = performance.now() - startTime
			results.coldStart.push(duration)
			console.log(`  Cold start ${i + 1}: ${Math.round(duration)}ms`)
		} catch (error) {
			console.log(`  Cold start ${i + 1}: FAILED (${error.message})`)
		}
	}

	// Test warm start performance (multiple quick commands)
	console.log("\n🔥 Testing warm start performance...")
	for (let i = 0; i < 5; i++) {
		const startTime = performance.now()

		try {
			await runCLICommand(["version"], { timeout: 5000 })
			const duration = performance.now() - startTime
			results.warmStart.push(duration)
			console.log(`  Warm start ${i + 1}: ${Math.round(duration)}ms`)
		} catch (error) {
			console.log(`  Warm start ${i + 1}: FAILED (${error.message})`)
		}
	}

	// Test memory usage with verbose output
	console.log("\n💾 Testing memory usage...")
	try {
		const memoryResult = await runCLICommand(["--verbose", "config", "--show"], {
			timeout: 10000,
			captureOutput: true,
		})

		if (memoryResult.stdout) {
			const memoryMatch = memoryResult.stdout.match(/(\d+)ms/)
			if (memoryMatch) {
				results.memory.push(parseInt(memoryMatch[1]))
				console.log(`  Memory test: ${memoryMatch[1]}ms`)
			}
		}
	} catch (error) {
		console.log(`  Memory test: FAILED (${error.message})`)
	}

	// Test various commands
	console.log("\n⚡ Testing command performance...")
	const commands = [["help"], ["version", "--json"], ["config", "--show"]]

	for (const command of commands) {
		const startTime = performance.now()

		try {
			await runCLICommand(command, { timeout: 5000 })
			const duration = performance.now() - startTime
			results.commands.push({ command: command.join(" "), duration })
			console.log(`  ${command.join(" ")}: ${Math.round(duration)}ms`)
		} catch (error) {
			console.log(`  ${command.join(" ")}: FAILED (${error.message})`)
		}
	}

	// Generate report
	console.log("\n📈 Performance Report")
	console.log("=" * 50)

	if (results.coldStart.length > 0) {
		const avgColdStart = results.coldStart.reduce((a, b) => a + b, 0) / results.coldStart.length
		const target = 2000 // 2 seconds target
		const status = avgColdStart < target ? "✅ PASS" : "❌ FAIL"
		console.log(`Cold Start Average: ${Math.round(avgColdStart)}ms (target: <${target}ms) ${status}`)
	}

	if (results.warmStart.length > 0) {
		const avgWarmStart = results.warmStart.reduce((a, b) => a + b, 0) / results.warmStart.length
		const improvement =
			results.coldStart.length > 0 ? ((results.coldStart[0] - avgWarmStart) / results.coldStart[0]) * 100 : 0
		console.log(`Warm Start Average: ${Math.round(avgWarmStart)}ms (improvement: ${Math.round(improvement)}%)`)
	}

	if (results.commands.length > 0) {
		const avgCommand = results.commands.reduce((a, b) => a + b.duration, 0) / results.commands.length
		const target = 1000 // 1 second target
		const status = avgCommand < target ? "✅ PASS" : "❌ FAIL"
		console.log(`Command Average: ${Math.round(avgCommand)}ms (target: <${target}ms) ${status}`)
	}

	// Performance recommendations
	console.log("\n💡 Recommendations:")
	if (results.coldStart.length > 0 && results.coldStart[0] > 2000) {
		console.log("  • Consider enabling aggressive startup optimization")
		console.log("  • Check for unnecessary module loading during startup")
	}

	if (results.warmStart.length > 0 && results.warmStart.some((t) => t > 500)) {
		console.log("  • Cache performance could be improved")
		console.log("  • Consider increasing cache sizes")
	}

	console.log("\n✨ Benchmark completed!")
}

function runCLICommand(args, options = {}) {
	return new Promise((resolve, reject) => {
		const { timeout = 5000, captureOutput = false } = options

		// Use the compiled CLI if available, otherwise use npm run
		const cliPath = path.join(__dirname, "../../src/dist/cli/index.js")
		const useCompiledCLI = fs.existsSync(cliPath)

		const command = useCompiledCLI ? "node" : "npm"
		const commandArgs = useCompiledCLI ? [cliPath, ...args] : ["run", "cli", "--", ...args]

		const child = spawn(command, commandArgs, {
			cwd: path.join(__dirname, "../.."),
			stdio: captureOutput ? ["pipe", "pipe", "pipe"] : ["pipe", "inherit", "inherit"],
		})

		let stdout = ""
		let stderr = ""

		if (captureOutput) {
			child.stdout?.on("data", (data) => {
				stdout += data.toString()
			})

			child.stderr?.on("data", (data) => {
				stderr += data.toString()
			})
		}

		const timeoutHandle = setTimeout(() => {
			child.kill("SIGTERM")
			reject(new Error("Command timeout"))
		}, timeout)

		child.on("close", (code) => {
			clearTimeout(timeoutHandle)

			if (code === 0) {
				resolve({ stdout, stderr, code })
			} else {
				reject(new Error(`Command failed with code ${code}`))
			}
		})

		child.on("error", (error) => {
			clearTimeout(timeoutHandle)
			reject(error)
		})
	})
}

// Run benchmark if this script is executed directly
if (require.main === module) {
	runBenchmark().catch((error) => {
		console.error("Benchmark failed:", error)
		process.exit(1)
	})
}

module.exports = { runBenchmark }
