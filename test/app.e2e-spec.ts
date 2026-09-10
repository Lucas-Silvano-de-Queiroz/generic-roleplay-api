import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeEach, describe, it } from "vitest";
import { AppModule } from "./../src/app.module";

describe("AppController (e2e)", () => {
	let app: INestApplication;

	beforeEach(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	it("/users (POST)", () => {
		const email = `e2e-create-${Date.now()}@example.com`;

		return request(app.getHttpServer())
			.post("/users")
			.send({
				name: "John Doe",
				email,
				password: "password",
			})
			.expect(201);
	});

	it("DELETE /users/me with password in body", async () => {
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
	});

	afterAll(async () => {
		await app.close();
	});
});
