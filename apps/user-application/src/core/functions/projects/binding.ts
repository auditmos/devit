import { env } from "cloudflare:workers";
import { type ClientViewResponse, ClientViewResponseSchema } from "@repo/data-ops/project";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppError } from "@/core/errors";

interface ErrorBody {
	message?: string;
	code?: string;
}

const SlugInput = z.object({ slug: z.string().min(1) });

export const getClientView = createServerFn()
	.inputValidator((data: z.infer<typeof SlugInput>) => SlugInput.parse(data))
	.handler(async (ctx): Promise<ClientViewResponse> => {
		const response = await env.DATA_SERVICE.fetch(
			new Request(`https://data-service/projects/${ctx.data.slug}/client-view`, {
				method: "GET",
				headers: { "Content-Type": "application/json" },
			}),
		);

		if (!response.ok) {
			const body = (await response.json().catch(() => ({}))) as ErrorBody;
			throw new AppError(
				body.message || "Failed to load project",
				body.code || "API_ERROR",
				response.status,
			);
		}

		return ClientViewResponseSchema.parse(await response.json());
	});
