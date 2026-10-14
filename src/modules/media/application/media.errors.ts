import { HttpException } from "@nestjs/common";

export class MediaHttpError extends HttpException {
	constructor(statusCode: number, message: string, retryAfterSeconds?: number) {
		super(
			{
				statusCode,
				message,
				...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
			},
			statusCode,
		);
	}
}
