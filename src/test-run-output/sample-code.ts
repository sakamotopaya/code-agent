// Sample TypeScript file with various code definitions

// Interfaces
interface User {
	id: number
	name: string
	email: string
	isActive: boolean
}

interface DatabaseConnection {
	host: string
	port: number
	database: string
	connect(): Promise<void>
	disconnect(): Promise<void>
}

// Type aliases
type Status = "pending" | "approved" | "rejected"
type UserRole = "admin" | "user" | "moderator"
type EventHandler<T> = (event: T) => void

// Enums
enum Color {
	Red = "#FF0000",
	Green = "#00FF00",
	Blue = "#0000FF",
	Yellow = "#FFFF00",
}

enum HttpStatusCode {
	OK = 200,
	NotFound = 404,
	InternalServerError = 500,
	BadRequest = 400,
}

enum Direction {
	Up,
	Down,
	Left,
	Right,
}

// Constants
const API_BASE_URL = "https://api.example.com"
const MAX_RETRY_ATTEMPTS = 3
const DEFAULT_TIMEOUT = 5000

// Regular functions
function calculateArea(width: number, height: number): number {
	return width * height
}

function formatUserName(user: User): string {
	return `${user.name} (${user.email})`
}

async function fetchUserData(userId: number): Promise<User | null> {
	try {
		const response = await fetch(`${API_BASE_URL}/users/${userId}`)
		if (response.ok) {
			return await response.json()
		}
		return null
	} catch (error) {
		console.error("Failed to fetch user data:", error)
		return null
	}
}

function* generateNumbers(max: number): Generator<number> {
	for (let i = 0; i < max; i++) {
		yield i
	}
}

// Arrow functions
const multiply = (a: number, b: number): number => a * b
const isEven = (num: number): boolean => num % 2 === 0
const createUser = (name: string, email: string): User => ({
	id: Math.random(),
	name,
	email,
	isActive: true,
})

// Classes
class Animal {
	protected name: string
	protected age: number

	constructor(name: string, age: number) {
		this.name = name
		this.age = age
	}

	public getName(): string {
		return this.name
	}

	public getAge(): number {
		return this.age
	}

	public makeSound(): string {
		return "Some generic animal sound"
	}

	protected sleep(): void {
		console.log(`${this.name} is sleeping`)
	}
}

class Dog extends Animal {
	private breed: string
	static species = "Canis lupus"

	constructor(name: string, age: number, breed: string) {
		super(name, age)
		this.breed = breed
	}

	public makeSound(): string {
		return "Woof!"
	}

	public getBreed(): string {
		return this.breed
	}

	static getSpecies(): string {
		return Dog.species
	}

	public wagTail(): void {
		console.log(`${this.name} is wagging its tail`)
	}
}

abstract class Shape {
	protected color: Color

	constructor(color: Color) {
		this.color = color
	}

	abstract calculateArea(): number
	abstract calculatePerimeter(): number

	public getColor(): Color {
		return this.color
	}
}

class Rectangle extends Shape {
	private width: number
	private height: number

	constructor(width: number, height: number, color: Color) {
		super(color)
		this.width = width
		this.height = height
	}

	calculateArea(): number {
		return this.width * this.height
	}

	calculatePerimeter(): number {
		return 2 * (this.width + this.height)
	}

	public getDimensions(): { width: number; height: number } {
		return { width: this.width, height: this.height }
	}
}

class Circle extends Shape {
	private radius: number

	constructor(radius: number, color: Color) {
		super(color)
		this.radius = radius
	}

	calculateArea(): number {
		return Math.PI * this.radius ** 2
	}

	calculatePerimeter(): number {
		return 2 * Math.PI * this.radius
	}

	public getRadius(): number {
		return this.radius
	}
}

// Generic classes
class DataStore<T> {
	private items: T[] = []

	public add(item: T): void {
		this.items.push(item)
	}

	public remove(index: number): T | undefined {
		return this.items.splice(index, 1)[0]
	}

	public get(index: number): T | undefined {
		return this.items[index]
	}

	public getAll(): T[] {
		return [...this.items]
	}

	public size(): number {
		return this.items.length
	}

	public clear(): void {
		this.items = []
	}
}

class EventEmitter<T> {
	private listeners: EventHandler<T>[] = []

	public on(handler: EventHandler<T>): void {
		this.listeners.push(handler)
	}

	public off(handler: EventHandler<T>): void {
		const index = this.listeners.indexOf(handler)
		if (index > -1) {
			this.listeners.splice(index, 1)
		}
	}

	public emit(event: T): void {
		this.listeners.forEach((handler) => handler(event))
	}
}

// Namespace
namespace Utils {
	export function debounce<T extends (...args: any[]) => any>(
		func: T,
		delay: number,
	): (...args: Parameters<T>) => void {
		let timeoutId: NodeJS.Timeout
		return (...args: Parameters<T>) => {
			clearTimeout(timeoutId)
			timeoutId = setTimeout(() => func(...args), delay)
		}
	}

	export function throttle<T extends (...args: any[]) => any>(
		func: T,
		limit: number,
	): (...args: Parameters<T>) => void {
		let inThrottle: boolean
		return (...args: Parameters<T>) => {
			if (!inThrottle) {
				func(...args)
				inThrottle = true
				setTimeout(() => (inThrottle = false), limit)
			}
		}
	}

	export class Logger {
		private prefix: string

		constructor(prefix: string) {
			this.prefix = prefix
		}

		public log(message: string): void {
			console.log(`[${this.prefix}] ${message}`)
		}

		public error(message: string): void {
			console.error(`[${this.prefix}] ERROR: ${message}`)
		}

		public warn(message: string): void {
			console.warn(`[${this.prefix}] WARNING: ${message}`)
		}
	}

	export enum LogLevel {
		Debug = 0,
		Info = 1,
		Warning = 2,
		Error = 3,
	}
}

// Module augmentation example
declare global {
	interface Window {
		customProperty: string
	}
}

// Export statements
export {
	User,
	DatabaseConnection,
	Status,
	UserRole,
	Color,
	HttpStatusCode,
	Direction,
	Animal,
	Dog,
	Shape,
	Rectangle,
	Circle,
	DataStore,
	EventEmitter,
	Utils,
}

export default class DefaultExportClass {
	private value: string

	constructor(value: string) {
		this.value = value
	}

	public getValue(): string {
		return this.value
	}

	public setValue(value: string): void {
		this.value = value
	}
}
