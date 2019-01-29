import events from 'events';
import http from 'http';
import https from 'https';
import qs from 'querystring';
import url from 'url';

const
	DEFAULTS = {
		HTTP_ERROR_CODE_RETRY_THRESHHOLD : 500,
		HTTP_ERROR_CODE_THRESHHOLD : 400,
		MAX_REDIRECT_COUNT : 5,
		MAX_RETRY_COUNT : 3,
		TIMEOUT : 60000
	},
	EVENTS = {
		error : 'error',
		request :'request',
		response : 'response',
		retry : 'retry'
	},
	// reference: https://en.wikipedia.org/wiki/List_of_HTTP_status_codes#3xx_Redirection
	HTTP_STATUS_CODES = {
		PROXY_REQUIRED : 305,
		REDIRECT_CODE_PERM : 301,
		REDIRECT_CODE_TEMP : 302,
		REDIRECT_NEW_CODE_PERM : 308,
		REDIRECT_NEW_CODE_TEMP : 307
	},
	RE_CHARSET = /\ charset\=(a-z\-0-9)*/i,
	RE_CONTENT_TYPE_JSON = /json/i,
	RE_CONTENT_TYPE_TEXT = /json|xml|yaml|html|text|jwt/i,
	RE_TLS_PROTOCOL = /^https\:?/i,
	RE_URL_PARAMETERS = /(\/\:([a-z0-9\_\-\~\.]*))*/gi,
	SUPPORTED_REQUEST_OPTIONS = [
		'agent',
		'auth',
		'family',
		'headers',
		'host',
		'hostname',
		//'keepAlive', // custom
		//'keepAliveMsecs', // custom
		'localAddress',
		'maxRetryCount', // custom
		'method',
		'path',
		'pathname',
		'port',
		'protocol', // use to determine HTTPS or HTTP
		'query', // custom
		'rejectUnauthorized',
		'socketPath',
		'timeout'
	];

function coalesce (...args) {
	return args.filter((value) => !isEmpty(value))[0];
}

function isEmpty (value) {
	return (value === null || [
		typeof value === 'undefined',
		typeof value === 'string' && !value.length,
		Array.isArray(value) && !value.length,
		isObject(value) && !Object.keys(value).length
	].some((result) => result));
}

function isObject (value) {
	return ![
		value === null,
		typeof value === 'undefined',
		typeof value !== 'object',
		Array.isArray(value),
		value && value.toString && !(/^\[object\sObject\]$/.test(value.toString()))
	].some((result) => result);
}

function mergeOptions (request, options = {}) {
	let result = {};

	// ensure request options exist
	request = request || {};
	request.options = request.options || {};

	SUPPORTED_REQUEST_OPTIONS.forEach((option) => {
		let value = coalesce(options[option], request.options[option]);

		if (!isEmpty(value)) {
			result[option] = value;
		}
	});

	// TODO: apply keep-alive

	// apply retry
	result.maxRetryCount = coalesce(
		result.maxRetryCount,
		DEFAULTS.MAX_RETRY_COUNT);

	// apply timeout
	result.timeout = coalesce(
		result.timeout,
		DEFAULTS.TIMEOUT)

	// validate the query
	if (!isEmpty(result.query)) {
		// format objects using square-bracket notation
		result.query = squareBracketNotation(result.query);

		// serialization adjustments for querystring
		Object.keys(result.query).forEach((param) => {
			// ensure arrays in querystring are properly serialized...
			if (Array.isArray(result.query[param]) && result.query[param].length > 1) {
				result.query[param] = result.query[param].join(',');
				return;
			}

			// turn date objects into ISO strings
			if (result.query[param] instanceof Date) {
				result.query[param] = result.query[param].toISOString();
				return;
			}
		});

		// ensure the path is properly set
		result.path = [
			result.path,
			qs.stringify(result.query)].join('?');
	}

	return result;
}

function parseUrlPattern (urlPattern) {
	let parts = url.parse(urlPattern);

	// determine parameters within the URL (if applicable)
	parts.path
		.match(RE_URL_PARAMETERS)
		//.filter((match) => RE_URL_PARAMETERS.test(match))
		.forEach((match) => {
			let parameters = match.split(RE_URL_PARAMETERS);
			if (!parameters.length) {
				return;
			}

			// ensure parameters exist on the response
			parts.parameters = parts.parameters || [];

			// iterate each match
			parameters
				.filter((parameter) => !isEmpty(parameter))
				.forEach((parameter) => {
					// isolate the parameters from the URL
					if (!/^\//.test(parameter)) {
						parts.parameters.push({
							name : parameter,
							regEx : new RegExp(`\:${parameter}`)
						});
					}
				});
		});

	return parts;
}

function squareBracketNotation (query) {
	if (isEmpty(query)) {
		return query;
	}

	let
		buldSerializedQueryParam = (document, serializedKey = '') => Object
			.keys(document)
			.forEach((key) => {
				if (isEmpty(document[key])) {
					return;
				}

				if (!isObject(document[key])) {
					resultQuery[serializedKey ? `${serializedKey}[${key}]` : key] = document[key]
					return;
				}

				return buldSerializedQueryParam(
					document[key],
					serializedKey ? `${serializedKey}[${key}]` : key);
			}),
		resultQuery = {};

	// kick off the serialization
	buldSerializedQueryParam(query);

	return resultQuery;
}

class Request extends events.EventEmitter {
	constructor (options) {
		super();
		this.options = options;
	}

	call (options, data, callback) {
		let
			executeRequest,
			self = this,
			state = {};

		if (typeof data === 'function') {
			callback = data;
			data = '';
		}

		if (typeof options === 'function') {
			callback = options;
			data = '';
			options = {};
		}

		// ensure default values for state
		state.data = data || '';
		state.redirects = state.redirects || 0;
		state.tries = state.tries || 1;

		// serialize any provided data
		if (isObject(state.data)) {
			state.data = JSON.stringify(state.data);
		}

		// ensure default values for all request options
		options = mergeOptions(this, options);
		options.headers = options.headers || {};

		// apply content length header
		options.headers['Content-Length'] = Buffer.byteLength(state.data);

		// apply application/json header as default
		if (!options.headers['Content-Type']) {
			options.headers['Content-Type'] = 'application/json';
		}

		// apply keep-alive header when specified
		if (options.keepAlive && !options.headers['Connection']) {
			options.headers['Connection'] = 'keep-alive';
		}

		executeRequest = new Promise((resolve, reject) => {
			// emit request event
			self.emit(EVENTS.request, {
				options,
				state
			});

			let clientRequest = () => {
				let client = (RE_TLS_PROTOCOL.test(options.protocol) ? https : http).request(
					options,
					(response) => {
						let
							chunks = [],
							contentType = response.headers['content-type'],
							json = RE_CONTENT_TYPE_JSON.test(contentType),
							redirect = [
								HTTP_STATUS_CODES.REDIRECT_CODE_PERM,
								HTTP_STATUS_CODES.REDIRECT_CODE_TEMP,
								HTTP_STATUS_CODES.REDIRECT_NEW_CODE_PERM,
								HTTP_STATUS_CODES.REDIRECT_NEW_CODE_TEMP
							].some((code) => (code === response.statusCode));

						// track response headers and status
						state.headers = response.headers;
						state.statusCode = response.statusCode;

						// emit response event
						self.emit(EVENTS.response, {
							options,
							state
						});

						// determine if a proxy server is required...
						if (state.statusCode === HTTP_STATUS_CODES.PROXY_REQUIRED) {
							let err = new Error('proxy required');
							err.options = options;
							err.state = state;

							return reject(err);
						}

						// determine if a redirect has been detected
						if (redirect) {
							if (isEmpty(state.headers.location)) {
								let err = new Error('redirect requested with no location');
								err.options = options;
								err.state = state;

								return reject(err);
							}

							if (state.redirects >= DEFAULTS.MAX_REDIRECT_COUNT) {
								let err = new Error('maximum redirect limit exceeded');
								err.options = options;
								err.state = state;

								return reject(err);
							}

							// remap options and redirect to supplied URL
							let redirectUrl = url.parse(state.headers.location);
							Object.assign(options, redirectUrl);

							// increment number of redirects (to avoid endless looping)
							state.redirects ++;

							// emit redirect event
							self.emit(EVENTS.redirect, {
								options,
								state
							});

							// re-request based on the redirect location
							return setImmediate(clientRequest);
						}

						// utilize content-type to understand if response should be a stream
						// assume missing content-type header indicates text value
						if (contentType && !RE_CONTENT_TYPE_TEXT.test(contentType)) {
							if (context.statusCode >= DEFAULTS.HTTP_ERROR_CODE_THRESHHOLD) {
								let err = new Error('HTTP error received for streaming Content-Type');
								err.options = options;
								err.state = state;
								err.stream = response;

								return reject(err);
							}

							return resolve(response);
						}

						// handle the response encoding...
						if (!isEmpty(contentType)) {
							let contentParts = contentType.split(RE_CHARSET);

							// if a charset was specified, apply it
							if (contentParts.length > 1) {
								response.setEncoding(contentParts[contentParts.length - 1]);
							}
						}

						response.on('data', (chunk) => chunks.push(chunk));

						response.on('end', () => {
							let
								body = chunks.join(''),
								error = state.statusCode >= DEFAULTS.HTTP_ERROR_CODE_THRESHOLD,
								retry =
									state.statusCode >= DEFAULTS.HTTP_ERROR_CODE_RETRY_THRESHHOLD &&
									state.tries <= options.maxRetryCount;

							if (json) {
								try {
									body = JSON.parse(body);
								} catch (ex) {
									let err = new Error('unable to parse JSON from response');
									err.body = body;
									err.options = options;
									err.state = state;

									return reject(err);
								}
							}

							// retry request when an error above the threshhold is received
							if (retry) {
								// emit retry event
								self.emit(EVENTS.retry, {
									body,
									options,
									state
								});

								// increment try count
								state.tries += 1;

								return clientRequest();
							}

							if (error) {
								let err = new Error('HTTP error received');
								err.body = body;
								err.options = options;
								err.state = state;

								return reject(err);
							}

							return resolve(body);
						});
					});

				client.on(EVENTS.error, (err) => {
					// retry if below retry count threshhold
					if (state.tries <= options.maxRetryCount) {
						state.tries += 1;
						return setImmediate(clientRequest);
					}

					return reject(err)
				});

				// apply request timeout
				if (options.timeout) {
					client.setTimeout(options.timeout, client.abort);
				}

				// send data
				if (state.data) {
					client.write(state.data);
				}

				// finish up the client stream and end to send
				client.end();
			};

			clientRequest();
		});

		// return Promise for async/await or then/catch
		if (isEmpty(callback)) {
			return executeRequest;
		}

		// execute and return results in callback
		return executeRequest
			.then((result) => callback(null, result))
			.catch(callback);
	}

	getOptions (options = {}) {
		return mergeOptions(this, options);
	}

	// delete
	async delete (options = {}, callback) {
		options.method = 'DELETE';
		return await this.call(options, callback);
	}

	// get
	async get (options = {}, callback) {
		options.method = 'GET';
		return await this.call(options, callback);
	}

	// head
	async head (options = {}, callback) {
		options.method = 'HEAD';
		return await this.call(options, callback);
	}

	// patch
	async patch (options = {}, data, callback) {
		options.method = 'PATCH';
		return await this.call(options, data, callback);
	}

	// post
	async post (options = {}, data, callback) {
		options.method = 'POST';
		return await this.call(options, data, callback);
	}

	// put
	async put (options = {}, data, callback) {
		options.method = 'PUT';
		return await this.call(options, data, callback);
	}
}

class Resource {
	constructor (urlPattern, options) {
		if (isEmpty(urlPattern)) {
			throw new Error('urlPattern argument is required');
		}

		this.request = new Request(options);
		this.urlParts = parseUrlPattern(urlPattern);
	}

	async create (data, callback) {
		let options = this.urlParts;

		return await this.request.post(options, data, callback);
	}

	async delete (...args) {
		let
			callback = args && typeof args[args.length - 1] === 'function' ?
				args[args.length - 1] :
				callback,
			options = this.urlParts;

		// TODO: map values based on urlParts.parameters
		options.query = args;

		return await this.request.delete(options, callback);
	}

	async retrieve (...args) {
		let
			callback = args && typeof args[args.length - 1] === 'function' ?
				args[args.length - 1] :
				callback,
			options = this.urlParts;

		// TODO: map values based on urlParts.parameters
		options.query = args;

		return await this.request.get(options, callback);
	}

	async update (data, callback) {
		let options = this.urlParts;

		return await this.request.put(options, data, callback);
	}
}

module.exports = { Request, Resource };