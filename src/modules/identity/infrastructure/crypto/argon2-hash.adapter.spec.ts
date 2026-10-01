import argon2 from "argon2";
import { describe, expect, it, vi } from "vitest";

vi.mock("modules/shared/config/env", () => ({
	env: {
		PEPPER: "test-pepper-for-unit-tests-only-12345",
		HASH_CONCURRENCY: 2,
		HASH_QUEUE_LIMIT: 16,
	},
}));

import { Argon2HashServiceAdapter } from "./argon2-hash.adapter";

describe("Password hashing compatibility", () => {
	it("uses the legacy work profile for unknown accounts", async () => {
		const legacyHash = await argon2.hash(
			"legacy-password-test-pepper-for-unit-tests-only-12345",
			{ type: argon2.argon2id },
		);
		const adapter = new Argon2HashServiceAdapter();
		await adapter.onModuleInit();
		const spy = vi.spyOn(argon2, "verify");
		try {
			expect(await adapter.comparePassword("wrong-password", null)).toBe(false);
			const verifiedHash = spy.mock.calls[0][0];
			expect(verifiedHash.split("$")[3]).toBe(legacyHash.split("$")[3]);
		} finally {
			spy.mockRestore();
		}
	});
	it("verifies existing hashes and rejects incorrect passwords", async () => {
		const adapter = new Argon2HashServiceAdapter();
		await adapter.onModuleInit();
		const hash = await adapter.hashPassword("correct-password");
		expect(await adapter.comparePassword("correct-password", hash)).toBe(true);
		expect(await adapter.comparePassword("wrong-password", hash)).toBe(false);
	});
});
