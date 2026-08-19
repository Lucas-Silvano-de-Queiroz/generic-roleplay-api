import type { PipeTransform } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import type { ZodType } from "zod";

export class ZodValidationPipe implements PipeTransform {
	constructor(private readonly schema: ZodType) {}

	transform(value: unknown) {
		const result = this.schema.safeParse(value);
		if (!result.success) {
			throw new BadRequestException({
				message: "Validation failed",
				errors: result.error.issues,
			});
		}

		return result.data;
	}
}
