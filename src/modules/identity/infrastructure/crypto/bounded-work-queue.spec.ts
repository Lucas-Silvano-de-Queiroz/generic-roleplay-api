import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { BoundedWorkQueue } from "./bounded-work-queue";

describe("BoundedWorkQueue", () => {
	it("caps concurrency and refuses work beyond the bounded queue", async () => {
		const queue = new BoundedWorkQueue(1, 1);
		let release!: () => void;
		const running = queue.run(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		);
		let started = false;
		const queued = queue.run(async () => {
			started = true;
			return 42;
		});
		await expect(queue.run(async () => 0)).rejects.toBeInstanceOf(
			ServiceUnavailableException,
		);
		expect(started).toBe(false);
		release();
		await running;
		expect(await queued).toBe(42);
	});
	it("releases slots when work fails", async () => {
		const queue = new BoundedWorkQueue(1, 1);
		const failure = queue.run(async () => {
			throw new Error("failed");
		});
		const next = queue.run(async () => "recovered");
		await expect(failure).rejects.toThrow("failed");
		expect(await next).toBe("recovered");
	});
});
