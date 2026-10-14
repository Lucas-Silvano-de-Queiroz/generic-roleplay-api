import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../../src/app.module";
import { users } from "../../src/modules/identity/infrastructure/database/schema/users.schema";
import { db } from "../../src/modules/shared/infrastructure/database/drizzle";
import { configureHttpApplication } from "../../src/modules/shared/presentation/configure-http-application";
import { createOpenApiDocument } from "../../src/modules/shared/presentation/create-openapi-document";
import { accessCookie, tokensFromCookies } from "../setup/auth-cookies.fixture";

describe("RPG content HTTP", () => {
	let app: INestApplication;
	let tokenA: string;
	let tokenB: string;
	const userIds: string[] = [];
	const fields = [
		{
			key: "description",
			label: "Descripción",
			format: "textarea",
			description: "**text** <script>alert(1)</script>",
		},
		{ key: "name", label: "魔法", required: true, maxLength: 100 },
	];

	beforeAll(async () => {
		app = (
			await Test.createTestingModule({ imports: [AppModule] }).compile()
		).createNestApplication();
		configureHttpApplication(app);
		await app.init();
		async function signIn() {
			const email = `${randomUUID()}@example.com`;
			const { body: user } = await request(app.getHttpServer())
				.post("/users")
				.send({ name: "Owner", email, password: "password" })
				.expect(201);
			userIds.push(user.id);
			const response = await request(app.getHttpServer())
				.post("/auth/login")
				.send({ email, password: "password" })
				.expect(204);
			return accessCookie(tokensFromCookies(response).accessToken);
		}
		tokenA = await signIn();
		tokenB = await signIn();
	});
	afterAll(async () => {
		for (const id of userIds) await db.delete(users).where(eq(users.id, id));
		await app?.close();
	});

	async function tree() {
		const { body: system } = await request(app.getHttpServer())
			.post("/rpg-systems")
			.set("Cookie", tokenA)
			.send({ name: " Meu Sistema ", description: "世界" })
			.expect(201);
		const { body: collection } = await request(app.getHttpServer())
			.post(`/rpg-systems/${system.id}/collections`)
			.set("Cookie", tokenA)
			.send({ name: "Magias", identifier: "spells" })
			.expect(201);
		const { body: template } = await request(app.getHttpServer())
			.post(`/rpg-collections/${collection.id}/templates`)
			.set("Cookie", tokenA)
			.send({ name: "Магия", identifier: "spell", category: "自由", fields })
			.expect(201);
		return { system, collection, template };
	}

	it("creates, lists, reads, patches and deletes the full hierarchy", async () => {
		const { system, collection, template } = await tree();
		expect(system).toMatchObject({
			name: "Meu Sistema",
			description: "世界",
			createdAt: expect.any(String),
			updatedAt: expect.any(String),
		});
		expect(collection).not.toHaveProperty("description");
		expect(template.fields).toEqual([
			{ ...fields[0], required: false },
			{ ...fields[1], format: "text" },
		]);
		for (const [path, value] of [
			["rpg-systems", system],
			["rpg-collections", collection],
			["rpg-templates", template],
		] as const) {
			const { body } = await request(app.getHttpServer())
				.get(`/${path}/${value.id}`)
				.set("Cookie", tokenA)
				.expect(200);
			expect(body).toEqual(value);
			const { body: updated } = await request(app.getHttpServer())
				.patch(`/${path}/${value.id}`)
				.set("Cookie", tokenA)
				.send({ name: "Novo" })
				.expect(200);
			expect(updated.name).toBe("Novo");
			expect(updated.createdAt).toBe(value.createdAt);
			expect(Date.parse(updated.updatedAt)).toBeGreaterThan(
				Date.parse(value.updatedAt),
			);
			if (path !== "rpg-systems")
				expect(updated.identifier).toBe(value.identifier);
			if (path === "rpg-templates")
				expect(updated.fields).toEqual(template.fields);
		}
		const { body: systems } = await request(app.getHttpServer())
			.get("/rpg-systems")
			.set("Cookie", tokenA)
			.expect(200);
		expect(systems.map((s: { id: string }) => s.id)).toContain(system.id);
		const { body: collections } = await request(app.getHttpServer())
			.get(`/rpg-systems/${system.id}/collections`)
			.set("Cookie", tokenA)
			.expect(200);
		expect(collections).toHaveLength(1);
		const { body: templates } = await request(app.getHttpServer())
			.get(`/rpg-collections/${collection.id}/templates`)
			.set("Cookie", tokenA)
			.expect(200);
		expect(templates).toHaveLength(1);
		const { body: replaced } = await request(app.getHttpServer())
			.patch(`/rpg-templates/${template.id}`)
			.set("Cookie", tokenA)
			.send({ fields: [{ key: "only", label: "Only" }] })
			.expect(200);
		expect(replaced.fields).toEqual([
			{ key: "only", label: "Only", required: false, format: "text" },
		]);
		const { body: cleared } = await request(app.getHttpServer())
			.patch(`/rpg-templates/${template.id}`)
			.set("Cookie", tokenA)
			.send({ fields: [] })
			.expect(200);
		expect(cleared.fields).toEqual([]);
		for (const [path, value] of [
			["rpg-templates", template],
			["rpg-collections", collection],
			["rpg-systems", system],
		] as const) {
			await request(app.getHttpServer())
				.delete(`/${path}/${value.id}`)
				.set("Cookie", tokenA)
				.expect(204);
			await request(app.getHttpServer())
				.get(`/${path}/${value.id}`)
				.set("Cookie", tokenA)
				.expect(404);
		}
	});

	it("allows empty parents, empty templates and no-op PATCH without timestamps changing", async () => {
		const { body: system } = await request(app.getHttpServer())
			.post("/rpg-systems")
			.set("Cookie", tokenA)
			.send({ name: "Empty" })
			.expect(201);
		expect(system).not.toHaveProperty("description");
		const { body: list } = await request(app.getHttpServer())
			.get(`/rpg-systems/${system.id}/collections`)
			.set("Cookie", tokenA)
			.expect(200);
		expect(list).toEqual([]);
		const { body: collection } = await request(app.getHttpServer())
			.post(`/rpg-systems/${system.id}/collections`)
			.set("Cookie", tokenA)
			.send({ name: "Empty", identifier: "empty" })
			.expect(201);
		const { body: empty } = await request(app.getHttpServer())
			.get(`/rpg-collections/${collection.id}/templates`)
			.set("Cookie", tokenA)
			.expect(200);
		expect(empty).toEqual([]);
		const { body: template } = await request(app.getHttpServer())
			.post(`/rpg-collections/${collection.id}/templates`)
			.set("Cookie", tokenA)
			.send({ name: "Empty", identifier: "empty" })
			.expect(201);
		expect(template.fields).toEqual([]);
		expect(template).not.toHaveProperty("category");
		const { body: unchanged } = await request(app.getHttpServer())
			.patch(`/rpg-templates/${template.id}`)
			.set("Cookie", tokenA)
			.send({})
			.expect(200);
		expect(unchanged).toEqual(template);
	});

	it("returns indistinguishable 404s for foreign and missing resources in every operation", async () => {
		const { system, collection, template } = await tree();
		for (const [path, value] of [
			["rpg-systems", system],
			["rpg-collections", collection],
			["rpg-templates", template],
		] as const) {
			for (const method of ["get", "patch", "delete"] as const) {
				const { body: foreign } = await request(app.getHttpServer())
					[method](`/${path}/${value.id}`)
					.set("Cookie", tokenB)
					.send(method === "patch" ? { name: "Stolen" } : undefined)
					.expect(404);
				const { body: missing } = await request(app.getHttpServer())
					[method](`/${path}/${randomUUID()}`)
					.set("Cookie", tokenB)
					.send(method === "patch" ? { name: "Stolen" } : undefined)
					.expect(404);
				expect(foreign).toEqual(missing);
			}
			await request(app.getHttpServer())
				.get(`/${path}/${value.id}`)
				.set("Cookie", tokenA)
				.expect(200);
		}
		for (const [path, payload] of [
			[
				`/rpg-systems/${system.id}/collections`,
				{ name: "N", identifier: "valid" },
			],
			[
				`/rpg-collections/${collection.id}/templates`,
				{ name: "N", identifier: "valid" },
			],
		] as const) {
			await request(app.getHttpServer())
				.get(path)
				.set("Cookie", tokenB)
				.expect(404);
			await request(app.getHttpServer())
				.post(path)
				.set("Cookie", tokenB)
				.send(payload)
				.expect(404);
		}
		const { body } = await request(app.getHttpServer())
			.get("/rpg-systems")
			.set("Cookie", tokenB)
			.expect(200);
		expect(body).toEqual([]);
	});

	it("requires authentication on all 15 routes and rejects malformed UUIDs", async () => {
		const id = randomUUID();
		for (const [method, path] of [
			["post", "/rpg-systems"],
			["get", "/rpg-systems"],
			...["rpg-systems", "rpg-collections", "rpg-templates"].flatMap(
				(resource) =>
					["get", "patch", "delete"].map((method) => [
						method,
						`/${resource}/${id}`,
					]),
			),
			...[
				`/rpg-systems/${id}/collections`,
				`/rpg-collections/${id}/templates`,
			].flatMap((path) => ["get", "post"].map((method) => [method, path])),
		] as ["post" | "get" | "patch" | "delete", string][]) {
			await request(app.getHttpServer())
				[method](path)
				.send({ name: "N", identifier: "valid" })
				.expect(401);
		}
		for (const path of [
			"/rpg-systems/invalid",
			"/rpg-collections/invalid",
			"/rpg-templates/invalid",
			"/rpg-systems/invalid/collections",
			"/rpg-collections/invalid/templates",
		]) {
			await request(app.getHttpServer())
				.get(path)
				.set("Cookie", tokenA)
				.expect(400);
		}
	});

	it("enforces scoped identifier uniqueness in create and PATCH", async () => {
		const a = await tree();
		const b = await tree();
		for (const [path, payload] of [
			[
				`/rpg-systems/${a.system.id}/collections`,
				{ name: "N", identifier: "spells" },
			],
			[
				`/rpg-collections/${a.collection.id}/templates`,
				{ name: "N", identifier: "spell" },
			],
		] as const) {
			await request(app.getHttpServer())
				.post(path)
				.set("Cookie", tokenA)
				.send(payload)
				.expect(409);
			const { body: other } = await request(app.getHttpServer())
				.post(path)
				.set("Cookie", tokenA)
				.send({ ...payload, identifier: "other" })
				.expect(201);
			const resource = path.endsWith("collections")
				? "rpg-collections"
				: "rpg-templates";
			await request(app.getHttpServer())
				.patch(`/${resource}/${other.id}`)
				.set("Cookie", tokenA)
				.send({ identifier: payload.identifier })
				.expect(409);
			const { body: renamed } = await request(app.getHttpServer())
				.patch(`/${resource}/${other.id}`)
				.set("Cookie", tokenA)
				.send({ identifier: "renamed" })
				.expect(200);
			expect(renamed.identifier).toBe("renamed");
		}
		expect(a.collection.identifier).toBe(b.collection.identifier);
		expect(a.template.identifier).toBe(b.template.identifier);
	});

	it("rejects unknown properties, moves, null, invalid fields and excessive sizes", async () => {
		const { system, collection, template } = await tree();
		for (const payload of [
			{ name: " " },
			{ name: "a".repeat(101) },
			{ name: "N", userId: userIds[1] },
			{ name: "N", description: null },
			{ name: "N", description: "a".repeat(5001) },
		]) {
			await request(app.getHttpServer())
				.post("/rpg-systems")
				.set("Cookie", tokenA)
				.send(payload)
				.expect(400);
		}
		for (const identifier of [
			"Invalid",
			" spell",
			"2spell",
			"a".repeat(65),
			"spell\n",
		]) {
			await request(app.getHttpServer())
				.post(`/rpg-systems/${system.id}/collections`)
				.set("Cookie", tokenA)
				.send({ name: "N", identifier })
				.expect(400);
		}
		await request(app.getHttpServer())
			.patch(`/rpg-collections/${collection.id}`)
			.set("Cookie", tokenA)
			.send({ systemId: randomUUID() })
			.expect(400);
		for (const payload of [
			{ collectionId: randomUUID() },
			{ category: "a".repeat(65) },
			{ fields: null },
			{ fields: [{ key: "Invalid", label: "N" }] },
			{ fields: [{ key: "name", label: "N", banana: true }] },
			{ fields: [{ key: "name", label: "N", required: "true" }] },
			{ fields: [{ key: "name", label: "N", format: "html" }] },
			{ fields: [{ key: "name", label: "N", format: "markdown" }] },
			...[0, 100001, 1.5].map((maxLength) => ({
				fields: [{ key: "name", label: "N", maxLength }],
			})),
			{
				fields: [
					{ key: "name", label: "N" },
					{ key: "name", label: "Other" },
				],
			},
			{
				fields: Array.from({ length: 101 }, (_, i) => ({
					key: `f${i}`,
					label: "N",
				})),
			},
		]) {
			const { body } = await request(app.getHttpServer())
				.patch(`/rpg-templates/${template.id}`)
				.set("Cookie", tokenA)
				.send(payload)
				.expect(400);
			expect(body).toMatchObject({
				statusCode: 400,
				message: "Validation failed",
				details: expect.any(Array),
			});
		}
		await request(app.getHttpServer())
			.post("/rpg-systems")
			.set("Cookie", tokenA)
			.send({ name: "N", description: "a".repeat(110000) })
			.expect(413);
	});

	it.each(["system", "collection"] as const)(
		"cascades deletion of %s through templates",
		async (parent) => {
			const { system, collection, template } = await tree();
			await request(app.getHttpServer())
				.delete(
					parent === "system"
						? `/rpg-systems/${system.id}`
						: `/rpg-collections/${collection.id}`,
				)
				.set("Cookie", tokenA)
				.expect(204);
			await request(app.getHttpServer())
				.get(`/rpg-collections/${collection.id}`)
				.set("Cookie", tokenA)
				.expect(404);
			await request(app.getHttpServer())
				.get(`/rpg-templates/${template.id}`)
				.set("Cookie", tokenA)
				.expect(404);
		},
	);

	it("documents every route, strict bodies, errors and field defaults in OpenAPI", () => {
		const document = createOpenApiDocument(
			app,
			new DocumentBuilder()
				.addCookieAuth(
					"grp-access",
					{ type: "apiKey", in: "cookie" },
					"cookieAuth",
				)
				.build(),
		);
		for (const path of [
			"/rpg-systems",
			"/rpg-systems/{systemId}",
			"/rpg-systems/{systemId}/collections",
			"/rpg-collections/{collectionId}",
			"/rpg-collections/{collectionId}/templates",
			"/rpg-templates/{templateId}",
		]) {
			expect(document.paths[path]).toBeDefined();
		}
		const schema = document.components?.schemas?.FieldDefinition;
		expect(schema).toMatchObject({
			additionalProperties: false,
			properties: {
				key: { pattern: "^[a-z][a-z0-9_-]*$", maxLength: 64 },
				format: { enum: ["text", "textarea"], default: "text" },
				required: { default: false },
			},
		});
		expect(schema).toMatchObject({
			required: ["key", "label", "required", "format"],
		});
		expect(document.components?.schemas?.FieldDefinitionInput).toMatchObject({
			required: ["key", "label"],
		});
		expect(document.components?.schemas?.CreateTemplateRequest).toMatchObject({
			properties: {
				fields: {
					items: { $ref: "#/components/schemas/FieldDefinitionInput" },
				},
			},
		});
		expect(document.components?.schemas?.RpgTemplate).toMatchObject({
			properties: {
				fields: { items: { $ref: "#/components/schemas/FieldDefinition" } },
			},
		});
		const patch = document.paths["/rpg-templates/{templateId}"]?.patch;
		expect(patch?.security).toEqual([{ cookieAuth: [] }]);
		expect(patch?.responses).toHaveProperty("400");
		expect(patch?.responses).toHaveProperty("401");
		expect(patch?.responses).toHaveProperty("404");
		expect(patch?.responses).toHaveProperty("409");
	});
});
