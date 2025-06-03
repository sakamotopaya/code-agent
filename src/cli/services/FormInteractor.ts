import { Page } from "puppeteer-core"
import { FormData, FormResult, SubmissionResult } from "../types/browser-types"

export class FormInteractor {
	async fillForm(page: Page, formData: FormData): Promise<FormResult> {
		const startTime = Date.now()
		const errors: string[] = []

		try {
			for (const [fieldName, value] of Object.entries(formData)) {
				try {
					await this.fillField(page, fieldName, value)
				} catch (error) {
					errors.push(
						`Failed to fill field "${fieldName}": ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}

			const responseTime = Date.now() - startTime
			return {
				success: errors.length === 0,
				url: page.url(),
				responseTime,
				errors: errors.length > 0 ? errors : undefined,
			}
		} catch (error) {
			const responseTime = Date.now() - startTime
			return {
				success: false,
				url: page.url(),
				responseTime,
				errors: [error instanceof Error ? error.message : String(error)],
			}
		}
	}

	async submitForm(page: Page, formSelector: string): Promise<SubmissionResult> {
		try {
			// Wait for form to be present
			await page.waitForSelector(formSelector, { timeout: 10000 })

			// Get current URL before submission
			const currentUrl = page.url()

			// Set up navigation promise before clicking submit
			const navigationPromise = page
				.waitForNavigation({
					waitUntil: "domcontentloaded",
					timeout: 30000,
				})
				.catch(() => null) // Don't fail if no navigation occurs

			// Submit the form
			await page
				.click(
					`${formSelector} input[type="submit"], ${formSelector} button[type="submit"], ${formSelector} button:not([type])`,
				)
				.catch(async () => {
					// Fallback: try to submit via form element
					await page.evaluate((selector) => {
						const form = document.querySelector(selector) as HTMLFormElement
						if (form) {
							form.submit()
						}
					}, formSelector)
				})

			// Wait for navigation or timeout
			await navigationPromise

			// Get response data
			const newUrl = page.url()
			const redirectUrl = newUrl !== currentUrl ? newUrl : undefined

			// Try to extract any response data or error messages
			const responseData = await this.extractResponseData(page)

			return {
				success: true,
				redirectUrl,
				responseData,
			}
		} catch (error) {
			// Check for error messages on the page
			const errorMessages = await this.extractErrorMessages(page)

			return {
				success: false,
				errors: [error instanceof Error ? error.message : String(error), ...errorMessages],
			}
		}
	}

	private async fillField(page: Page, fieldName: string, value: string | number | boolean | File): Promise<void> {
		// Try different selector strategies
		const selectors = [
			`[name="${fieldName}"]`,
			`#${fieldName}`,
			`[id="${fieldName}"]`,
			`[data-name="${fieldName}"]`,
		]

		let element = null
		for (const selector of selectors) {
			element = await page.$(selector)
			if (element) break
		}

		if (!element) {
			throw new Error(`Field "${fieldName}" not found`)
		}

		// Get field type
		const fieldType = await element.evaluate((el) => {
			const tag = el.tagName.toLowerCase()
			if (tag === "input") {
				return (el as HTMLInputElement).type
			}
			return tag
		})

		// Handle different field types
		switch (fieldType) {
			case "text":
			case "email":
			case "password":
			case "search":
			case "url":
			case "tel":
			case "textarea":
				await element.click({ clickCount: 3 }) // Select all text
				await element.type(String(value))
				break

			case "number":
			case "range":
				await element.click({ clickCount: 3 })
				await element.type(String(value))
				break

			case "checkbox":
			case "radio":
				const isChecked = await element.evaluate((el) => (el as HTMLInputElement).checked)
				const shouldCheck = Boolean(value)
				if (isChecked !== shouldCheck) {
					await element.click()
				}
				break

			case "select":
				await element.select(String(value))
				break

			case "file":
				if (value instanceof File) {
					// For file uploads, we would need the file path
					// In CLI context, this would be a file path string
					const fileInput = element as any // Type assertion for uploadFile method
					await fileInput.uploadFile(String(value))
				}
				break

			case "date":
			case "datetime-local":
			case "month":
			case "week":
			case "time":
				await element.click({ clickCount: 3 })
				await element.type(String(value))
				break

			default:
				// Fallback: try to type the value
				await element.click({ clickCount: 3 })
				await element.type(String(value))
		}
	}

	private async extractResponseData(page: Page): Promise<any> {
		try {
			// Look for common success/error indicators
			const responseData = await page.evaluate(() => {
				const successMessages = Array.from(
					document.querySelectorAll('.success, .success-message, [class*="success"]'),
				)
				const errorMessages = Array.from(document.querySelectorAll('.error, .error-message, [class*="error"]'))
				const alerts = Array.from(document.querySelectorAll('.alert, .notification, [role="alert"]'))

				return {
					success: successMessages.map((el) => el.textContent?.trim()).filter(Boolean),
					errors: errorMessages.map((el) => el.textContent?.trim()).filter(Boolean),
					alerts: alerts.map((el) => el.textContent?.trim()).filter(Boolean),
					title: document.title,
					url: window.location.href,
				}
			})

			return responseData
		} catch (error) {
			return null
		}
	}

	private async extractErrorMessages(page: Page): Promise<string[]> {
		try {
			return await page.evaluate(() => {
				const errorSelectors = [
					".error",
					".error-message",
					".field-error",
					".form-error",
					'[class*="error"]',
					'[role="alert"]',
					".alert-danger",
					".alert-error",
				]

				const errors: string[] = []
				for (const selector of errorSelectors) {
					const elements = document.querySelectorAll(selector)
					elements.forEach((el) => {
						const text = el.textContent?.trim()
						if (text && !errors.includes(text)) {
							errors.push(text)
						}
					})
				}

				return errors
			})
		} catch (error) {
			return []
		}
	}

	async getFormFields(
		page: Page,
		formSelector?: string,
	): Promise<Array<{ name: string; type: string; required: boolean; value?: string }>> {
		try {
			const selector = formSelector
				? `${formSelector} input, ${formSelector} textarea, ${formSelector} select`
				: "input, textarea, select"

			return await page.evaluate((sel) => {
				const fields = Array.from(document.querySelectorAll(sel))
				return fields
					.map((field) => {
						const element = field as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
						return {
							name: element.name || element.id || "",
							type: element.type || element.tagName.toLowerCase(),
							required: element.hasAttribute("required"),
							value: element.value || undefined,
						}
					})
					.filter((field) => field.name)
			}, selector)
		} catch (error) {
			return []
		}
	}

	async waitForFormValidation(page: Page, timeout: number = 5000): Promise<boolean> {
		try {
			// Wait for any validation messages to appear or disappear
			await page.waitForFunction(
				() => {
					const invalidFields = document.querySelectorAll(":invalid")
					const errorMessages = document.querySelectorAll('.error, .error-message, [class*="error"]')
					return invalidFields.length === 0 && errorMessages.length === 0
				},
				{ timeout },
			)
			return true
		} catch (error) {
			return false
		}
	}
}
