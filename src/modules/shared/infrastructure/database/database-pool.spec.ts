import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { createDatabasePool } from "./database-pool";

describe("Database pool failures", () => {
	it("handles an idle connection error without exposing connection secrets", async () => {
		const spy = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const pool = createDatabasePool("postgresql://localhost/test", 1000);
		expect(() =>
			pool.emit("error", new Error("postgresql://user:password@host/db")),
		).not.toThrow();
		expect(spy).toHaveBeenCalled();
		expect(JSON.stringify(spy.mock.calls)).not.toContain("password");
		await pool.end();
		spy.mockRestore();
	});
});
