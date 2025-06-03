export interface ISpinner {
	start(): void
	stop(): void
	succeed(message?: string): void
	fail(message?: string): void
	warn(message?: string): void
	info(message?: string): void
	text: string
}

export interface IProgressBar {
	increment(value?: number): void
	update(current: number): void
	stop(): void
	total: number
	current: number
}

export type ChalkColor =
	| "black"
	| "red"
	| "green"
	| "yellow"
	| "blue"
	| "magenta"
	| "cyan"
	| "white"
	| "gray"
	| "redBright"
	| "greenBright"
	| "yellowBright"
	| "blueBright"
	| "magentaBright"
	| "cyanBright"
	| "whiteBright"

export interface ColorScheme {
	success: ChalkColor
	warning: ChalkColor
	error: ChalkColor
	info: ChalkColor
	highlight: ChalkColor
	muted: ChalkColor
	primary: ChalkColor
}

export const DEFAULT_COLOR_SCHEME: ColorScheme = {
	success: "green",
	warning: "yellow",
	error: "red",
	info: "blue",
	highlight: "cyan",
	muted: "gray",
	primary: "white",
}

export const DARK_COLOR_SCHEME: ColorScheme = {
	success: "greenBright",
	warning: "yellowBright",
	error: "redBright",
	info: "blueBright",
	highlight: "cyanBright",
	muted: "gray",
	primary: "white",
}

export const LIGHT_COLOR_SCHEME: ColorScheme = {
	success: "green",
	warning: "yellow",
	error: "red",
	info: "blue",
	highlight: "cyan",
	muted: "gray",
	primary: "black",
}

export const HIGH_CONTRAST_COLOR_SCHEME: ColorScheme = {
	success: "greenBright",
	warning: "yellowBright",
	error: "redBright",
	info: "blueBright",
	highlight: "whiteBright",
	muted: "gray",
	primary: "whiteBright",
}

export const MINIMAL_COLOR_SCHEME: ColorScheme = {
	success: "white",
	warning: "white",
	error: "white",
	info: "white",
	highlight: "white",
	muted: "gray",
	primary: "white",
}

export const PREDEFINED_COLOR_SCHEMES: Record<string, ColorScheme> = {
	default: DEFAULT_COLOR_SCHEME,
	dark: DARK_COLOR_SCHEME,
	light: LIGHT_COLOR_SCHEME,
	"high-contrast": HIGH_CONTRAST_COLOR_SCHEME,
	minimal: MINIMAL_COLOR_SCHEME,
}

export interface BoxOptions {
	title?: string
	padding?: number
	margin?: number
	borderStyle?: "single" | "double" | "round" | "bold" | "singleDouble" | "doubleSingle" | "classic"
	borderColor?: ChalkColor
	backgroundColor?: ChalkColor
	textAlignment?: "left" | "center" | "right"
	width?: number
	float?: "left" | "right" | "center"
}

export interface TableColumn {
	header: string
	key: string
	width?: number
	alignment?: "left" | "center" | "right"
}

export interface TableOptions {
	head?: string[]
	colWidths?: number[]
	style?: {
		"padding-left"?: number
		"padding-right"?: number
		head?: ChalkColor[]
		border?: ChalkColor[]
		compact?: boolean
	}
	chars?: {
		top?: string
		"top-mid"?: string
		"top-left"?: string
		"top-right"?: string
		bottom?: string
		"bottom-mid"?: string
		"bottom-left"?: string
		"bottom-right"?: string
		left?: string
		"left-mid"?: string
		mid?: string
		"mid-mid"?: string
		right?: string
		"right-mid"?: string
		middle?: string
	}
}

export type TableData = Array<Record<string, any>> | Array<Array<string | number>>

export interface ProgressOptions {
	total: number
	message?: string
	format?: string
	clear?: boolean
	stream?: NodeJS.WriteStream
}