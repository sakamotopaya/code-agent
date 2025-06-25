// Mock implementation of chalk for Jest tests
const chalk = {
	gray: (text) => `\u001b[90m${text}\u001b[0m`,
	yellow: (text) => `\u001b[93m${text}\u001b[0m`,
	blue: (text) => `\u001b[94m${text}\u001b[0m`,
	red: (text) => `\u001b[91m${text}\u001b[0m`,
	green: (text) => `\u001b[92m${text}\u001b[0m`,
	white: (text) => `\u001b[97m${text}\u001b[0m`,
	black: (text) => `\u001b[30m${text}\u001b[0m`,
	cyan: (text) => `\u001b[96m${text}\u001b[0m`,
	magenta: (text) => `\u001b[95m${text}\u001b[0m`,
}

module.exports = chalk
module.exports.default = chalk
