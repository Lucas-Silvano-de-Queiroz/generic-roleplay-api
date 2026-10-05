import { ConflictException, NotFoundException } from "@nestjs/common";

export class ContentNotFoundError extends NotFoundException {
	constructor() {
		super("Resource not found");
	}
}

export class ContentIdentifierConflictError extends ConflictException {
	constructor(resource: "Collection" | "Template") {
		super(`${resource} identifier already exists`);
	}
}

export class ContentLimitError extends ConflictException {
	constructor(resource: "Collection" | "Template") {
		super(`${resource} limit reached`);
	}
}

export function requireContent<T>(resource: T | null): T {
	if (resource === null) throw new ContentNotFoundError();
	return resource;
}
