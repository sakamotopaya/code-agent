import { OutputFormat, FormattedOutput, ErrorInfo, WarningInfo, OutputMetadata } from "../types/output-types"

/**
 * Validate if data can be safely formatted in the given format
 */
export function validateDataForFormat(data: any, format: OutputFormat): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	switch (format) {
		case OutputFormat.JSON:
			return validateForJSON(data)

		case OutputFormat.CSV:
			return validateForCSV(data)

		case OutputFormat.YAML:
			return validateForYAML(data)

		case OutputFormat.MARKDOWN:
		case OutputFormat.PLAIN:
			// These formats are more flexible and can handle most data types
			return { isValid: true, errors: [], warnings: [] }

		default:
			errors.push(`Unknown format: ${format}`)
			return { isValid: false, errors, warnings }
	}
}

/**
 * Validate FormattedOutput structure
 */
export function validateFormattedOutput(output: FormattedOutput): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	// Validate metadata
	if (!output.metadata) {
		errors.push("Missing metadata in FormattedOutput")
	} else {
		const metadataValidation = validateMetadata(output.metadata)
		errors.push(...metadataValidation.errors)
		warnings.push(...metadataValidation.warnings)
	}

	// Validate errors array
	if (output.errors) {
		if (!Array.isArray(output.errors)) {
			errors.push("Errors must be an array")
		} else {
			output.errors.forEach((error, index) => {
				const errorValidation = validateErrorInfo(error, `errors[${index}]`)
				errors.push(...errorValidation.errors)
				warnings.push(...errorValidation.warnings)
			})
		}
	}

	// Validate warnings array
	if (output.warnings) {
		if (!Array.isArray(output.warnings)) {
			errors.push("Warnings must be an array")
		} else {
			output.warnings.forEach((warning, index) => {
				const warningValidation = validateWarningInfo(warning, `warnings[${index}]`)
				errors.push(...warningValidation.errors)
				warnings.push(...warningValidation.warnings)
			})
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	}
}

/**
 * Check if data contains circular references
 */
export function hasCircularReferences(data: any, seen = new WeakSet()): boolean {
	if (data === null || typeof data !== "object") {
		return false
	}

	if (seen.has(data)) {
		return true
	}

	seen.add(data)

	try {
		if (Array.isArray(data)) {
			return data.some((item) => hasCircularReferences(item, seen))
		}

		return Object.values(data).some((value) => hasCircularReferences(value, seen))
	} catch (error) {
		// If we can't iterate over the object, assume it might have circular refs
		return true
	} finally {
		seen.delete(data)
	}
}

/**
 * Estimate the size of serialized data
 */
export function estimateSerializedSize(data: any): number {
	try {
		return JSON.stringify(data).length
	} catch (error) {
		// Fallback estimation for data that can't be JSON.stringify'd
		return String(data).length
	}
}

/**
 * Check if data size is within reasonable limits for the format
 */
export function validateDataSize(data: any, format: OutputFormat): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	const size = estimateSerializedSize(data)

	// Define size limits (in characters)
	const limits = {
		[OutputFormat.JSON]: 10 * 1024 * 1024, // 10MB
		[OutputFormat.YAML]: 5 * 1024 * 1024, // 5MB
		[OutputFormat.CSV]: 50 * 1024 * 1024, // 50MB
		[OutputFormat.MARKDOWN]: 5 * 1024 * 1024, // 5MB
		[OutputFormat.PLAIN]: 10 * 1024 * 1024, // 10MB
	}

	const limit = limits[format]

	if (size > limit) {
		errors.push(`Data size (${formatBytes(size)}) exceeds limit for ${format} format (${formatBytes(limit)})`)
	} else if (size > limit * 0.8) {
		warnings.push(`Data size (${formatBytes(size)}) is approaching limit for ${format} format`)
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	}
}

interface ValidationResult {
	isValid: boolean
	errors: string[]
	warnings: string[]
}

function validateForJSON(data: any): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	// Check for circular references
	if (hasCircularReferences(data)) {
		warnings.push('Data contains circular references - they will be replaced with "[Circular Reference]"')
	}

	// Check for functions or other non-serializable values
	const nonSerializable = findNonSerializableValues(data)
	if (nonSerializable.length > 0) {
		warnings.push(
			`Found non-serializable values: ${nonSerializable.join(", ")} - they will be converted to strings`,
		)
	}

	return {
		isValid: true, // JSON formatter can handle most cases with fallbacks
		errors,
		warnings,
	}
}

function validateForCSV(data: any): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	// CSV works best with tabular data
	if (!isTabularData(data)) {
		warnings.push("Data is not in tabular format - it will be flattened for CSV output")
	}

	// Check for nested objects or arrays
	if (hasNestedStructures(data)) {
		warnings.push("Data contains nested structures - they will be JSON stringified in CSV")
	}

	return {
		isValid: true,
		errors,
		warnings,
	}
}

function validateForYAML(data: any): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	// Check for circular references
	if (hasCircularReferences(data)) {
		warnings.push('Data contains circular references - they will be replaced with "[Circular Reference]"')
	}

	return {
		isValid: true,
		errors,
		warnings,
	}
}

function validateMetadata(metadata: OutputMetadata): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	if (!metadata.timestamp) {
		errors.push("Missing timestamp in metadata")
	} else if (isNaN(Date.parse(metadata.timestamp))) {
		errors.push("Invalid timestamp format in metadata")
	}

	if (!metadata.version) {
		warnings.push("Missing version in metadata")
	}

	if (typeof metadata.duration !== "number" || metadata.duration < 0) {
		warnings.push("Invalid duration in metadata")
	}

	if (typeof metadata.exitCode !== "number") {
		warnings.push("Invalid exit code in metadata")
	}

	return { isValid: errors.length === 0, errors, warnings }
}

function validateErrorInfo(error: ErrorInfo, path: string): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	if (!error.code) {
		warnings.push(`Missing error code in ${path}`)
	}

	if (!error.message) {
		errors.push(`Missing error message in ${path}`)
	}

	return { isValid: errors.length === 0, errors, warnings }
}

function validateWarningInfo(warning: WarningInfo, path: string): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	if (!warning.code) {
		warnings.push(`Missing warning code in ${path}`)
	}

	if (!warning.message) {
		errors.push(`Missing warning message in ${path}`)
	}

	return { isValid: errors.length === 0, errors, warnings }
}

function findNonSerializableValues(data: any, path = "root"): string[] {
	const nonSerializable: string[] = []

	if (typeof data === "function") {
		nonSerializable.push(`${path} (function)`)
		return nonSerializable
	}

	if (typeof data === "symbol") {
		nonSerializable.push(`${path} (symbol)`)
		return nonSerializable
	}

	if (typeof data === "undefined") {
		nonSerializable.push(`${path} (undefined)`)
		return nonSerializable
	}

	if (data === null || typeof data !== "object") {
		return nonSerializable
	}

	if (Array.isArray(data)) {
		data.forEach((item, index) => {
			nonSerializable.push(...findNonSerializableValues(item, `${path}[${index}]`))
		})
		return nonSerializable
	}

	Object.entries(data).forEach(([key, value]) => {
		nonSerializable.push(...findNonSerializableValues(value, `${path}.${key}`))
	})

	return nonSerializable
}

function isTabularData(data: any): boolean {
	if (!Array.isArray(data) || data.length === 0) {
		return false
	}

	const firstItem = data[0]
	if (!firstItem || typeof firstItem !== "object") {
		return false
	}

	const keys = Object.keys(firstItem)
	return data.every(
		(item) =>
			item &&
			typeof item === "object" &&
			Object.keys(item).length === keys.length &&
			keys.every((key) => key in item),
	)
}

function hasNestedStructures(data: any): boolean {
	if (typeof data !== "object" || data === null) {
		return false
	}

	if (Array.isArray(data)) {
		return data.some((item) => typeof item === "object" && item !== null)
	}

	return Object.values(data).some((value) => typeof value === "object" && value !== null)
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 Bytes"

	const k = 1024
	const sizes = ["Bytes", "KB", "MB", "GB"]
	const i = Math.floor(Math.log(bytes) / Math.log(k))

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export type { ValidationResult }
