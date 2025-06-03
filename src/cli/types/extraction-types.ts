export interface ExtractedContent {
	title: string
	text: string
	links: LinkData[]
	images: ImageData[]
	forms: FormData[]
	metadata: PageMetadata
}

export interface LinkData {
	text: string
	href: string
	title?: string
}

export interface ImageData {
	src: string
	alt?: string
	title?: string
	dimensions?: {
		width: number
		height: number
	}
}

export interface FormData {
	id?: string
	name?: string
	action?: string
	method?: string
	fields: FormField[]
}

export interface FormField {
	name: string
	type: string
	value?: string
	required: boolean
	placeholder?: string
	options?: string[] // for select fields
}

export interface PageMetadata {
	url: string
	title: string
	description?: string
	keywords?: string[]
	author?: string
	viewport?: string
	charset?: string
	language?: string
	socialMedia?: SocialMediaMetadata
	timestamp: string
}

export interface SocialMediaMetadata {
	ogTitle?: string
	ogDescription?: string
	ogImage?: string
	ogUrl?: string
	twitterCard?: string
	twitterTitle?: string
	twitterDescription?: string
	twitterImage?: string
}

export interface ExtractedTable {
	headers: string[]
	rows: string[][]
}

export interface ExtractedList {
	type: "ordered" | "unordered"
	items: string[]
}

export interface ContentExtractionOptions {
	includeImages: boolean
	includeLinks: boolean
	includeForms: boolean
	includeTables: boolean
	includeLists: boolean
	maxTextLength?: number
	selectors?: string[]
}
