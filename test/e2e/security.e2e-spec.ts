import { createHash, randomUUID } from "node:crypto";
import { Controller, Get, type INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import request from "supertest";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { AppModule } from "../../src/app.module";
import {
	db,
	pool,
} from "../../src/modules/shared/infrastructure/database/drizzle";
import { configureHttpApplication } from "../../src/modules/shared/presentation/configure-http-application";
import {
	type AuthenticatedUser,
	CurrentUser,
} from "../../src/modules/shared/presentation/decorators/current-user.decorator";
import {
	accessCookie,
	refreshCookie,
	tokensFromCookies,
} from "../setup/auth-cookies.fixture";

@Controller("auth-probe")
class AuthProbeController {
	@Get()
	user(@CurrentUser() user: AuthenticatedUser) {
		return user;
	}
}

describe("Token authentication (e2e)", () => {
	let app: INestApplication;
	let jwt: JwtService;
	beforeAll(async () => {
		const module = await Test.createTestingModule({
			imports: [AppModule],
			controllers: [AuthProbeController],
		}).compile();
		jwt = module.get(JwtService);
		app = module.createNestApplication();
		configureHttpApplication(app);
		await app.init();
	});
	afterAll(async () => {
		await app?.close();
	});
	beforeEach(async () => {
		await db.execute(sql`DELETE FROM rate_limits`);
	});
	it("reports database/schema readiness without exposing infrastructure details", async () => {
		const response = await request(app.getHttpServer())
			.get("/health/ready")
			.expect(200);
		expect(response.body).toEqual({ status: "ready" });
	});
	it("sets a fresh request ID and prevents caching authentication responses", async () => {
		const response = await request(app.getHttpServer())
			.post("/auth/login")
			.set("X-Request-Id", "attacker-controlled")
			.send({ email: "missing@example.com", password: "password" })
			.expect(401);
		expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
		expect(response.headers["x-request-id"]).not.toBe("attacker-controlled");
		expect(response.headers["cache-control"]).toBe("no-store");
		expect(response.headers["x-powered-by"]).toBeUndefined();
	});
	it("sanitizes malformed JSON parser errors and applies security headers", async () => {
		const response = await request(app.getHttpServer())
			.post("/auth/login")
			.set("Content-Type", "application/json")
			.send('{"password":"sensitive-password" invalid}')
			.expect(400);
		expect(JSON.stringify(response.body)).not.toContain("sensitive-password");
		expect(response.body.message).toBe("Validation failed");
		expect(response.headers["cache-control"]).toBe("no-store");
		expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
	});
	it("limits invalid login attempts before more expensive verification", async () => {
		for (let i = 0; i < 5; i++)
			await request(app.getHttpServer())
				.post("/auth/login")
				.send({ email: "missing@example.com", password: "password" })
				.expect(401);
		const response = await request(app.getHttpServer())
			.post("/auth/login")
			.send({ email: "missing@example.com", password: "password" })
			.expect(429);
		expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
	});
	it("rejects oversized parser bodies without exposing their contents", async () => {
		const response = await request(app.getHttpServer())
			.post("/auth/login")
			.send({ password: "sensitive-password".repeat(10000) })
			.expect(413);
		expect(response.body.message).toBe("Request body too large");
		expect(JSON.stringify(response.body)).not.toContain("sensitive-password");
		expect(response.headers["cache-control"]).toBe("no-store");
	});
	it("limits malformed registrations", async () => {
		for (let i = 0; i < 10; i++)
			await request(app.getHttpServer()).post("/users").send({}).expect(400);
		await request(app.getHttpServer()).post("/users").send({}).expect(429);
	});
	it("limits invalid refresh attempts", async () => {
		for (let i = 0; i < 30; i++)
			await request(app.getHttpServer())
				.post("/auth/refresh")
				.set("Cookie", refreshCookie("invalid"))
				.expect(401);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", refreshCookie("invalid"))
			.expect(429);
	});
	it("does not revoke a valid refresh token when an unsigned or access token is presented as refresh", async () => {
		const tokens = await login("forged-refresh");
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", refreshCookie(tokens.accessToken))
			.expect(401);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set(
				"Cookie",
				refreshCookie(`${tokens.refreshToken.slice(0, -8)}invalid!`),
			)
			.expect(401);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", refreshCookie(tokens.refreshToken))
			.expect(204);
	});
	async function login(label: string) {
		const email = `${label}@example.com`;
		await request(app.getHttpServer())
			.post("/users")
			.send({ name: "Ana", email, password: "password" })
			.expect(201);
		return tokensFromCookies(
			await request(app.getHttpServer())
				.post("/auth/login")
				.send({ email, password: "password" })
				.expect(204),
		);
	}
	it("rotates refresh tokens and rejects reuse without invalidating the replacement", async () => {
		const first = await login("rotation");
		const second = tokensFromCookies(
			await request(app.getHttpServer())
				.post("/auth/refresh")
				.set("Cookie", refreshCookie(first.refreshToken))
				.expect(204),
		);
		expect(second.refreshToken).toEqual(expect.any(String));
		expect(second.refreshToken).not.toBe(first.refreshToken);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", refreshCookie(first.refreshToken))
			.expect(401);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", refreshCookie(second.refreshToken))
			.expect(204);
	});
	it("revokes only the refresh cookie on logout without requiring access", async () => {
		const tokens = await login("logout");
		await request(app.getHttpServer())
			.post("/auth/logout")
			.set("Cookie", refreshCookie(tokens.refreshToken))
			.expect(204);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", refreshCookie(tokens.refreshToken))
			.expect(401);
		await request(app.getHttpServer())
			.get("/auth-probe")
			.set("Cookie", accessCookie(tokens.accessToken))
			.expect(200);
		await request(app.getHttpServer())
			.post("/auth/logout")
			.set("Cookie", refreshCookie(tokens.refreshToken))
			.expect(204);
	});
	it("rejects an expired persisted refresh token without invalidating access", async () => {
		const tokens = await login("expired-refresh");
		const hash = createHash("sha256").update(tokens.refreshToken).digest("hex");
		await db.execute(
			sql`UPDATE refresh_tokens SET expires_at = now() - interval '1 second' WHERE token_hash = ${hash}`,
		);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", refreshCookie(tokens.refreshToken))
			.expect(401);
		await request(app.getHttpServer())
			.get("/auth-probe")
			.set("Cookie", accessCookie(tokens.accessToken))
			.expect(200);
	});
	it("allows at most one concurrent refresh and keeps the winning token valid", async () => {
		const tokens = await login("concurrent");
		const responses = await Promise.all(
			[1, 2].map(() =>
				request(app.getHttpServer())
					.post("/auth/refresh")
					.set("Cookie", refreshCookie(tokens.refreshToken)),
			),
		);
		expect(responses.map((response) => response.status).sort()).toEqual([
			204, 401,
		]);
		const winner = responses.find((response) => response.status === 204);
		expect(winner).toBeDefined();
		const rotated = tokensFromCookies(winner as request.Response);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", refreshCookie(rotated.refreshToken))
			.expect(204);
	});
	it("authenticates access tokens without querying PostgreSQL", async () => {
		const tokens = await login("stateless");
		const payload = jwt.decode(tokens.accessToken);
		expect(payload.sid).toBeUndefined();
		const query = vi.spyOn(pool, "query").mockImplementation(() => {
			throw new Error("Database unavailable");
		});
		try {
			const response = await request(app.getHttpServer())
				.get("/auth-probe")
				.set("Cookie", accessCookie(tokens.accessToken))
				.expect(200);
			expect(response.body).toEqual({ id: payload.sub });
			expect(query).not.toHaveBeenCalled();
		} finally {
			query.mockRestore();
		}
	});
	it("rejects expired, forged, wrong-issuer, wrong-audience and refresh JWTs as access", async () => {
		const tokens = await login("invalid-access");
		const payload = {
			sub: jwt.decode(tokens.accessToken).sub,
			tokenUse: "access",
		};
		const invalidTokens = [
			tokens.refreshToken,
			`${tokens.accessToken.slice(0, -8)}invalid!`,
			await jwt.signAsync(payload, { expiresIn: -1 }),
			await jwt.signAsync(payload, { issuer: "wrong-issuer" }),
			await jwt.signAsync(payload, { audience: "wrong-audience" }),
		];
		for (const token of invalidTokens)
			await request(app.getHttpServer())
				.get("/auth-probe")
				.set("Cookie", accessCookie(token))
				.expect(401);
	});
	it("requires a valid refresh token to log out and leaves other logins valid", async () => {
		const first = await login("independent-logins");
		const second = tokensFromCookies(
			await request(app.getHttpServer())
				.post("/auth/login")
				.send({ email: "independent-logins@example.com", password: "password" })
				.expect(204),
		);
		await request(app.getHttpServer())
			.post("/auth/logout")
			.send({})
			.expect(204);
		for (const token of [
			first.accessToken,
			"invalid",
			`${first.refreshToken.slice(0, -8)}invalid!`,
		])
			await request(app.getHttpServer())
				.post("/auth/logout")
				.set("Cookie", refreshCookie(token))
				.expect(401);
		await request(app.getHttpServer())
			.post("/auth/logout")
			.set("Cookie", refreshCookie(first.refreshToken))
			.expect(204);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", refreshCookie(second.refreshToken))
			.expect(204);
	});
	it("accepts a registered legacy refresh token and preserves its exact expiration", async () => {
		const tokens = await login("legacy-refresh");
		const sub = jwt.decode(tokens.accessToken).sub;
		const legacyToken = await jwt.signAsync(
			{ sub, sid: randomUUID(), jti: randomUUID(), tokenUse: "refresh" },
			{ expiresIn: 120 },
		);
		const expiresAt = jwt.decode(legacyToken).exp;
		const hash = createHash("sha256").update(legacyToken).digest("hex");
		await db.execute(
			sql`INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (${hash}, ${sub}, ${new Date(expiresAt * 1000)})`,
		);
		const response = await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", refreshCookie(legacyToken))
			.expect(204);
		const payload = jwt.decode(tokensFromCookies(response).refreshToken);
		expect(payload.exp).toBe(expiresAt);
		expect(payload.sid).toBeUndefined();
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", refreshCookie(tokensFromCookies(response).refreshToken))
			.expect(204);
	});
	it("removes refresh tokens from every login when the account is deleted", async () => {
		const first = await login("deleted-refreshes");
		const second = tokensFromCookies(
			await request(app.getHttpServer())
				.post("/auth/login")
				.send({ email: "deleted-refreshes@example.com", password: "password" })
				.expect(204),
		);
		await request(app.getHttpServer())
			.delete("/users/me")
			.set("Cookie", accessCookie(first.accessToken))
			.send({ password: "password" })
			.expect(204);
		for (const refreshToken of [first.refreshToken, second.refreshToken])
			await request(app.getHttpServer())
				.post("/auth/refresh")
				.set("Cookie", refreshCookie(refreshToken))
				.expect(401);
	});
});
