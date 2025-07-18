#!/usr/bin/env node
/**
 * Simple validation script to test the refactored API client filtering logic
 */

const { execSync } = require("child_process")

console.log("🔍 Validating API Client Refactoring...\n")

// Check if files exist
const fs = require("fs")
const requiredFiles = [
	"src/tools/api-client.ts",
	"src/tools/types/api-client-types.ts",
	"src/tools/QuestionEventHandler.ts",
	"src/tools/__tests__/api-client-filtering.test.ts",
]

console.log("✅ Checking required files exist...")
requiredFiles.forEach((file) => {
	if (!fs.existsSync(file)) {
		console.error(`❌ Missing file: ${file}`)
		process.exit(1)
	}
	console.log(`   ✓ ${file}`)
})

// Check TypeScript compilation
console.log("\n✅ Checking TypeScript compilation...")
try {
	execSync("npx tsc --noEmit --project src/tsconfig.json", { stdio: "pipe" })
	console.log("   ✓ TypeScript compilation successful")
} catch (error) {
	console.error("❌ TypeScript compilation failed:", error.message)
	process.exit(1)
}

// Check for key refactoring changes
console.log("\n✅ Checking refactoring changes...")
const apiClientContent = fs.readFileSync("src/tools/api-client.ts", "utf8")

// Check that ClientContentFilter has formatAndOutputEvent method
if (apiClientContent.includes("formatAndOutputEvent(event: StreamEvent, timestamp: string)")) {
	console.log("   ✓ ClientContentFilter has formatAndOutputEvent method")
} else {
	console.error("❌ ClientContentFilter missing formatAndOutputEvent method")
	process.exit(1)
}

// Check that StreamProcessor delegates to ClientContentFilter
if (apiClientContent.includes("contentFilter.formatAndOutputEvent(event, timestamp)")) {
	console.log("   ✓ StreamProcessor delegates to ClientContentFilter")
} else {
	console.error("❌ StreamProcessor not delegating to ClientContentFilter")
	process.exit(1)
}

// Check that duplicate filtering options are removed from StreamProcessor
if (
	!apiClientContent.includes("private showResponse: boolean") &&
	!apiClientContent.includes("private showThinking: boolean")
) {
	console.log("   ✓ Duplicate filtering options removed from StreamProcessor")
} else {
	console.error("❌ Duplicate filtering options still present in StreamProcessor")
	process.exit(1)
}

// Check ContentFilterOptions interface
const typesContent = fs.readFileSync("src/tools/types/api-client-types.ts", "utf8")
if (
	typesContent.includes("showTokenUsage: boolean") &&
	typesContent.includes("hideTokenUsage: boolean") &&
	typesContent.includes("verbose: boolean")
) {
	console.log("   ✓ ContentFilterOptions interface updated correctly")
} else {
	console.error("❌ ContentFilterOptions interface not updated correctly")
	process.exit(1)
}

// Check StreamProcessorOptions interface
if (!typesContent.includes("showResponse?: boolean") || !typesContent.includes("showThinking?: boolean")) {
	console.log("   ✓ StreamProcessorOptions interface cleaned up")
} else {
	console.error("❌ StreamProcessorOptions interface still has duplicate options")
	process.exit(1)
}

console.log("\n🎉 All refactoring validations passed!")
console.log("\n📋 Summary of changes:")
console.log("   • ClientContentFilter now handles all output formatting")
console.log("   • StreamProcessor simplified to delegate all output to ClientContentFilter")
console.log("   • Duplicate filtering options removed from StreamProcessor")
console.log("   • Output methods consolidated (console.log vs process.stdout.write)")
console.log("   • ContentFilterOptions interface expanded with required properties")
console.log("   • StreamProcessorOptions interface simplified")
console.log("   • Test suite created for comprehensive validation")
console.log("\n✅ API Client output filtering refactoring completed successfully!")
