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
				details: result.error.issues.map((issue) => ({
					field: issue.path.join("."),
					message: issue.message,
				})),
			});
		}

		return result.data;
	}
}
