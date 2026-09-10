import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export abstract class AuthenticatedUser {
	/**
	 * User id
	 * @example "01a3c1d6-..."
	 */
	abstract id: string;
}

export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthenticatedUser => {
		const request = context.switchToHttp().getRequest();

		return request.user;
	},
);
