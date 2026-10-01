import { ServiceUnavailableException } from "@nestjs/common";

interface WorkItem {
	start: () => void;
	next?: WorkItem;
}

export class BoundedWorkQueue {
	private active = 0;
	private queued = 0;
	private head?: WorkItem;
	private tail?: WorkItem;
	constructor(
		private readonly concurrency: number,
		private readonly maxQueued: number,
	) {}

	run<T>(work: () => Promise<T>): Promise<T> {
		if (this.active >= this.concurrency && this.queued >= this.maxQueued) {
			return Promise.reject(
				new ServiceUnavailableException(
					"Authentication capacity exceeded. Try again later.",
				),
			);
		}
		return new Promise<T>((resolve, reject) => {
			const start = () => {
				this.active++;
				(async () => {
					try {
						resolve(await work());
					} catch (error) {
						reject(error);
					} finally {
						this.active--;
						const next = this.head;
						if (next) {
							this.head = next.next;
							if (!this.head) this.tail = undefined;
							this.queued--;
							next.start();
						}
					}
				})();
			};
			if (this.active < this.concurrency) start();
			else {
				const item = { start };
				if (this.tail) this.tail.next = item;
				else this.head = item;
				this.tail = item;
				this.queued++;
			}
		});
	}
}
