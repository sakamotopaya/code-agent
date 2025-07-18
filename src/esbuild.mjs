import * as esbuild from "esbuild"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import process from "node:process"
import * as console from "node:console"

import { copyPaths, copyWasms, copyLocales, setupLocaleWatcher } from "@roo-code/build"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
	const name = "extension"
	const production = process.argv.includes("--production")
	const watch = process.argv.includes("--watch")
	const minify = production
	const sourcemap = !production

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const buildOptions = {
		bundle: true,
		minify,
		sourcemap,
		logLevel: "silent",
		format: "cjs",
		sourcesContent: false,
		platform: "node",
	}

	const srcDir = __dirname
	const buildDir = __dirname
	const distDir = path.join(buildDir, "dist")

	if (fs.existsSync(distDir)) {
		console.log(`[${name}] Cleaning dist directory: ${distDir}`)
		fs.rmSync(distDir, { recursive: true, force: true })
	}

	/**
	 * @type {import('esbuild').Plugin[]}
	 */
	const plugins = [
		{
			name: "copyFiles",
			setup(build) {
				build.onEnd(() => {
					copyPaths(
						[
							["../README.md", "README.md"],
							["../CHANGELOG.md", "CHANGELOG.md"],
							["../LICENSE", "LICENSE"],
							["../.env", ".env", { optional: true }],
							["node_modules/vscode-material-icons/generated", "assets/vscode-material-icons"],
							["../webview-ui/audio", "webview-ui/audio"],
						],
						srcDir,
						buildDir,
					)
				})
			},
		},
		{
			name: "copyWasms",
			setup(build) {
				build.onEnd(() => copyWasms(srcDir, distDir))
			},
		},
		{
			name: "copyLocales",
			setup(build) {
				build.onEnd(() => copyLocales(srcDir, distDir))
			},
		},
		{
			name: "esbuild-problem-matcher",
			setup(build) {
				build.onStart(() => console.log("[esbuild-problem-matcher#onStart]"))
				build.onEnd((result) => {
					result.errors.forEach(({ text, location }) => {
						console.error(`✘ [ERROR] ${text}`)
						console.error(`    ${location.file}:${location.line}:${location.column}:`)
					})

					console.log("[esbuild-problem-matcher#onEnd]")
				})
			},
		},
	]

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const extensionConfig = {
		...buildOptions,
		plugins,
		entryPoints: ["extension.ts"],
		outfile: "dist/extension.js",
		external: ["vscode"],
	}

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const workerConfig = {
		...buildOptions,
		entryPoints: ["workers/countTokens.ts"],
		outdir: "dist/workers",
	}

	/**
	 * CLI-specific plugins for PKG optimization
	 * @type {import('esbuild').Plugin[]}
	 */
	const cliPlugins = [
		{
			name: "pkg-optimization",
			setup(build) {
				// Help PKG understand dynamic imports
				build.onResolve({ filter: /^\./ }, (args) => {
					if (args.importer && args.path.includes('__mocks__')) {
						return null // Let esbuild handle mock resolution normally
					}
					return null
				})
			}
		}
	]

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const cliConfig = {
		...buildOptions,
		entryPoints: ["cli/cli-entry.ts"],
		outfile: "dist/cli/index.js",
		banner: {
			js: '#!/usr/bin/env node'
		},
		alias: {
			"vscode": path.resolve(__dirname, "cli/__mocks__/vscode.js"),
			"@roo-code/telemetry": path.resolve(__dirname, "cli/__mocks__/@roo-code/telemetry.js"),
			"tiktoken/lite": path.resolve(__dirname, "cli/__mocks__/tiktoken.js"),
			"tiktoken/encoders/o200k_base": path.resolve(__dirname, "cli/__mocks__/tiktoken.js")
		},
		external: [
			// Only keep truly external dependencies that can't be bundled
		],
		define: {
			'process.env.VSCODE_CONTEXT': 'false',
			'process.env.PKG_EXECUTABLE': process.argv.includes('--pkg') ? 'true' : 'false'
		},
		// Optimize for PKG bundling
		treeShaking: true,
		keepNames: true,
		plugins: cliPlugins
	}

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const apiConfig = {
		...buildOptions,
		entryPoints: ["api/api-entry.ts"],
		outfile: "dist/api/api-entry.js",
		alias: {
			"vscode": path.resolve(__dirname, "cli/__mocks__/vscode.js"),
			"@roo-code/telemetry": path.resolve(__dirname, "cli/__mocks__/@roo-code/telemetry.js"),
			"tiktoken/lite": path.resolve(__dirname, "cli/__mocks__/tiktoken.js"),
			"tiktoken/encoders/o200k_base": path.resolve(__dirname, "cli/__mocks__/tiktoken.js")
		},
		external: [
			// Only keep truly external dependencies that can't be bundled
			"pino-pretty"
		],
		define: {
			'process.env.VSCODE_CONTEXT': 'false',
		},
		treeShaking: true,
		keepNames: true,
	}

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const apiClientConfig = {
		...buildOptions,
		entryPoints: ["tools/api-client.ts"],
		outfile: "dist/tools/api-client.js",
		banner: {
			js: '#!/usr/bin/env node'
		},
		alias: {
			"vscode": path.resolve(__dirname, "cli/__mocks__/vscode.js"),
			"@roo-code/telemetry": path.resolve(__dirname, "cli/__mocks__/@roo-code/telemetry.js"),
			"tiktoken/lite": path.resolve(__dirname, "cli/__mocks__/tiktoken.js"),
			"tiktoken/encoders/o200k_base": path.resolve(__dirname, "cli/__mocks__/tiktoken.js")
		},
		external: [
			// Keep Node.js built-ins external
			"http",
			"https",
			"readline",
			"path",
			"os",
			"fs"
		],
		define: {
			'process.env.VSCODE_CONTEXT': 'false',
		},
		treeShaking: true,
		keepNames: true,
	}

	const [extensionCtx, workerCtx, cliCtx, apiCtx, apiClientCtx] = await Promise.all([
		esbuild.context(extensionConfig),
		esbuild.context(workerConfig),
		esbuild.context(cliConfig),
		esbuild.context(apiConfig),
		esbuild.context(apiClientConfig),
	])

	if (watch) {
		await Promise.all([extensionCtx.watch(), workerCtx.watch(), cliCtx.watch(), apiCtx.watch(), apiClientCtx.watch()])
		copyLocales(srcDir, distDir)
		setupLocaleWatcher(srcDir, distDir)
	} else {
		await Promise.all([extensionCtx.rebuild(), workerCtx.rebuild(), cliCtx.rebuild(), apiCtx.rebuild(), apiClientCtx.rebuild()])
		
		// Make CLI executable
		const cliPath = path.join(distDir, "cli", "index.js")
		if (fs.existsSync(cliPath)) {
			fs.chmodSync(cliPath, 0o755)
		}
		
		// Make API client executable
		const apiClientPath = path.join(distDir, "tools", "api-client.js")
		if (fs.existsSync(apiClientPath)) {
			fs.chmodSync(apiClientPath, 0o755)
		}
		
		await Promise.all([extensionCtx.dispose(), workerCtx.dispose(), cliCtx.dispose(), apiCtx.dispose(), apiClientCtx.dispose()])
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
