import { randomUUID } from "node:crypto";
import type { FieldDefinition } from "../../src/modules/rpg-content/domain/content.schemas";
import { DrizzleContentRepository } from "../../src/modules/rpg-content/infrastructure/database/drizzle-content.repository";
export const nameField: FieldDefinition = {
	key: "name",
	label: "Name",
	required: true,
	format: "text",
};
export async function recordTemplate(
	owner: string,
	fields: FieldDefinition[] = [
		nameField,
		{
			key: "description",
			label: "Description",
			required: false,
			format: "textarea",
		},
	],
) {
	const content = new DrizzleContentRepository();
	const system = await content.createSystem(owner, { name: "System" });
	const collection = await content.createCollection(owner, system.id, {
		name: "Magias",
		identifier: "spells",
	});
	if (!collection) throw new Error("Missing collection");
	const template = await content.createTemplate(owner, collection.id, {
		name: "Magia",
		identifier: `t_${randomUUID()}`,
		fields,
	});
	if (!template) throw new Error("Missing template");
	return { system, collection, template };
}
