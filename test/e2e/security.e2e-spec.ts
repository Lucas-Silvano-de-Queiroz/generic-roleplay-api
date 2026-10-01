import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../../src/app.module";
import { db } from "../../src/modules/shared/infrastructure/database/drizzle";
import { configureHttpApplication } from "../../src/modules/shared/presentation/configure-http-application";

describe("Session security (e2e)", () => {
	let app: INestApplication;
	beforeAll(async () => {
		const module = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();
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
				.send({ refreshToken: "invalid" })
				.expect(401);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.send({ refreshToken: "invalid" })
			.expect(429);
	});
	it("does not revoke a valid session when an unsigned or access token is presented as refresh", async () => {
		const tokens = await login("forged-refresh");
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.send({ refreshToken: tokens.accessToken })
			.expect(401);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.send({ refreshToken: `${tokens.refreshToken.slice(0, -8)}invalid!` })
			.expect(401);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.send({ refreshToken: tokens.refreshToken })
			.expect(200);
	});
	async function login(label: string) {
		const email = `${label}@example.com`;
		await request(app.getHttpServer())
			.post("/users")
			.send({ name: "Ana", email, password: "password" })
			.expect(201);
		return (
			await request(app.getHttpServer())
				.post("/auth/login")
				.send({ email, password: "password" })
				.expect(200)
		).body;
	}
	it("rotates refresh tokens and revokes the family after replay", async () => {
		const first = await login("rotation");
		const second = (
			await request(app.getHttpServer())
				.post("/auth/refresh")
				.send({ refreshToken: first.refreshToken })
				.expect(200)
		).body;
		expect(second.refreshToken).toEqual(expect.any(String));
		expect(second.refreshToken).not.toBe(first.refreshToken);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.send({ refreshToken: first.refreshToken })
			.expect(401);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.send({ refreshToken: second.refreshToken })
			.expect(401);
	});
	it("revokes access and refresh on logout", async () => {
		const tokens = await login("logout");
		await request(app.getHttpServer())
			.post("/auth/logout")
			.set("Authorization", `Bearer ${tokens.accessToken}`)
			.expect(204);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.send({ refreshToken: tokens.refreshToken })
			.expect(401);
		await request(app.getHttpServer())
			.delete("/users/me")
			.set("Authorization", `Bearer ${tokens.accessToken}`)
			.send({ password: "password" })
			.expect(401);
	});
	it("rejects access and refresh when the persisted session expires", async () => {
		const tokens = await login("expired-session");
		const { sid } = JSON.parse(
			Buffer.from(tokens.refreshToken.split(".")[1], "base64url").toString(),
		);
		await db.execute(
			sql`UPDATE sessions SET expires_at = now() - interval '1 second' WHERE id = ${sid}`,
		);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.send({ refreshToken: tokens.refreshToken })
			.expect(401);
		await request(app.getHttpServer())
			.post("/auth/logout")
			.set("Authorization", `Bearer ${tokens.accessToken}`)
			.expect(401);
	});
	it("allows at most one concurrent refresh and revokes the raced session", async () => {
		const tokens = await login("concurrent");
		const responses = await Promise.all(
			[1, 2].map(() =>
				request(app.getHttpServer())
					.post("/auth/refresh")
					.send({ refreshToken: tokens.refreshToken }),
			),
		);
		expect(responses.map((response) => response.status).sort()).toEqual([
			200, 401,
		]);
		const rotated = responses.find((response) => response.status === 200)?.body;
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.send({ refreshToken: rotated.refreshToken })
			.expect(401);
	});
});
