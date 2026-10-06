import { generateKeyPairSync, randomUUID } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("modules/shared/config/env", () => {
	const keys = generateKeyPairSync("rsa", {
		modulusLength: 2048,
		publicKeyEncoding: { type: "spki", format: "pem" },
		privateKeyEncoding: { type: "pkcs8", format: "pem" },
	});
	return {
		env: {
			JWT_PUBLIC_KEY_BASE64: Buffer.from(keys.publicKey).toString("base64"),
			JWT_ISSUER: "generic-roleplay-api",
			JWT_AUDIENCE: "generic-roleplay-client",
		},
	};
});

import { JwtStrategy } from "./jwt.strategy";

describe("Stateless access token validation", () => {
	it("authenticates a valid access payload without a session or repository", async () => {
		const strategy = new JwtStrategy();
		const sub = randomUUID();
		await expect(
			Promise.resolve().then(() =>
				strategy.validate({
					sub,
					exp: Math.floor(Date.now() / 1000) + 900,
					tokenUse: "access",
				}),
			),
		).resolves.toEqual({ id: sub });
	});

	it.each([
		{ sub: "invalid", tokenUse: "access", exp: 2000000000 },
		{ sub: randomUUID(), tokenUse: "refresh", exp: 2000000000 },
		{ sub: randomUUID(), tokenUse: "access", exp: 0 },
	])("rejects malformed or refresh payloads: %j", async (payload) => {
		const strategy = new JwtStrategy();
		await expect(
			Promise.resolve().then(() => strategy.validate(payload)),
		).rejects.toBeInstanceOf(UnauthorizedException);
	});
});
