import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, type OpenAPIObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import request from "supertest";
import { uuidv7 } from "uuidv7";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../../src/app.module";
import { users } from "../../src/modules/identity/infrastructure/database/schema/users.schema";
import {
	createRecordSchema,
	updateRecordSchema,
} from "../../src/modules/rpg-content/domain/records.schemas";
import { rpgRecords } from "../../src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema";
import { db } from "../../src/modules/shared/infrastructure/database/drizzle";
import { configureHttpApplication } from "../../src/modules/shared/presentation/configure-http-application";
import { createOpenApiDocument } from "../../src/modules/shared/presentation/create-openapi-document";
import { accessCookie, tokensFromCookies } from "../setup/auth-cookies.fixture";

describe("Records HTTP and Swagger", () => {
	let app: INestApplication, tokenA: string, tokenB: string;
	const userIds: string[] = [];
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
	const fields = [
		{ key: "name", label: "Name", required: true, maxLength: 100 },
		{ key: "description", label: "Description", format: "textarea" },
	];
	async function tree(inputFields = fields) {
		const { body: system } = await request(app.getHttpServer())
			.post("/rpg-systems")
			.set("Cookie", tokenA)
			.send({ name: "System" })
			.expect(201);
		const { body: collection } = await request(app.getHttpServer())
			.post(`/rpg-systems/${system.id}/collections`)
			.set("Cookie", tokenA)
			.send({ name: "Magias", identifier: "spells" })
			.expect(201);
		const { body: template } = await request(app.getHttpServer())
			.post(`/rpg-collections/${collection.id}/templates`)
			.set("Cookie", tokenA)
			.send({ name: "Magia", identifier: "spell", fields: inputFields })
			.expect(201);
		return { system, collection, template };
	}
	it("implements CRUD with literal Unicode, replacement and no-op timestamps", async () => {
		const { template } = await tree();
		const base = `/rpg-templates/${template.id}/records`;
		const { body: empty } = await request(app.getHttpServer())
			.get(base)
			.set("Cookie", tokenA)
			.expect(200);
		expect(empty).toEqual({ items: [] });
		const values = {
			name: "  Amizade  ",
			description: "**Material**: visco\n\n✨ <script>alert(1)</script>",
		};
		const { body: record } = await request(app.getHttpServer())
			.post(base)
			.set("Cookie", tokenA)
			.send({ values })
			.expect(201);
		expect(record).toMatchObject({
			id: expect.any(String),
			templateId: template.id,
			values,
			createdAt: expect.any(String),
			updatedAt: expect.any(String),
		});
		const path = `/rpg-records/${record.id}`;
		expect(
			(
				await request(app.getHttpServer())
					.get(path)
					.set("Cookie", tokenA)
					.expect(200)
			).body,
		).toEqual(record);
		for (const input of [
			{},
			{ values: { description: values.description, name: values.name } },
		])
			expect(
				(
					await request(app.getHttpServer())
						.patch(path)
						.set("Cookie", tokenA)
						.send(input)
						.expect(200)
				).body,
			).toEqual(record);
		const { body: updated } = await request(app.getHttpServer())
			.patch(path)
			.set("Cookie", tokenA)
			.send({ values: { name: "Amizade" } })
			.expect(200);
		expect(updated.values).toEqual({ name: "Amizade" });
		expect(updated.createdAt).toBe(record.createdAt);
		await request(app.getHttpServer())
			.delete(path)
			.set("Cookie", tokenA)
			.expect(204);
		await request(app.getHttpServer())
			.get(path)
			.set("Cookie", tokenA)
			.expect(404);
	});
	it("authenticates all routes and returns identical missing and foreign 404s", async () => {
		const { template } = await tree();
		const nested = `/rpg-templates/${template.id}/records`;
		const { body: record } = await request(app.getHttpServer())
			.post(nested)
			.set("Cookie", tokenA)
			.send({ values: { name: "Secret" } })
			.expect(201);
		const direct = `/rpg-records/${record.id}`;
		for (const [method, path, input] of [
			["post", nested, { values: { name: "X" } }],
			["get", nested, {}],
			["get", direct, {}],
			["patch", direct, { values: { name: "X" } }],
			["delete", direct, {}],
		] as const) {
			await request(app.getHttpServer())[method](path).send(input).expect(401);
			const foreign = await request(app.getHttpServer())
				[method](path)
				.set("Cookie", tokenB)
				.send(input)
				.expect(404);
			const missing = await request(app.getHttpServer())
				[method](
					path
						.replace(template.id, randomUUID())
						.replace(record.id, randomUUID()),
				)
				.set("Cookie", tokenB)
				.send(input)
				.expect(404);
			expect(foreign.body).toEqual(missing.body);
			expect(foreign.body).toEqual({
				statusCode: 404,
				message: "Resource not found",
			});
		}
	});
	it("rejects strict payloads, query parameters, invalid UUIDs and over-sized bodies", async () => {
		const { template } = await tree();
		const base = `/rpg-templates/${template.id}/records`;
		for (const input of [
			{},
			{ values: null },
			{ values: [] },
			{ values: { name: 1 } },
			{ values: { name: false } },
			{ values: { name: "x", extra: "x" } },
			{ values: { name: " \n" } },
			{ values: { name: "x".repeat(101) } },
			{ values: { name: "x" }, templateId: template.id },
			{ values: { name: "x" }, userId: userIds[0] },
		]) {
			const { body } = await request(app.getHttpServer())
				.post(base)
				.set("Cookie", tokenA)
				.send(input)
				.expect(400);
			expect(body.message).toBe("Validation failed");
			expect(body.details).toEqual(expect.any(Array));
		}
		for (const query of [
			"limit=0",
			"limit=101",
			"limit=1.5",
			"limit=1e1",
			"limit=1&limit=2",
			"cursor=bad",
			"extra=x",
		]) {
			await request(app.getHttpServer())
				.get(`${base}?${query}`)
				.set("Cookie", tokenA)
				.expect(400);
		}
		for (const path of ["/rpg-records/bad", "/rpg-templates/bad/records"])
			await request(app.getHttpServer())
				.get(path)
				.set("Cookie", tokenA)
				.expect(400);
		await request(app.getHttpServer())
			.post(base)
			.set("Cookie", tokenA)
			.send({ values: { name: "x", description: "x".repeat(103000) } })
			.expect(413);
		const { body: record } = await request(app.getHttpServer())
			.post(base)
			.set("Cookie", tokenA)
			.send({ values: { name: "x" } })
			.expect(201);
		for (const input of [
			{ values: null },
			{ values: {} },
			{ values: { name: "x" }, id: record.id },
			{ values: { name: 4 } },
		])
			await request(app.getHttpServer())
				.patch(`/rpg-records/${record.id}`)
				.set("Cookie", tokenA)
				.send(input)
				.expect(400);
	});
	it("returns safe 409s for incompatible template edits and the record quota", async () => {
		const { template } = await tree();
		const base = `/rpg-templates/${template.id}/records`;
		const { body: record } = await request(app.getHttpServer())
			.post(base)
			.set("Cookie", tokenA)
			.send({ values: { name: "Secret" } })
			.expect(201);
		const { body: error } = await request(app.getHttpServer())
			.patch(`/rpg-templates/${template.id}`)
			.set("Cookie", tokenA)
			.send({ fields: [] })
			.expect(409);
		expect(error).toEqual({
			statusCode: 409,
			message: "Template change would invalidate existing records",
		});
		expect(JSON.stringify(error)).not.toContain(record.id);
		await db.insert(rpgRecords).values(
			Array.from({ length: 999 }, () => ({
				id: uuidv7(),
				templateId: template.id,
				values: { name: "x" },
			})),
		);
		const { body: quota } = await request(app.getHttpServer())
			.post(base)
			.set("Cookie", tokenA)
			.send({ values: { name: "x" } })
			.expect(409);
		expect(quota).toEqual({ statusCode: 409, message: "Record limit reached" });
	});
	it("paginates normally and accepts foreign, deleted and absent cursors without revealing content", async () => {
		const { template } = await tree([]);
		const base = `/rpg-templates/${template.id}/records`;
		const ids = Array.from({ length: 101 }, () => uuidv7());
		await db
			.insert(rpgRecords)
			.values(ids.map((id) => ({ id, templateId: template.id, values: {} })));
		const { body: first } = await request(app.getHttpServer())
			.get(base)
			.set("Cookie", tokenA)
			.expect(200);
		expect(first.items).toHaveLength(50);
		expect(first.nextCursor).toBe(ids[49]);
		const { body: second } = await request(app.getHttpServer())
			.get(`${base}?cursor=${first.nextCursor}`)
			.set("Cookie", tokenA)
			.expect(200);
		const { body: last } = await request(app.getHttpServer())
			.get(`${base}?cursor=${second.nextCursor}`)
			.set("Cookie", tokenA)
			.expect(200);
		expect(
			[...first.items, ...second.items, ...last.items].map((r) => r.id),
		).toEqual(ids);
		expect(last).not.toHaveProperty("nextCursor");
		const foreignTree = await request(app.getHttpServer())
			.post("/rpg-systems")
			.set("Cookie", tokenB)
			.send({ name: "Other" })
			.expect(201);
		const { body: collection } = await request(app.getHttpServer())
			.post(`/rpg-systems/${foreignTree.body.id}/collections`)
			.set("Cookie", tokenB)
			.send({ name: "Other", identifier: "other" })
			.expect(201);
		const { body: other } = await request(app.getHttpServer())
			.post(`/rpg-collections/${collection.id}/templates`)
			.set("Cookie", tokenB)
			.send({ name: "Other", identifier: "other" })
			.expect(201);
		const { body: foreign } = await request(app.getHttpServer())
			.post(`/rpg-templates/${other.id}/records`)
			.set("Cookie", tokenB)
			.send({ values: {} })
			.expect(201);
		await request(app.getHttpServer())
			.delete(`/rpg-records/${ids[50]}`)
			.set("Cookie", tokenA)
			.expect(204);
		for (const cursor of [ids[50], foreign.id, randomUUID()]) {
			const { body: page } = await request(app.getHttpServer())
				.get(`${base}?limit=100&cursor=${cursor}`)
				.set("Cookie", tokenA)
				.expect(200);
			expect(page.items.map((r: { id: string }) => r.id)).toEqual(
				ids.filter((id) => id !== ids[50] && id > cursor),
			);
		}
	});
	it("cascades HTTP parent deletion to records", async () => {
		for (const parent of ["template", "collection", "system"] as const) {
			const parents = await tree([]);
			const { body: record } = await request(app.getHttpServer())
				.post(`/rpg-templates/${parents.template.id}/records`)
				.set("Cookie", tokenA)
				.send({ values: {} })
				.expect(201);
			const path =
				parent === "template"
					? "rpg-templates"
					: parent === "collection"
						? "rpg-collections"
						: "rpg-systems";
			await request(app.getHttpServer())
				.delete(`/${path}/${parents[parent].id}`)
				.set("Cookie", tokenA)
				.expect(204);
			await request(app.getHttpServer())
				.get(`/rpg-records/${record.id}`)
				.set("Cookie", tokenA)
				.expect(404);
		}
	});
	it("documents dynamic values, pagination, cookie auth and all five operations", () => {
		const doc = createOpenApiDocument(
			app,
			new DocumentBuilder()
				.setTitle("Test")
				.setVersion("1")
				.addCookieAuth(
					"grp-access",
					{ type: "apiKey", in: "cookie" },
					"cookieAuth",
				)
				.build(),
		);
		const schemas = doc.components?.schemas as Record<
			string,
			Exclude<
				NonNullable<
					NonNullable<OpenAPIObject["components"]>["schemas"]
				>[string],
				{ $ref: string }
			>
		>;
		expect(schemas.RecordValues).toMatchObject({
			type: "object",
			additionalProperties: { type: "string", maxLength: 100000 },
		});
		expect(schemas.CreateRecordRequest).toMatchObject({
			required: ["values"],
			additionalProperties: false,
		});
		expect(schemas.UpdateRecordRequest.required ?? []).not.toContain("values");
		expect(schemas.RpgRecord.required).toEqual(
			expect.arrayContaining([
				"id",
				"templateId",
				"values",
				"createdAt",
				"updatedAt",
			]),
		);
		expect(schemas.RecordPage.required).toContain("items");
		expect(schemas.RecordPage.required).not.toContain("nextCursor");
		for (const [path, method] of [
			["/rpg-templates/{templateId}/records", "post"],
			["/rpg-templates/{templateId}/records", "get"],
			["/rpg-records/{recordId}", "get"],
			["/rpg-records/{recordId}", "patch"],
			["/rpg-records/{recordId}", "delete"],
		] as const) {
			const op = doc.paths[path][method];
			expect(op?.security).toContainEqual({ cookieAuth: [] });
			for (const code of ["400", "401", "404", "409", "413"])
				expect(op?.responses).toHaveProperty(code);
		}
		const list = doc.paths["/rpg-templates/{templateId}/records"].get;
		expect(list?.parameters).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "limit",
					schema: expect.objectContaining({
						minimum: 1,
						maximum: 100,
						default: 50,
					}),
				}),
				expect.objectContaining({
					name: "cursor",
					schema: expect.objectContaining({ format: "uuid" }),
				}),
			]),
		);
		expect(
			createRecordSchema.safeParse(schemas.CreateRecordRequest.example).success,
		).toBe(true);
		expect(
			updateRecordSchema.safeParse(schemas.UpdateRecordRequest.example).success,
		).toBe(true);
		for (const path of [
			"/users/me",
			"/rpg-systems/{systemId}",
			"/rpg-collections/{collectionId}",
			"/rpg-templates/{templateId}",
		])
			expect(doc.paths[path].delete?.description).toMatch(/registros/i);
	});
});
