import * as url from 'url';
import { RequestBody, ResponseBody, ShortUrl } from './model';

const INITIAL_SEQUENCE_NUMBER = 100000;

export interface Env {
	[x: string]: any;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		switch (request.method) {
			case 'POST':
				return await handlePostRequest(request, env);
			case 'GET':
			default:
				return await handleGetRequest(request, env);

		}
	},
};

async function handleGetRequest(
	request: Request,
	env: Env
): Promise<Response> {
	let url_parts = url.parse(request.url);
	let path = url_parts.pathname;

	if (path == null || path.split(/\/(?=.)/).length !== 2) {
		console.info("No short URL key provided. Returning 400");
		return new Response("No short URL key provided.", {
			status: 400
		});
	}

	let pathParts = path?.split("/");
	if (pathParts[1] === "favicon.ico") {
		return new Response();
	}

	let key = pathParts[1];

	console.info(`Looking for the target URL with key ${key}`);

	let shortUrlJson = await env.SHORT_URL.get(key);
	if (shortUrlJson === null) {
		console.info(`No target URL found for key ${key}`);
		return new Response("No target URL found", {
			status: 404
		});
	}

	let shortUrlObject = JSON.parse(shortUrlJson) as ShortUrl;

	console.info(`Target URL for key ${key} is ${shortUrlObject.url}`);
	env.SHORT_URL_ANALYTICS.writeDataPoint({
		operation: 'get',
		targetUrl: shortUrlObject.url,
		shortUrlKey: key,
	});

	return Response.redirect(shortUrlObject.url, 302);
}

async function handlePostRequest(
	request: Request,
	env: Env
): Promise<Response> {
	let requestBody = await request.json() as RequestBody;
	let targetUrl = requestBody.url!;

	console.info(`Creating a short URL for target ${targetUrl}`);

	let existingShortUrl = await env.SHORT_URL_MAPPING.get(targetUrl) as string;
	if (existingShortUrl !== null) {
		console.info(`Existing short URL key ${existingShortUrl} found for ${targetUrl}`);
		let responseBody = new ResponseBody(existingShortUrl);
		return new Response(
			JSON.stringify(responseBody),
			{
				status: 201,
				headers: {
					'content-type': 'application/json'
				}
			});
	}

	let curentSequence = await getCurrentSequence(env);
	let key = string10to62(curentSequence);

	let data = new ShortUrl(targetUrl);

	await env.SHORT_URL.put(key, JSON.stringify(data));
	await env.SHORT_URL_MAPPING.put(targetUrl, key);
	await env.SHORT_URL.put("sequence", `${++curentSequence}`);

	console.info(`Created a new short URL key ${key} for ${targetUrl}`);

	env.SHORT_URL_ANALYTICS.writeDataPoint({
		operation: 'create',
		targetUrl: targetUrl,
		shortUrlKey: key,
	});

	let responseBody = new ResponseBody(key);
	return new Response(
		JSON.stringify(responseBody),
		{
			status: 201,
			headers: {
				'content-type': 'application/json'
			}
		});
}

async function getCurrentSequence(env: Env): Promise<number> {
	let currentSequence = await env.SHORT_URL.get("sequence");

	if (currentSequence === null) {
		await env.SHORT_URL.put("sequence", `${INITIAL_SEQUENCE_NUMBER}`);

		return INITIAL_SEQUENCE_NUMBER;
	}

	return currentSequence;
}

/**
 * Convert a decimal number to a 62 base number
 * @param number The decimal number
 * @returns A 62 base number
 */
function string10to62(number: number) {
	var chars = '0123456789abcdefghigklmnopqrstuvwxyzABCDEFGHIGKLMNOPQRSTUVWXYZ'.split('');
	var radix = chars.length;
	var qutient = +number;
	var arr = [];
	do {
		let mod = qutient % radix;
		qutient = (qutient - mod) / radix;
		arr.unshift(chars[mod]);
	}
	while (qutient);
	return arr.join('');
}
