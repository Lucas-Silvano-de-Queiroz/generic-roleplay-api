import { randomBytes } from "node:crypto";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import argon2 from "argon2";
import { HashServiceContract } from "modules/identity/application/contracts/hash-service.contract";
import { env } from "modules/shared/config/env";
import { BoundedWorkQueue } from "./bounded-work-queue";

@Injectable()
export class Argon2HashServiceAdapter
	implements HashServiceContract, OnModuleInit
{
	private readonly queue = new BoundedWorkQueue(
		env.HASH_CONCURRENCY,
		env.HASH_QUEUE_LIMIT,
	);
	private dummyHash!: string;
	async onModuleInit(): Promise<void> {
		this.dummyHash = await this.hashPassword(randomBytes(32).toString("hex"));
	}
	async hashPassword(password: string): Promise<string> {
		const peppered = password + env.PEPPER;
		return this.queue.run(() =>
			argon2.hash(peppered, {
				type: argon2.argon2id,
				memoryCost: 65536,
				timeCost: 3,
				parallelism: 4,
			}),
		);
	}

	async comparePassword(
		password: string,
		hash: string | null,
	): Promise<boolean> {
		const peppered = password + env.PEPPER;
		return this.queue.run(() =>
			argon2.verify(hash ?? this.dummyHash, peppered),
		);
	}
}
