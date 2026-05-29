export abstract class CreateUserRequestDto {
	/**
	 * User name
	 * @example "John Doe"
	 */
	abstract name: string;
	/**
	 * User email
	 * @example example@example.com
	 */
	abstract email: string;
	/**
	 * User password must 8 chars
	 * @example password
	 */
	abstract password: string;
}
