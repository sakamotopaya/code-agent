import chalk from "chalk"

export function showBanner(): void {
	console.log()
	console.log(chalk.cyan.bold("  _____ _____ _____       _____ _     _____ "))
	console.log(chalk.cyan.bold(" |  __ \\  _  |  _  |     /  __ \\ |   |_   _|"))
	console.log(chalk.cyan.bold(" | |  \\/ | | | | | |_____| /  \\/ |     | |  "))
	console.log(chalk.cyan.bold(" | | __| | | | | | |_____| |   | |     | |  "))
	console.log(chalk.cyan.bold(" | |_\\ \\ \\_/ \\ \\_/ /     | \\__/\\ |_____| |_ "))
	console.log(chalk.cyan.bold("  \\____/\\___/ \\___/       \\____/\\_____/\\___/ "))
	console.log()
	console.log(chalk.white.bold("  Roo Code Agent CLI"))
	console.log(chalk.gray("  Interactive coding assistant for the command line"))
	console.log()
	console.log(chalk.yellow("  Type "), chalk.white.bold("help"), chalk.yellow(" for available commands"))
	console.log(
		chalk.yellow("  Type "),
		chalk.white.bold("exit"),
		chalk.yellow(" or "),
		chalk.white.bold("quit"),
		chalk.yellow(" to leave"),
	)
	console.log(chalk.yellow("  Press "), chalk.white.bold("Ctrl+C"), chalk.yellow(" twice to force exit"))
	console.log()
}
