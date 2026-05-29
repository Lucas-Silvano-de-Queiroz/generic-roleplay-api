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
		return request(app.getHttpServer())
			.post("/users")
			.send({
				name: "John Doe",
				email: "example@example.com",
				password: "password",
			})
			.expect(201);
	});

	afterAll(async () => {
		await app.close();
	});
});
