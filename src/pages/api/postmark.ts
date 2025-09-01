import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
	// Project has been disabled
	return new Response(
		JSON.stringify({ 
			error: "Project Disabled",
			message: "The project has been disabled (it was part of a hackathon). To enable it, please contact me."
		}), 
		{
			status: 503,
			headers: { "Content-Type": "application/json" },
		}
	);
};