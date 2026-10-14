// Cria somente a conta e os recursos de demonstração; não envia imagens.
const { randomBytes, randomUUID } = require("node:crypto");
const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const { parseEnv } = require("node:util");
const { Pool } = require("pg");
const argon2 = require("argon2");

async function main() {
	const runtime = { ...parseEnv(readFileSync(".env", "utf8")), ...process.env };
	if (runtime.NODE_ENV !== "development")
		throw new Error("A demonstração exige NODE_ENV=development.");
	const configPath = ".env.media-demo";
	const saved = existsSync(configPath)
		? parseEnv(readFileSync(configPath, "utf8"))
		: null;
	const demo = saved ?? {
		MEDIA_DEMO_USER_ID: randomUUID(),
		MEDIA_DEMO_SYSTEM_ID: randomUUID(),
		MEDIA_DEMO_COLLECTION_ID: randomUUID(),
		MEDIA_DEMO_TEMPLATE_ID: randomUUID(),
		MEDIA_DEMO_RECORD_ID: randomUUID(),
		MEDIA_DEMO_EMAIL: `media-demo-${randomBytes(4).toString("hex")}@local.example`,
		MEDIA_DEMO_PASSWORD: randomBytes(24).toString("base64url"),
	};
	const pool = new Pool({ connectionString: runtime.DATABASE_URL });
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const existing = await client.query("SELECT id FROM users WHERE id=$1", [
			demo.MEDIA_DEMO_USER_ID,
		]);
		if (!existing.rowCount) {
			const hash = await argon2.hash(
				demo.MEDIA_DEMO_PASSWORD + runtime.PEPPER,
				{
					type: argon2.argon2id,
					memoryCost: 65536,
					timeCost: 3,
					parallelism: 4,
				},
			);
			await client.query(
				"INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)",
				[
					demo.MEDIA_DEMO_USER_ID,
					"Demonstração de imagens",
					demo.MEDIA_DEMO_EMAIL,
					hash,
				],
			);
		}
		await client.query(
			"INSERT INTO rpg_systems(id,user_id,name,description) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
			[
				demo.MEDIA_DEMO_SYSTEM_ID,
				demo.MEDIA_DEMO_USER_ID,
				"Demonstração de imagens",
				"Sistema reservado para experimentar capas e galerias.",
			],
		);
		await client.query(
			"INSERT INTO rpg_collections(id,system_id,name,identifier) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
			[
				demo.MEDIA_DEMO_COLLECTION_ID,
				demo.MEDIA_DEMO_SYSTEM_ID,
				"Personagens",
				"personagens",
			],
		);
		await client.query(
			"INSERT INTO rpg_templates(id,collection_id,name,identifier,fields) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO NOTHING",
			[
				demo.MEDIA_DEMO_TEMPLATE_ID,
				demo.MEDIA_DEMO_COLLECTION_ID,
				"Personagem",
				"personagem",
				JSON.stringify([
					{ key: "nome", label: "Nome", required: true, format: "text" },
				]),
			],
		);
		await client.query(
			"INSERT INTO rpg_records(id,template_id,values) VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO NOTHING",
			[
				demo.MEDIA_DEMO_RECORD_ID,
				demo.MEDIA_DEMO_TEMPLATE_ID,
				JSON.stringify({ nome: "Exemplo de galeria" }),
			],
		);
		const owner = await client.query(
			"SELECT s.user_id FROM rpg_records r JOIN rpg_templates t ON t.id=r.template_id JOIN rpg_collections c ON c.id=t.collection_id JOIN rpg_systems s ON s.id=c.system_id WHERE r.id=$1 AND s.id=$2",
			[demo.MEDIA_DEMO_RECORD_ID, demo.MEDIA_DEMO_SYSTEM_ID],
		);
		if (owner.rows[0]?.user_id !== demo.MEDIA_DEMO_USER_ID)
			throw new Error("Os recursos de demonstração pertencem a outra conta.");
		await client.query("COMMIT");
		writeFileSync(
			configPath,
			Object.entries(demo)
				.map(([key, value]) => `${key}=${value}`)
				.join("\n") + "\n",
			{ mode: 0o600 },
		);
		console.log(
			"Conta, sistema e registro de demonstração preparados. Credenciais gravadas apenas no arquivo local ignorado pelo Git.",
		);
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
		await pool.end();
	}
}
main().catch(() => {
	console.error("Não foi possível preparar os recursos de demonstração.");
	process.exitCode = 1;
});
