import { Page } from "puppeteer-core"
import {
	ExtractedContent,
	LinkData,
	ImageData,
	FormData,
	FormField,
	PageMetadata,
	SocialMediaMetadata,
	ExtractedTable,
	ExtractedList,
	ContentExtractionOptions,
} from "../types/extraction-types"

export class ContentExtractor {
	async extract(page: Page, options: ContentExtractionOptions): Promise<ExtractedContent> {
		const [title, text, links, images, forms, metadata] = await Promise.all([
			this.extractTitle(page),
			this.extractText(page, options),
			options.includeLinks ? this.extractLinks(page) : [],
			options.includeImages ? this.extractImages(page) : [],
			options.includeForms ? this.extractForms(page) : [],
			this.extractMetadata(page),
		])

		return {
			title,
			text,
			links,
			images,
			forms,
			metadata,
		}
	}

	private async extractTitle(page: Page): Promise<string> {
		try {
			return await page.title()
		} catch (error) {
			return ""
		}
	}

	private async extractText(page: Page, options: ContentExtractionOptions): Promise<string> {
		try {
			let text: string

			if (options.selectors && options.selectors.length > 0) {
				// Extract text from specific selectors
				const textParts: string[] = []
				for (const selector of options.selectors) {
					const elements = await page.$$(selector)
					for (const element of elements) {
						const elementText = await element.evaluate((el) => el.textContent || "")
						if (elementText.trim()) {
							textParts.push(elementText.trim())
						}
					}
				}
				text = textParts.join("\n\n")
			} else {
				// Extract all text from body
				text = await page.evaluate(() => {
					// Remove script and style content
					const scripts = document.querySelectorAll("script, style")
					scripts.forEach((script) => script.remove())

					return document.body?.textContent || ""
				})
			}

			// Apply max length if specified
			if (options.maxTextLength && text.length > options.maxTextLength) {
				text = text.substring(0, options.maxTextLength) + "..."
			}

			return text.trim()
		} catch (error) {
			return ""
		}
	}

	private async extractLinks(page: Page): Promise<LinkData[]> {
		try {
			return await page.evaluate(() => {
				const links = Array.from(document.querySelectorAll("a[href]"))
				return links
					.map((link) => ({
						text: link.textContent?.trim() || "",
						href: link.getAttribute("href") || "",
						title: link.getAttribute("title") || undefined,
					}))
					.filter((link) => link.href)
			})
		} catch (error) {
			return []
		}
	}

	private async extractImages(page: Page): Promise<ImageData[]> {
		try {
			return await page.evaluate(() => {
				const images = Array.from(document.querySelectorAll("img[src]"))
				return images
					.map((img) => ({
						src: img.getAttribute("src") || "",
						alt: img.getAttribute("alt") || undefined,
						title: img.getAttribute("title") || undefined,
						dimensions: {
							width: (img as HTMLImageElement).naturalWidth || 0,
							height: (img as HTMLImageElement).naturalHeight || 0,
						},
					}))
					.filter((img) => img.src)
			})
		} catch (error) {
			return []
		}
	}

	private async extractForms(page: Page): Promise<FormData[]> {
		try {
			return await page.evaluate(() => {
				const forms = Array.from(document.querySelectorAll("form"))
				return forms.map((form) => {
					const fields: FormField[] = []

					// Extract input fields
					const inputs = form.querySelectorAll("input, textarea, select")
					inputs.forEach((input) => {
						const field: FormField = {
							name: input.getAttribute("name") || "",
							type: input.getAttribute("type") || input.tagName.toLowerCase(),
							value: (input as HTMLInputElement).value || undefined,
							required: input.hasAttribute("required"),
							placeholder: input.getAttribute("placeholder") || undefined,
						}

						// Handle select options
						if (input.tagName.toLowerCase() === "select") {
							const options = Array.from(input.querySelectorAll("option"))
							field.options = options.map((opt) => opt.textContent || "")
						}

						if (field.name) {
							fields.push(field)
						}
					})

					return {
						id: form.getAttribute("id") || undefined,
						name: form.getAttribute("name") || undefined,
						action: form.getAttribute("action") || undefined,
						method: form.getAttribute("method") || "get",
						fields,
					}
				})
			})
		} catch (error) {
			return []
		}
	}

	private async extractMetadata(page: Page): Promise<PageMetadata> {
		try {
			const metadata = await page.evaluate(() => {
				const getMetaContent = (name: string): string | undefined => {
					const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)
					return meta?.getAttribute("content") || undefined
				}

				const socialMedia: SocialMediaMetadata = {
					ogTitle: getMetaContent("og:title"),
					ogDescription: getMetaContent("og:description"),
					ogImage: getMetaContent("og:image"),
					ogUrl: getMetaContent("og:url"),
					twitterCard: getMetaContent("twitter:card"),
					twitterTitle: getMetaContent("twitter:title"),
					twitterDescription: getMetaContent("twitter:description"),
					twitterImage: getMetaContent("twitter:image"),
				}

				return {
					url: window.location.href,
					title: document.title,
					description: getMetaContent("description"),
					keywords: getMetaContent("keywords")
						?.split(",")
						.map((k) => k.trim()),
					author: getMetaContent("author"),
					viewport: getMetaContent("viewport"),
					charset: document.characterSet,
					language: document.documentElement.lang || undefined,
					socialMedia,
					timestamp: new Date().toISOString(),
				}
			})

			return metadata
		} catch (error) {
			return {
				url: page.url(),
				title: "",
				timestamp: new Date().toISOString(),
			}
		}
	}

	async extractTables(page: Page): Promise<ExtractedTable[]> {
		try {
			return await page.evaluate(() => {
				const tables = Array.from(document.querySelectorAll("table"))
				return tables
					.map((table) => {
						const headers: string[] = []
						const rows: string[][] = []

						// Extract headers
						const headerRow = table.querySelector("thead tr, tr:first-child")
						if (headerRow) {
							const headerCells = headerRow.querySelectorAll("th, td")
							headerCells.forEach((cell) => {
								headers.push(cell.textContent?.trim() || "")
							})
						}

						// Extract rows
						const bodyRows = table.querySelectorAll("tbody tr, tr:not(:first-child)")
						bodyRows.forEach((row) => {
							const cells = row.querySelectorAll("td, th")
							const rowData: string[] = []
							cells.forEach((cell) => {
								rowData.push(cell.textContent?.trim() || "")
							})
							if (rowData.length > 0) {
								rows.push(rowData)
							}
						})

						return { headers, rows }
					})
					.filter((table) => table.headers.length > 0 || table.rows.length > 0)
			})
		} catch (error) {
			return []
		}
	}

	async extractLists(page: Page): Promise<ExtractedList[]> {
		try {
			return await page.evaluate(() => {
				const lists = Array.from(document.querySelectorAll("ul, ol"))
				return lists
					.map((list) => {
						const items = Array.from(list.querySelectorAll("li"))
						return {
							type: list.tagName.toLowerCase() === "ol" ? ("ordered" as const) : ("unordered" as const),
							items: items.map((item) => item.textContent?.trim() || "").filter((item) => item),
						}
					})
					.filter((list) => list.items.length > 0)
			})
		} catch (error) {
			return []
		}
	}
}
