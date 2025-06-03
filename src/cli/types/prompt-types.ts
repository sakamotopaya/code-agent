export interface Choice {
	name: string
	value: string
	short?: string
	disabled?: boolean | string
	checked?: boolean
}

export interface PromptOptions {
	message: string
	name?: string
	default?: any
	validate?: (input: any) => boolean | string | Promise<boolean | string>
	filter?: (input: any) => any
	transformer?: (input: any, answers: any, flags: any) => string
	when?: (answers: any) => boolean | Promise<boolean>
}

export interface TextPromptOptions extends PromptOptions {
	default?: string
}

export interface PasswordPromptOptions extends PromptOptions {
	mask?: string
	default?: string
}

export interface ConfirmPromptOptions extends PromptOptions {
	default?: boolean
}

export interface SelectPromptOptions extends PromptOptions {
	choices: Choice[]
	default?: string | number
	pageSize?: number
}

export interface MultiSelectPromptOptions extends PromptOptions {
	choices: Choice[]
	default?: string[]
	pageSize?: number
	validate?: (input: string[]) => boolean | string | Promise<boolean | string>
}

export interface NumberPromptOptions extends PromptOptions {
	default?: number
	min?: number
	max?: number
}

export interface ListPromptOptions extends PromptOptions {
	choices: Choice[]
	default?: string
	pageSize?: number
}

export interface CheckboxPromptOptions extends PromptOptions {
	choices: Choice[]
	default?: string[]
	pageSize?: number
	validate?: (input: string[]) => boolean | string | Promise<boolean | string>
}

export interface EditorPromptOptions extends PromptOptions {
	default?: string
	postfix?: string
}

export type PromptType =
	| "input"
	| "password"
	| "confirm"
	| "list"
	| "rawlist"
	| "expand"
	| "checkbox"
	| "editor"
	| "number"

export interface BasePrompt {
	type: PromptType
	name: string
	message: string
	default?: any
	choices?: Choice[]
	validate?: (input: any) => boolean | string | Promise<boolean | string>
	filter?: (input: any) => any
	transformer?: (input: any, answers: any, flags: any) => string
	when?: (answers: any) => boolean | Promise<boolean>
	pageSize?: number
	prefix?: string
	suffix?: string
	askAnswered?: boolean
	loop?: boolean
}

export interface PromptResult<T = any> {
	[key: string]: T
}
