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

// Constants
const API_BASE_URL = "https://api.example.com"
const MAX_RETRY_ATTEMPTS = 3

// Regular functions
function calculateArea(width: number, height: number): number {
	return width * height
}

function validateEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(email)
}

async function fetchUserData(userId: number): Promise<User | null> {
	try {
		const response = await fetch(`${API_BASE_URL}/users/${userId}`)
		if (response.ok) {
			return await response.json()
		}
		return null
	} catch (error) {
		console.error("Error fetching user data:", error)
		return null
	}
}

// Arrow functions
const multiply = (a: number, b: number): number => a * b
const greetUser = (name: string): string => `Hello, ${name}!`
const processArray = <T>(items: T[], processor: (item: T) => T): T[] => items.map(processor)

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
}

class Dog extends Animal {
	private breed: string

	constructor(name: string, age: number, breed: string) {
		super(name, age)
		this.breed = breed
	}

	public getBreed(): string {
		return this.breed
	}

	public makeSound(): string {
		return "Woof!"
	}

	public fetch(): string {
		return `${this.name} is fetching the ball!`
	}
}

class UserManager {
	private users: User[] = []
	private static instance: UserManager

	private constructor() {}

	public static getInstance(): UserManager {
		if (!UserManager.instance) {
			UserManager.instance = new UserManager()
		}
		return UserManager.instance
	}

	public addUser(user: User): void {
		this.users.push(user)
	}

	public getUserById(id: number): User | undefined {
		return this.users.find((user) => user.id === id)
	}

	public getAllUsers(): User[] {
		return [...this.users]
	}

	public removeUser(id: number): boolean {
		const index = this.users.findIndex((user) => user.id === id)
		if (index !== -1) {
			this.users.splice(index, 1)
			return true
		}
		return false
	}
}

// Abstract class
abstract class Shape {
	protected color: Color

	constructor(color: Color) {
		this.color = color
	}

	public getColor(): Color {
		return this.color
	}

	public abstract calculateArea(): number
	public abstract getPerimeter(): number
}

class Rectangle extends Shape {
	private width: number
	private height: number

	constructor(width: number, height: number, color: Color) {
		super(color)
		this.width = width
		this.height = height
	}

	public calculateArea(): number {
		return this.width * this.height
	}

	public getPerimeter(): number {
		return 2 * (this.width + this.height)
	}
}

class Circle extends Shape {
	private radius: number

	constructor(radius: number, color: Color) {
		super(color)
		this.radius = radius
	}

	public calculateArea(): number {
		return Math.PI * this.radius * this.radius
	}

	public getPerimeter(): number {
		return 2 * Math.PI * this.radius
	}
}

// Namespace
namespace MathUtils {
	export const PI = Math.PI
	export const E = Math.E

	export function degreeToRadian(degree: number): number {
		return (degree * PI) / 180
	}

	export function radianToDegree(radian: number): number {
		return (radian * 180) / PI
	}

	export class Calculator {
		public add(a: number, b: number): number {
			return a + b
		}

		public subtract(a: number, b: number): number {
			return a - b
		}

		public multiply(a: number, b: number): number {
			return a * b
		}

		public divide(a: number, b: number): number {
			if (b === 0) {
				throw new Error("Division by zero")
			}
			return a / b
		}
	}
}

// Generic class
class Stack<T> {
	private items: T[] = []

	public push(item: T): void {
		this.items.push(item)
	}

	public pop(): T | undefined {
		return this.items.pop()
	}

	public peek(): T | undefined {
		return this.items[this.items.length - 1]
	}

	public isEmpty(): boolean {
		return this.items.length === 0
	}

	public size(): number {
		return this.items.length
	}
}

// Generic function
function identity<T>(arg: T): T {
	return arg
}

function createArray<T>(length: number, value: T): T[] {
	return Array(length).fill(value)
}

// Module exports
export {
	User,
	DatabaseConnection,
	Status,
	UserRole,
	EventHandler,
	Color,
	HttpStatusCode,
	calculateArea,
	validateEmail,
	fetchUserData,
	multiply,
	greetUser,
	processArray,
	Animal,
	Dog,
	UserManager,
	Shape,
	Rectangle,
	Circle,
	MathUtils,
	Stack,
	identity,
	createArray,
}

export default UserManager
