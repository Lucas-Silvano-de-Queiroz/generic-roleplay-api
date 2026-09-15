import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./../src/app.module";

describe("Users (e2e)", () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	describe("POST /users", () => {
		it("should create a user when the payload is valid", async () => {
			const email = `e2e-create-${Date.now()}@example.com`;

			const { body } = await request(app.getHttpServer())
				.post("/users")
				.send({
					name: "John Doe",
					email,
					password: "password",
				})
				.expect(201);

			expect(body.id).toEqual(expect.any(String));
		});

		it("should return 409 USER_ALREADY_EXISTS when the email is already in use", async () => {
			const email = `e2e-duplicated-${Date.now()}@example.com`;

			await request(app.getHttpServer())
				.post("/users")
				.send({ name: "John Doe", email, password: "password" })
				.expect(201);

			const { body } = await request(app.getHttpServer())
				.post("/users")
				.send({ name: "John Doe", email, password: "password" })
				.expect(409);

			expect(body).toMatchObject({
				statusCode: 409,
				code: "USER_ALREADY_EXISTS",
			});
		});

		it("should return 400 VALIDATION_ERROR when the payload is invalid", async () => {
			const { body } = await request(app.getHttpServer())
				.post("/users")
				.send({ name: "", email: "not-an-email", password: "123" })
				.expect(400);

			expect(body).toMatchObject({
				statusCode: 400,
				code: "VALIDATION_ERROR",
			});
			expect(body.details).toEqual(expect.any(Array));
		});
	});

	describe("DELETE /users/me", () => {
		it("should return 401 UNAUTHORIZED when no access token is provided", async () => {
			const { body } = await request(app.getHttpServer())
				.delete("/users/me")
				.send({ password: "password" })
				.expect(401);

			expect(body).toMatchObject({
				statusCode: 401,
				code: "UNAUTHORIZED",
			});
		});

		it("should delete the authenticated user when the password is correct", async () => {
			const email = `e2e-delete-${Date.now()}@example.com`;
			const password = "password";

			await request(app.getHttpServer())
				.post("/users")
				.send({ name: "John Doe", email, password })
				.expect(201);

			const { body } = await request(app.getHttpServer())
				.post("/auth/login")
				.send({ email, password })
				.expect(200);

			await request(app.getHttpServer())
				.delete("/users/me")
				.set("Authorization", `Bearer ${body.accessToken}`)
				.send({ password })
				.expect(204);

			const { body: loginAfterDelete } = await request(app.getHttpServer())
				.post("/auth/login")
				.send({ email, password })
				.expect(401);

			expect(loginAfterDelete).toMatchObject({
				statusCode: 401,
				code: "INVALID_CREDENTIALS",
			});
		});
	});
});
