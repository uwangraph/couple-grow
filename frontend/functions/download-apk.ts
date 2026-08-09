/// <reference types="@cloudflare/workers-types" />

const VERSION_PATTERN = /^\d+\.\d+$/;
const RELEASES_BASE_URL = 'https://github.com/uwangraph/couple-grow/releases/download';

function errorResponse(message: string, status: number): Response {
	return Response.json(
		{ error: message },
		{
			status,
			headers: {
				'Cache-Control': 'no-store',
				'X-Content-Type-Options': 'nosniff'
			}
		}
	);
}

export const onRequest: PagesFunction = async ({ request }) => {
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'GET, HEAD' }
		});
	}

	const version = new URL(request.url).searchParams.get('version');
	if (!version || !VERSION_PATTERN.test(version)) {
		return errorResponse('Versi APK tidak valid.', 400);
	}

	const filename = `couplegrow-v${version}.apk`;
	const upstreamUrl = `${RELEASES_BASE_URL}/v${version}/${filename}`;
	const upstreamHeaders = new Headers({
		Accept: 'application/vnd.android.package-archive, application/octet-stream;q=0.9, */*;q=0.8',
		'User-Agent': 'CoupleGrow-APK-Downloader'
	});

	for (const header of ['Range', 'If-Range']) {
		const value = request.headers.get(header);
		if (value) upstreamHeaders.set(header, value);
	}

	try {
		const upstream = await fetch(upstreamUrl, {
			method: request.method,
			headers: upstreamHeaders,
			redirect: 'follow'
		});

		if (!upstream.ok || (request.method === 'GET' && !upstream.body)) {
			console.error(
				JSON.stringify({
					message: 'APK upstream request failed',
					version,
					status: upstream.status
				})
			);
			return errorResponse('APK belum tersedia. Silakan coba lagi nanti.', 502);
		}

		const headers = new Headers({
			'Content-Type': 'application/vnd.android.package-archive',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'public, max-age=3600, immutable',
			'X-Content-Type-Options': 'nosniff'
		});

		for (const header of ['Accept-Ranges', 'Content-Length', 'Content-Range', 'ETag', 'Last-Modified']) {
			const value = upstream.headers.get(header);
			if (value) headers.set(header, value);
		}

		return new Response(request.method === 'HEAD' ? null : upstream.body, {
			status: upstream.status,
			headers
		});
	} catch (error) {
		console.error(
			JSON.stringify({
				message: 'APK download proxy failed',
				version,
				error: error instanceof Error ? error.message : String(error)
			})
		);
		return errorResponse('Download APK gagal. Silakan coba lagi.', 502);
	}
};
