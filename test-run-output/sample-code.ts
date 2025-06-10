// Sample TypeScript file for testing list_code_definition_names tool

export interface User {
	id: number
	name: string
	email: string
}

export class UserService {
	private users: User[] = []

	constructor() {
		this.users = []
	}

	public async getUser(id: number): Promise<User | null> {
		return this.users.find((user) => user.id === id) || null
	}

	public async createUser(userData: Omit<User, "id">): Promise<User> {
		const newUser: User = {
			id: Date.now(),
			...userData,
		}
		this.users.push(newUser)
		return newUser
	}

	public async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
		const userIndex = this.users.findIndex((user) => user.id === id)
		if (userIndex === -1) {
			return null
		}

		this.users[userIndex] = { ...this.users[userIndex], ...updates }
		return this.users[userIndex]
	}

	public async deleteUser(id: number): Promise<boolean> {
		const userIndex = this.users.findIndex((user) => user.id === id)
		if (userIndex === -1) {
			return false
		}

		this.users.splice(userIndex, 1)
		return true
	}
}

export function validateEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(email)
}

export const DEFAULT_USER_CONFIG = {
	maxUsers: 1000,
	enableEmailValidation: true,
}
