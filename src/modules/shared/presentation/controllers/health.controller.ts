import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { sql } from "drizzle-orm";
import { db } from "../../infrastructure/database/drizzle";
import { Public } from "../decorators/public.decorator";

@Controller("health")
@ApiTags("Health")
export class HealthController {
	@Public()
	@Get("ready")
	@ApiOperation({
		summary: "Verificar disponibilidade do banco e schema de segurança",
	})
	@ApiResponse({ status: 200, description: "Serviço pronto." })
	@ApiResponse({ status: 503, description: "Serviço indisponível." })
	async ready(): Promise<{ status: "ready" }> {
		try {
			const result = await db.execute<{ ready: boolean }>(
				sql`SELECT to_regclass('public.refresh_tokens') IS NOT NULL AND to_regclass('public.rate_limits') IS NOT NULL AS ready`,
			);
			if (result.rows[0]?.ready) return { status: "ready" };
		} catch {
			/* The public response must not reveal database details. */
		}
		throw new ServiceUnavailableException("Service unavailable");
	}
}
