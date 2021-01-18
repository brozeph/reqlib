import events from 'events';
import http from 'http';
import https from 'https';
import path from 'path';
import qs from 'querystring';
import { URL } from 'url';

const
	DEFAULTS = {
		BASE_TEN : 10,
		FAILOVER_ERROR_CODES : [
			'ECONNREFUSED',
			'ECONNRESET',
			'ENOTFOUND'
		],
		HTTP_ERROR_CODE_RETRY_THRESHHOLD : 500,
		HTTP_ERROR_CODE_THRESHHOLD : 400,
		HTTP_PORT : 80,
		HTTPS_PORT : 443,
		MAX_REDIRECT_COUNT : 5,
		MAX_RETRY_COUNT : 3,
		TIMEOUT : 60000
	},
	EVENTS = {
		error : 'error',
		redirect : 'redirect',
		request :'request',
		response : 'response',
		retry : 'retry'
	},
	HTTP_HEADERS = {
		CONNECTION : 'Connection',
		CONTENT_LENGTH : 'Content-Length',
		CONTENT_TYPE : 'Content-Type',
		HOST : 'Host',
		LOCATION : 'Location'
	},
	// reference: https://en.wikipedia.org/wiki/List_of_HTTP_status_codes#3xx_Redirection
	HTTP_STATUS_CODES = {
		NO_CONTENT : 204,
		PROXY_REQUIRED : 305,
		REDIRECT_CODE_PERM : 301,
		REDIRECT_CODE_TEMP : 302,
		REDIRECT_NEW_CODE_PERM : 308,
		REDIRECT_NEW_CODE_TEMP : 307
	},
	RE_CHARSET = /\ charset\=(a-z\-0-9)*/i,
	RE_CONTENT_TYPE_JSON = /json/i,
	RE_CONTENT_TYPE_TEXT = /json|xml|yaml|html|text|jwt/i,
	RE_ENDS_WITH_S = /s$/i,
	RE_PROTOCOL_SEPARATOR = /\/{2}/,
	RE_TLS_PROTOCOL = /^https\:?/i,
	RE_URL_PARAMETERS = /(\/\:([a-z0-9\_\-\~\.]*))*/gi,
	SUPPORTED_REQUEST_OPTIONS = [
		'agent',
		'auth',
		'family',
		'headers',
		'host',
		'hostname',
		'hosts', // custom
		'hostnames', // custom
		// 'keepAlive', // custom
		// 'keepAliveMsecs', // custom
		'localAddress',
		'maxRedirectCount', // custom
		'maxRetryCount', // custom
		'method',
		'path',
		'pathname',
		'port',
		'protocol', // use to determine HTTPS or HTTP
		'proxy', // added in v1.0.9
		'query', // custom
		'rejectUnauthorized',
		'socketPath',
		'timeout'
	];

function coalesce (...args) {
	return args.filter((value) => !isEmpty(value))[0];
}

function ensureOptions (value) {
	if (!isObject(value) && typeof value === 'string') {
		return new URL(value);
	}

	return value;
}

function headerExists (headers, name) {
	return !isEmpty(headers[name]) || !isEmpty(headers[name.toLowerCase()]);
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

	// apply redirect
	result.maxRedirectCount = coalesce(
		result.maxRedirectCount,
		DEFAULTS.MAX_REDIRECT_COUNT);

	// apply retry
	result.maxRetryCount = coalesce(
		result.maxRetryCount,
		DEFAULTS.MAX_RETRY_COUNT);

	// apply timeout
	result.timeout = coalesce(
		result.timeout,
		DEFAULTS.TIMEOUT);

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
	let parts = new URL(urlPattern);

	// determine parameters within the URL (if applicable)
	parts.path
		.match(RE_URL_PARAMETERS)
		// .filter((match) => RE_URL_PARAMETERS.test(match))
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
					resultQuery[serializedKey ? `${serializedKey}[${key}]` : key] = document[key];
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

		if (typeof options === 'string') {
			this.options = new URL(options);
		} else {
			this.options = options;
		}
	}

	call (options, data, callback) {
		let
			executeRequest,
			requestContentType,
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
		state.failover = {
			index : 0,
			values : []
		};
		state.redirects = state.redirects || [];
		state.tries = state.tries || 1;

		// ensure default values for all request options
		options = mergeOptions(this, options);
		options.headers = options.headers || {};

		// check to see if content-type is specified
		requestContentType = coalesce(
			options.headers[HTTP_HEADERS.CONTENT_TYPE],
			options.headers[HTTP_HEADERS.CONTENT_TYPE.toLowerCase()]);

		// default the content type if not provided...
		if (!requestContentType) {
			// apply application/json header as default (this is opinionated)
			options.headers[HTTP_HEADERS.CONTENT_TYPE] = 'application/json';
			requestContentType = 'application/json';
		}

		// ensure serialization of data
		if (typeof state.data !== 'string' && !Buffer.isBuffer(state.data)) {
			if (RE_CONTENT_TYPE_JSON.test(requestContentType)) {
				state.data = JSON.stringify(data);
			} else if (data && data.toString && typeof data.toString === 'function') {
				state.data = data.toString();
			}

			// TODO: handle when state.data might not be a string or Buffer
		}

		// apply content length header
		if (typeof state.data === 'string') {
			options.headers[HTTP_HEADERS.CONTENT_LENGTH] =
				options.headers[HTTP_HEADERS.CONTENT_LENGTH] ||
				Buffer.byteLength(state.data);
		}

		if (Buffer.isBuffer(state.data)) {
			options.headers[HTTP_HEADERS.CONTENT_LENGTH] =
				options.headers[HTTP_HEADERS.CONTENT_LENGTH] ||
				state.data.length;
		}

		// setup failover if applicable
		['host', 'hostname', 'hostnames', 'hosts'].forEach((field) => {
			let key = RE_ENDS_WITH_S.test(field) ?
				field.slice(0, -1) :
				field;

			// if the host or hostname field value is an Array
			// map the values into the state.failover
			if (Array.isArray(options[field])) {
				state.failover.values = state.failover.values
					.concat(options[field].map((value) => ({ key, value })));

				// clear the failover settings from the options as it will be overridden
				delete options[field];
			}
		});

		// set the current default host/hostname if failover options are present
		if (state.failover.values.length) {
			options[state.failover.values[state.failover.index].key] =
				state.failover.values[state.failover.index].value;
		}

		// correct for port in the hostname field...
		if (!isEmpty(options.hostname)) {
			let portIndex = options.hostname.indexOf(':');

			if (portIndex > 0) {
				// set port, host and hostname correctly
				options.port = parseInt(
					coalesce(options.port, options.hostname.substr(portIndex + 1)),
					DEFAULTS.BASE_TEN);

				// correct port if invalid value is provided
				if (isNaN(options.port)) {
					options.port = RE_TLS_PROTOCOL.test(options.protocol) ?
						DEFAULTS.HTTPS_PORT :
						DEFAULTS.HTTPS_PORT;

					options.hostname = [
						options.hostname.substr(0, portIndex),
						options.port].join(':');
				}

				options.host = options.hostname;
				options.hostname = options.hostname.substr(0, portIndex);
			}
		}

		// apply proxy server options when specified
		if (!isEmpty(options.proxy)) {
			let
				host = options.host || options.hostname,
				proxy = new URL(options.proxy);

			// set Host header value to destination server for web proxy request
			options.headers[HTTP_HEADERS.HOST] = host;

			// ensure the path property includes the full destination URL (with port of provided)
			if (options.path.indexOf(host) < 0) {
				if (options.port && [DEFAULTS.HTTP_PORT, DEFAULTS.HTTPS_PORT].indexOf(options.port) < 0) {
					host = [host, options.port].join(':');
				}

				options.path = [
					options.secure ? 'https' : 'http',
					path.join(host, options.path)].join('://');
			}

			// Set host, hostname, port and protocol for request to web proxy server
			options.host = proxy.host;
			options.hostname = proxy.hostname;
			options.port = proxy.port;
			options.protocol = proxy.protocol;
		}

		// apply keep-alive header when specified
		/*
		if (options.keepAlive && !headerExists(options.headers, HTTP_HEADERS.CONNECTION)) {
			options.headers[HTTP_HEADERS.CONNECTION] = 'keep-alive';
		}
		//*/

		// ensure path is set
		options.path = options.path || options.pathname;

		executeRequest = new Promise((resolve, reject) => {
			let clientRequest = () => {
				// emit request event
				self.emit(EVENTS.request, {
					options,
					state
				});

				let client = (RE_TLS_PROTOCOL.test(options.protocol) ? https : http).request(
					options,
					(response) => {
						let
							chunks = [],
							contentType = coalesce(
								response.headers[HTTP_HEADERS.CONTENT_TYPE],
								response.headers[HTTP_HEADERS.CONTENT_TYPE.toLowerCase()]),
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
							if (!headerExists(state.headers, HTTP_HEADERS.LOCATION)) {
								let err = new Error('redirect requested with no location');
								err.options = options;
								err.state = state;

								return reject(err);
							}

							if (state.redirects.length >= options.maxRedirectCount) {
								let err = new Error('maximum redirect limit exceeded');
								err.options = options;
								err.state = state;

								return reject(err);
							}

							let
								location = coalesce(
									response.headers[HTTP_HEADERS.LOCATION],
									response.headers[HTTP_HEADERS.LOCATION.toLowerCase()]),
								redirectUrl;

							// set protocol when missing (i.e. location begins with '//' instead of protocol)
							if (!location.search(RE_PROTOCOL_SEPARATOR)) {
								let previousRequestProtocol = state.redirects.length ?
									state.redirects[state.redirects.length - 1].protocol :
									options.protocol;

								location = [previousRequestProtocol, location].join('');
							}

							// read location from headers
							redirectUrl = new URL(location);

							// ensure path is set
							redirectUrl.path = redirectUrl.path || redirectUrl.pathname;

							// remap options for next request
							Object.assign(options, redirectUrl);

							// increment number of redirects (to avoid endless looping)
							state.redirects.push(redirectUrl);

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
								try {
									response.setEncoding(contentParts[contentParts.length - 1]);
								} catch (ex) {
									// TODO: handle warning...
								}
							}
						}

						response.on('data', (chunk) => chunks.push(chunk));

						response.on('end', () => {
							let
								body = chunks.join(''),
								error = state.statusCode >= DEFAULTS.HTTP_ERROR_CODE_THRESHHOLD,
								retry =
									state.statusCode >= DEFAULTS.HTTP_ERROR_CODE_RETRY_THRESHHOLD &&
									state.tries <= options.maxRetryCount,
								statusCode = response.statusCode;

							if (json && statusCode !== HTTP_STATUS_CODES.NO_CONTENT && body.length) {
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
								err.statusCode = statusCode;

								return reject(err);
							}

							return resolve(body);
						});
					});

				client.on(EVENTS.error, (err) => {
					let failover = (
						state.failover.values.length &&
						err.code &&
						DEFAULTS.FAILOVER_ERROR_CODES.indexOf(err.code) !== -1);

					// check for failover
					if (failover) {
						state.tries += 1;
						state.failover.index = (
							state.failover.index === state.failover.values.length - 1 ?
								0 :
								state.failover.index + 1);

						if (state.tries <= state.failover.values.length) {
							// remove host and hostname from options to prevent conflict with prior request
							delete options.hostname;
							delete options.host;

							options[state.failover.values[state.failover.index].key] =
								state.failover.values[state.failover.index].value;

							return setImmediate(clientRequest);
						}
					}

					// retry if below retry count threshhold
					if (state.tries <= options.maxRetryCount) {
						state.tries += 1;
						return setImmediate(clientRequest);
					}

					return reject(err);
				});

				// apply request timeout
				if (options.timeout) {
					// convert timeout to a number if provided as a string
					if (typeof options.timeout === 'string') {
						options.timeout = parseInt(options.timeout, DEFAULTS.BASE_TEN);
					}

					client.setTimeout(options.timeout, client.abort);
				}

				// send data
				if (state.data && (typeof state.data === 'string' || Buffer.isBuffer(state.data))) {
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
		if (typeof options === 'function' && isEmpty(callback)) {
			callback = options;
			options = {};
		}

		options = ensureOptions(options);
		options.method = 'DELETE';
		return await this.call(options, callback);
	}

	// get
	async get (options = {}, callback) {
		if (typeof options === 'function' && isEmpty(callback)) {
			callback = options;
			options = {};
		}

		options = ensureOptions(options);
		options.method = 'GET';
		return await this.call(options, callback);
	}

	// head
	async head (options = {}, callback) {
		if (typeof options === 'function' && isEmpty(callback)) {
			callback = options;
			options = {};
		}

		options = ensureOptions(options);
		options.method = 'HEAD';
		return await this.call(options, callback);
	}

	// patch
	async patch (options = {}, data, callback) {
		if (typeof data === 'function' && isEmpty(callback)) {
			callback = data;
			data = null;
		}

		if (typeof options === 'function' && isEmpty(callback)) {
			callback = options;
			options = {};
		}

		options = ensureOptions(options);
		options.method = 'PATCH';
		return await this.call(options, data, callback);
	}

	// post
	async post (options = {}, data, callback) {
		if (typeof data === 'function' && isEmpty(callback)) {
			callback = data;
			data = null;
		}

		if (typeof options === 'function' && isEmpty(callback)) {
			callback = options;
			options = {};
		}

		options = ensureOptions(options);
		options.method = 'POST';
		return await this.call(options, data, callback);
	}

	// put
	async put (options = {}, data, callback) {
		if (typeof data === 'function' && isEmpty(callback)) {
			callback = data;
			data = null;
		}

		if (typeof options === 'function' && isEmpty(callback)) {
			callback = options;
			options = {};
		}

		options = ensureOptions(options);
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