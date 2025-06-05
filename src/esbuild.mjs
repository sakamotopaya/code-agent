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
			"@roo-code/telemetry": path.resolve(__dirname, "cli/__mocks__/@roo-code/telemetry.js")
		},
		external: [
			"@roo-code/telemetry"
		],
		define: {
			'process.env.VSCODE_CONTEXT': 'false'
		}
	}

	const [extensionCtx, workerCtx, cliCtx] = await Promise.all([
		esbuild.context(extensionConfig),
		esbuild.context(workerConfig),
		esbuild.context(cliConfig),
	])

	if (watch) {
		await Promise.all([extensionCtx.watch(), workerCtx.watch(), cliCtx.watch()])
		copyLocales(srcDir, distDir)
		setupLocaleWatcher(srcDir, distDir)
	} else {
		await Promise.all([extensionCtx.rebuild(), workerCtx.rebuild(), cliCtx.rebuild()])
		
		// Make CLI executable
		const cliPath = path.join(distDir, "cli", "index.js")
		if (fs.existsSync(cliPath)) {
			fs.chmodSync(cliPath, 0o755)
		}
		
		await Promise.all([extensionCtx.dispose(), workerCtx.dispose(), cliCtx.dispose()])
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
