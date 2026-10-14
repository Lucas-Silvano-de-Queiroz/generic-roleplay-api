import { UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import type { TokenPair } from "modules/identity/application/contracts/token-service.contract.token";
import { env } from "../../config/env";

export const accessCookieName = () =>
	env.NODE_ENV === "production" ? "__Host-grp-access" : "grp-access";
export const refreshCookieName = () =>
	env.NODE_ENV === "production" ? "__Host-grp-refresh" : "grp-refresh";

export function readAuthCookie(
	request: Pick<Request, "headers">,
	name: string,
): string | null {
	const matches = (request.headers.cookie ?? "")
		.split(";")
		.map((part) => part.trim())
		.filter((part) => part.startsWith(`${name}=`));
	if (matches.length !== 1) return null;
	try {
		const value = decodeURIComponent(matches[0].slice(name.length + 1));
		return value.length > 0 && value.length <= 4096 ? value : null;
	} catch {
		return null;
	}
}

export function requireRefreshCookie(
	request: Pick<Request, "headers">,
): string {
	const token = readAuthCookie(request, refreshCookieName());
	if (!token) throw new UnauthorizedException();
	return token;
}

export function authCookieOptions() {
	return {
		httpOnly: true,
		secure: env.NODE_ENV === "production",
		sameSite: "lax" as const,
		path: "/",
	};
}

export function writeAuthCookies(response: Response, tokens: TokenPair): void {
	for (const [name, token] of [
		[accessCookieName(), tokens.accessToken],
		[refreshCookieName(), tokens.refreshToken],
	]) {
		const { exp } = JSON.parse(
			Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
		) as { exp: number };
		response.cookie(name, token, {
			...authCookieOptions(),
			expires: new Date(exp * 1000),
		});
	}
}

export function clearAuthCookies(response: Response): void {
	response.clearCookie(accessCookieName(), authCookieOptions());
	response.clearCookie(refreshCookieName(), authCookieOptions());
}
