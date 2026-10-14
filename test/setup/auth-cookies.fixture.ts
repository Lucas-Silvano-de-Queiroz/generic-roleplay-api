import type { Response } from "supertest";

export const accessCookie = (token: string) =>
	`grp-access=${encodeURIComponent(token)}`;
export const refreshCookie = (token: string) =>
	`grp-refresh=${encodeURIComponent(token)}`;

export function tokensFromCookies(response: Response) {
	const cookies = response.headers["set-cookie"] as unknown as string[];
	const read = (name: string) => {
		const cookie = cookies?.find((value) => value.startsWith(`${name}=`));
		if (!cookie) throw new Error(`Missing ${name} cookie`);
		return decodeURIComponent(cookie.split(";")[0].slice(name.length + 1));
	};
	return { accessToken: read("grp-access"), refreshToken: read("grp-refresh") };
}
