// Test file for search and replace functionality
function debugOutput(message) {
	console.log(`[DEBUG] ${message}`)
}

function errorOutput(error) {
	console.log(`[ERROR] ${error}`)
}

function infoOutput(info) {
	console.log(`[INFO] ${info}`)
}

class Logger {
	debug(msg) {
		console.log(`Debug: ${msg}`)
	}

	info(msg) {
		console.log(`Info: ${msg}`)
	}

	error(msg) {
		console.log(`Error: ${msg}`)
	}
}

const logger = new Logger()
console.log("Test file created successfully")
