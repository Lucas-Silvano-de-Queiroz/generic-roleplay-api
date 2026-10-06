import { randomUUID } from "node:crypto";
import { setImmediate as yieldToIO } from "node:timers/promises";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "../../src/modules/identity/infrastructure/database/schema/users.schema";
import {
	InvalidRecordValuesError,
	TemplateRecordsConflictError,
} from "../../src/modules/rpg-content/application/records.errors";
import { DrizzleContentRepository } from "../../src/modules/rpg-content/infrastructure/database/drizzle-content.repository";
import { DrizzleRecordsRepository } from "../../src/modules/rpg-content/infrastructure/database/drizzle-records.repository";
import { rpgRecords } from "../../src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema";
import {
	db,
	pool,
} from "../../src/modules/shared/infrastructure/database/drizzle";
import { nameField, recordTemplate } from "../setup/records.fixture";

describe("Template compatibility and concurrent records", () => {
	const owner = randomUUID(),
		content = new DrizzleContentRepository(),
		records = new DrizzleRecordsRepository();
	beforeAll(async () => {
		await db.insert(users).values({
			id: owner,
			name: "Owner",
			email: `${owner}@example.com`,
			passwordHash: "unused",
		});
	});
	afterAll(async () => {
		await db.delete(users).where(eq(users.id, owner));
		await pool.end();
	});
	it("rejects incompatible fields atomically without changing timestamps or values", async () => {
		const { template } = await recordTemplate(owner);
		const record = await records.create(owner, template.id, {
			values: { name: "Amizade", description: "Texto longo" },
		});
		for (const fields of [
			[],
			template.fields.map((field) =>
				field.key === "name" ? { ...field, key: "title" } : field,
			),
			template.fields.map((field) =>
				field.key === "name" ? { ...field, maxLength: 2 } : field,
			),
			[
				...template.fields,
				{
					key: "extra",
					label: "Extra",
					required: true,
					format: "text" as const,
				},
			],
		]) {
			await expect(
				content.updateTemplate(owner, template.id, { name: "Changed", fields }),
			).rejects.toBeInstanceOf(TemplateRecordsConflictError);
			expect(await content.findTemplate(owner, template.id)).toEqual(template);
			expect(await records.find(owner, record?.id ?? "")).toEqual(record);
		}
	});
	it("allows metadata, reordering, optional additions, unused removal and already-filled required fields", async () => {
		const { template } = await recordTemplate(owner, [
			{ ...nameField, required: false },
			{ key: "unused", label: "Unused", required: false, format: "text" },
		]);
		const record = await records.create(owner, template.id, {
			values: { name: "  Amizade  " },
		});
		const fields = [
			{
				key: "extra",
				label: "Extra",
				required: false,
				format: "textarea" as const,
			},
			{
				...nameField,
				label: "Nome",
				format: "textarea" as const,
				description: "Updated",
			},
		];
		expect(
			(
				await content.updateTemplate(owner, template.id, {
					name: "Changed",
					identifier: "new",
					description: "Desc",
					category: "anything",
					fields,
				})
			)?.fields,
		).toEqual(fields);
		expect(await records.find(owner, record?.id ?? "")).toEqual(record);
		const current = await content.findTemplate(owner, template.id);
		expect(await content.updateTemplate(owner, template.id, {})).toEqual(
			current,
		);
		expect(
			await content.updateTemplate(owner, template.id, { fields }),
		).toEqual(current);
		const empty = await recordTemplate(owner, []);
		expect(
			(
				await content.updateTemplate(owner, empty.template.id, {
					fields: [nameField],
				})
			)?.fields,
		).toEqual([nameField]);
		const blank = await recordTemplate(owner, [
			{ ...nameField, required: false },
		]);
		await records.create(owner, blank.template.id, { values: { name: " \n" } });
		await expect(
			content.updateTemplate(owner, blank.template.id, { fields: [nameField] }),
		).rejects.toBeInstanceOf(TemplateRecordsConflictError);
	});
	it("checks every batch, including an incompatible record after the first 100", async () => {
		const { template } = await recordTemplate(owner, [
			{ ...nameField, required: false },
		]);
		await db.insert(rpgRecords).values(
			Array.from({ length: 101 }, (_, i) => ({
				id: uuidv7(),
				templateId: template.id,
				values: (i === 100 ? {} : { name: "ok" }) as Record<string, string>,
			})),
		);
		await expect(
			content.updateTemplate(owner, template.id, { fields: [nameField] }),
		).rejects.toBeInstanceOf(TemplateRecordsConflictError);
		expect(await content.findTemplate(owner, template.id)).toEqual(template);
	});

	// Queue real repository operations behind an explicit PostgreSQL row lock.
	// Observe server lock waits before releasing it; ordering uses the lock queue, no sleeps.
	async function queued(
		templateId: string,
		first: () => Promise<unknown>,
		second: () => Promise<unknown>,
	) {
		const holder = await pool.connect();
		let one: Promise<PromiseSettledResult<unknown>[]> | undefined,
			two: Promise<PromiseSettledResult<unknown>[]> | undefined;
		async function waitForBlocked(total: number) {
			const deadline = Date.now() + 1500;
			while (Date.now() < deadline) {
				const result = await pool.query(
					"SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%rpg_templates%' AND cardinality(pg_blocking_pids(pid))>0",
				);
				if (result.rows[0].n >= total) return;
				await yieldToIO();
			}
			throw new Error(`Expected ${total} real template lock waiters`);
		}
		try {
			await holder.query("BEGIN");
			await holder.query(
				"SELECT id FROM rpg_templates WHERE id=$1 FOR UPDATE",
				[templateId],
			);
			one = Promise.allSettled([first()]);
			await waitForBlocked(1);
			two = Promise.allSettled([second()]);
			await waitForBlocked(2);
			await holder.query("COMMIT");
			const [a, b] = await Promise.all([one, two]);
			return [a[0], b[0]];
		} finally {
			await holder.query("ROLLBACK");
			holder.release();
			await Promise.all([one, two]);
		}
	}
	for (const mutation of ["create", "update"] as const) {
		for (const winner of ["record", "template"] as const) {
			it(`serializes ${mutation} against fields with ${winner} first`, async () => {
				const { template } = await recordTemplate(owner, [
					{ ...nameField, required: false },
				]);
				const existing =
					mutation === "update"
						? await records.create(owner, template.id, { values: {} })
						: null;
				const write = () =>
					mutation === "create"
						? records.create(owner, template.id, {
								values: { name: "Amizade" },
							})
						: records.update(owner, existing?.id ?? "", {
								values: { name: "Amizade" },
							});
				const edit = () =>
					content.updateTemplate(owner, template.id, { fields: [] });
				const [a, b] = await queued(
					template.id,
					winner === "record" ? write : edit,
					winner === "record" ? edit : write,
				);
				expect(a.status).toBe("fulfilled");
				expect(b.status).toBe("rejected");
				if (b.status !== "rejected")
					throw new Error("Expected incompatible loser");
				expect(b.reason).toBeInstanceOf(
					winner === "record"
						? TemplateRecordsConflictError
						: InvalidRecordValuesError,
				);
				const current = await content.findTemplate(owner, template.id);
				expect(current?.fields).toEqual(
					winner === "record" ? template.fields : [],
				);
				const page = await records.list(owner, template.id, { limit: 50 });
				expect(page?.items.map((r) => r.values)).toEqual(
					winner === "record"
						? [{ name: "Amizade" }]
						: mutation === "update"
							? [{}]
							: [],
				);
			});
		}
	}
	for (const winner of ["record", "delete"] as const) {
		it(`serializes template deletion with ${winner} first without exposed FK errors`, async () => {
			const { template } = await recordTemplate(owner, []);
			const write = () => records.create(owner, template.id, { values: {} }),
				remove = () => content.deleteTemplate(owner, template.id);
			const [a, b] = await queued(
				template.id,
				winner === "record" ? write : remove,
				winner === "record" ? remove : write,
			);
			expect(a.status).toBe("fulfilled");
			expect(b).toMatchObject({
				status: "fulfilled",
				value: winner === "record" ? true : null,
			});
			expect(
				await db
					.select()
					.from(rpgRecords)
					.where(eq(rpgRecords.templateId, template.id)),
			).toEqual([]);
		});
	}
});
