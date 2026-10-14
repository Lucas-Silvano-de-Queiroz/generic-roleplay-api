import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../../src/app.module";
import { db } from "../../src/modules/shared/infrastructure/database/drizzle";
import { configureHttpApplication } from "../../src/modules/shared/presentation/configure-http-application";

@Controller("cookie-probe")
class CookieProbeController {
	@Get()
	probe() {
		return { authenticated: true };
	}
}

describe("HTTP-only JWT cookies", () => {
	let app: INestApplication;
	beforeAll(async () => {
		const module = await Test.createTestingModule({
			imports: [AppModule],
			controllers: [CookieProbeController],
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

	async function login(label: string) {
		const email = `cookie-${label}@example.com`;
		await request(app.getHttpServer())
			.post("/users")
			.send({ name: "Ana", email, password: "password" })
			.expect(201);
		return request(app.getHttpServer())
			.post("/auth/login")
			.send({ email, password: "password" })
			.expect(204);
	}
	function cookieJar(response: request.Response): string[] {
		return (response.headers["set-cookie"] as unknown as string[]).map(
			(cookie) => cookie.split(";")[0],
		);
	}
	it("issues cookies instead of JSON and authenticates using the access cookie", async () => {
		const response = await login("issue");
		expect(response.text).toBe("");
		const cookies = response.headers["set-cookie"] as unknown as string[];
		expect(cookies).toHaveLength(2);
		for (const cookie of cookies) {
			expect(cookie).toContain("HttpOnly");
			expect(cookie).toContain("SameSite=Lax");
			expect(cookie).toContain("Path=/");
			expect(cookie).not.toContain("Domain=");
		}
		await request(app.getHttpServer())
			.get("/cookie-probe")
			.set("Cookie", cookieJar(response))
			.expect(200);
		const accessToken = cookieJar(response)
			.find((cookie) => cookie.startsWith("grp-access="))
			?.slice("grp-access=".length);
		await request(app.getHttpServer())
			.get("/cookie-probe")
			.set("Authorization", `Bearer ${accessToken}`)
			.expect(401);
	});
	it("rotates from the refresh cookie without accepting a token in the body", async () => {
		const first = await login("refresh");
		const second = await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", cookieJar(first))
			.expect(204);
		expect(second.text).toBe("");
		expect(
			cookieJar(second).find((cookie) => cookie.startsWith("grp-refresh=")),
		).not.toBe(
			cookieJar(first).find((cookie) => cookie.startsWith("grp-refresh=")),
		);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", cookieJar(first))
			.expect(401);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.send({ refreshToken: "body-token" })
			.expect(401);
	});
	it("revokes the refresh and clears both cookies on logout", async () => {
		const first = await login("logout");
		const response = await request(app.getHttpServer())
			.post("/auth/logout")
			.set("Cookie", cookieJar(first))
			.expect(204);
		const cleared = response.headers["set-cookie"] as unknown as string[];
		expect(cleared).toHaveLength(2);
		for (const cookie of cleared)
			expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", cookieJar(first))
			.expect(401);
		await request(app.getHttpServer())
			.get("/cookie-probe")
			.set("Cookie", cookieJar(first))
			.expect(200);
	});
	it("rejects cross-origin login before setting cookies", async () => {
		const response = await request(app.getHttpServer())
			.post("/auth/login")
			.set("Origin", "https://attacker.example")
			.send({ email: "missing@example.com", password: "password" })
			.expect(403);
		expect(response.headers["set-cookie"]).toBeUndefined();
	});
	it("rejects cross-origin refresh without consuming the valid token", async () => {
		const first = await login("csrf");
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", cookieJar(first))
			.set("Origin", "https://attacker.example")
			.expect(403);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", cookieJar(first))
			.set("Host", "api.example.com")
			.set("Origin", "http://api.example.com")
			.expect(204);
	});
	it("rejects cross-origin logout and browser mutations without Origin", async () => {
		const first = await login("logout-csrf");
		await request(app.getHttpServer())
			.post("/auth/logout")
			.set("Cookie", cookieJar(first))
			.set("Origin", "https://attacker.example")
			.expect(403);
		await request(app.getHttpServer())
			.post("/auth/logout")
			.set("Cookie", cookieJar(first))
			.set("Sec-Fetch-Site", "cross-site")
			.expect(403);
		await request(app.getHttpServer())
			.post("/auth/refresh")
			.set("Cookie", cookieJar(first))
			.expect(204);
	});
});
