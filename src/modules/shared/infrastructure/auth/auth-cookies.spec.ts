import type { CookieOptions, Response } from "express";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({ env: { NODE_ENV: "production" } }));

import {
	accessCookieName,
	clearAuthCookies,
	readAuthCookie,
	refreshCookieName,
	writeAuthCookies,
} from "./auth-cookies";

describe("Production JWT cookies", () => {
	it("sets host-only, HTTP-only, secure cookies with the JWT's exact expiration", () => {
		const written: Array<{
			name: string;
			token: string;
			options: CookieOptions;
		}> = [];
		const response = {
			cookie(name: string, token: string, options: CookieOptions) {
				written.push({ name, token, options });
			},
		} as unknown as Response;
		const accessToken = `header.${Buffer.from('{"exp":2000000000}').toString("base64url")}.signature`;
		const refreshToken = `header.${Buffer.from('{"exp":2001000000}').toString("base64url")}.signature`;
		writeAuthCookies(response, {
			accessToken,
			refreshToken,
			tokenType: "Bearer",
		});
		expect(written).toEqual([
			{
				name: "__Host-grp-access",
				token: accessToken,
				options: {
					httpOnly: true,
					secure: true,
					sameSite: "lax",
					path: "/",
					expires: new Date(2000000000000),
				},
			},
			{
				name: "__Host-grp-refresh",
				token: refreshToken,
				options: {
					httpOnly: true,
					secure: true,
					sameSite: "lax",
					path: "/",
					expires: new Date(2001000000000),
				},
			},
		]);
	});

	it("clears the same cookie names and scope used when issuing tokens", () => {
		const cleared: Array<{ name: string; options: CookieOptions }> = [];
		clearAuthCookies({
			clearCookie(name: string, options: CookieOptions) {
				cleared.push({ name, options });
			},
		} as unknown as Response);
		expect(cleared).toEqual([
			{
				name: "__Host-grp-access",
				options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
			},
			{
				name: "__Host-grp-refresh",
				options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
			},
		]);
	});

	it.each([
		"__Host-grp-access=first; __Host-grp-access=second",
		"__Host-grp-access=%invalid",
		"__Host-grp-access=",
		`__Host-grp-access=${"a".repeat(4097)}`,
		"grp-access=development-token",
	])(
		"rejects duplicate, malformed, oversized or wrong-environment cookies",
		(cookie) => {
			expect(
				readAuthCookie({ headers: { cookie } }, accessCookieName()),
			).toBeNull();
		},
	);

	it("reads only the requested cookie and accepts a bounded, encoded token", () => {
		const request = {
			headers: {
				cookie: "irrelevant=x; __Host-grp-refresh=token%2Evalue; other=y",
			},
		};
		expect(readAuthCookie(request, refreshCookieName())).toBe("token.value");
		expect(readAuthCookie(request, accessCookieName())).toBeNull();
	});
});
