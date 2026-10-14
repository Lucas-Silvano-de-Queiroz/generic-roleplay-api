import { Buffer } from "node:buffer";
import { z } from "zod";

const uuid = z.string().uuid();
const alt = z.string().max(500);
const checksum = z
	.string()
	.regex(/^(?:[A-Za-z0-9+/]{4}){10}[A-Za-z0-9+/]{3}=$/)
	.refine((value) => {
		const bytes = Buffer.from(value, "base64");
		return bytes.length === 32 && bytes.toString("base64") === value;
	});

export const destinationSchema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("system-cover"),
			id: uuid,
			expectedCoverMediaId: uuid.nullable(),
		})
		.strict(),
	z
		.object({
			kind: z.literal("collection-cover"),
			id: uuid,
			expectedCoverMediaId: uuid.nullable(),
		})
		.strict(),
	z.object({ kind: z.literal("record-image"), id: uuid }).strict(),
]);

export const reserveUploadSchema = z
	.object({
		destination: destinationSchema,
		fileName: z
			.string()
			.min(1)
			.max(255)
			.refine(
				(value) =>
					!Array.from(value).some((character) => {
						const code = character.charCodeAt(0);
						return code <= 0x1f || code === 0x7f;
					}),
			),
		contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
		sizeBytes: z
			.number()
			.int()
			.min(1)
			.max(10 * 1024 * 1024),
		checksumSha256: checksum,
		alt: alt.optional().default(""),
	})
	.strict();

export const completeBodySchema = z.object({}).strict();
export const patchMediaSchema = z.object({ alt }).strict();
export const emptyBodySchema = z.object({}).strict();
export const mediaIdSchema = uuid;

export type ReserveUpload = z.infer<typeof reserveUploadSchema>;
export type MediaDestination = z.infer<typeof destinationSchema>;

export type MediaImage = {
	id: string;
	destination: { kind: MediaDestination["kind"]; id: string };
	fileName: string;
	alt: string;
	contentType: "image/webp";
	sizeBytes: number;
	width: number;
	height: number;
	createdAt: string;
	updatedAt: string;
};

export type UploadAuthorization = {
	id: string;
	state: "pending";
	upload: {
		method: "PUT";
		url: string;
		headers: Record<string, string>;
		expiresAt: string;
	};
	completeBefore: string;
};
