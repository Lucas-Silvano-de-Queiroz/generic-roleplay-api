import { uuidv7 } from "uuidv7";

export abstract class Entity<Props> {
	private readonly _id: string;
	protected readonly _props: Props;

	constructor(props: Props, id?: string) {
		this._id = id ?? uuidv7();
		this._props = props;
	}

	get id(): string {
		return this._id;
	}
}
