export abstract class ApplicationError extends Error {
	abstract readonly code: string;

	protected constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}
