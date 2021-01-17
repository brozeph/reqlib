/* eslint no-console : 0 */
/* eslint no-magic-numbers : 0 */
/* eslint sort-imports : 0 */

import 'chai/register-should';
import nock from 'nock';
import { Request, Resource } from '../../src';
import { Writable } from 'stream';
import { URL } from 'url';

const HTTP_STATUS_CODES = {
		CONFLICT : 413,
		PROXY_REQUIRED : 305,
		REDIRECT_CODE_PERM : 301,
		REDIRECT_CODE_TEMP : 302,
		REDIRECT_NEW_CODE_PERM : 308,
		REDIRECT_NEW_CODE_TEMP : 307,
		SERVER_ERROR : 500,
		SUCCESS : 200
	};

describe('req-lib', () => {
	describe('Request', () => {
		describe('#', () => {
			it('should allow empty options', async () => {
				let req = new Request();

				should.exist(req);
				should.not.exist(req.options);
			});

			it('should allow string as argument', async () => {
				let req = new Request('https://github.com');

				should.exist(req);
				should.exist(req.options);
			});
		});

		describe('getOptions', () => {
			it('should default values when empty options are provided', async () => {
				let
					options,
					req = new Request();

				options = req.getOptions();

				should.exist(options);
				should.exist(options.maxRedirectCount);
				should.exist(options.maxRetryCount);
				should.exist(options.timeout);
			});

			it('should properly convert optional query', async () => {
				let
					mockOptions = {
						query : {
							format : 'test',
							sort : {
								desc : [
									'field1',
									'field2'
								]
							}
						}
					},
					req = new Request(),
					resultOptions;

				resultOptions = req.getOptions(mockOptions);

				should.exist(resultOptions);
				should.exist(resultOptions.maxRetryCount);
				should.exist(resultOptions.timeout);
				should.exist(resultOptions.query);
				should.exist(resultOptions.query.format);
				resultOptions.query.format.should.equal('test');
				should.exist(resultOptions.query['sort[desc]']);
				resultOptions.query['sort[desc]'].should.equal('field1,field2');
			});
		});

		// ensure options
		describe('ensureOptions', () => {
			it('DELETE should properly parse string passed to request methods', async () => {
				nock('https://test.api.io')
					.delete('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { parsed : true });

				let
					options,
					req = new Request(),
					res;

				req.on('request', (state) => (options = state.options));

				res = await req.delete('https://test.api.io/v1/tests');

				should.exist(res);
				should.exist(res.parsed);
				res.parsed.should.equal(true);
				should.exist(options);
				should.exist(options.hostname);
				should.exist(options.path);
				should.exist(options.protocol);

				options.hostname.should.equal('test.api.io');
				options.path.should.equal('/v1/tests');
				options.protocol.should.equal('https:');
			});

			it('GET should properly parse string passed to request methods', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { parsed : true });

				let
					options,
					req = new Request(),
					res;

				req.on('request', (state) => (options = state.options));

				res = await req.get('https://test.api.io/v1/tests');

				should.exist(res);
				should.exist(res.parsed);
				res.parsed.should.equal(true);
				should.exist(options);
				should.exist(options.hostname);
				should.exist(options.path);
				should.exist(options.protocol);

				options.hostname.should.equal('test.api.io');
				options.path.should.equal('/v1/tests');
				options.protocol.should.equal('https:');
			});

			it('HEAD should properly parse string passed to request methods', async () => {
				nock('https://test.api.io')
					.head('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { parsed : true });

				let
					options,
					req = new Request();

				req.on('request', (state) => (options = state.options));

				await req.head('https://test.api.io/v1/tests');

				should.exist(options);
				should.exist(options.hostname);
				should.exist(options.path);
				should.exist(options.protocol);

				options.hostname.should.equal('test.api.io');
				options.path.should.equal('/v1/tests');
				options.protocol.should.equal('https:');
			});

			it('PATCH should properly parse string passed to request methods', async () => {
				nock('https://test.api.io')
					.patch('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { parsed : true });

				let
					options,
					req = new Request(),
					res;

				req.on('request', (state) => (options = state.options));

				res = await req.patch('https://test.api.io/v1/tests');

				should.exist(res);
				should.exist(res.parsed);
				res.parsed.should.equal(true);
				should.exist(options);
				should.exist(options.hostname);
				should.exist(options.path);
				should.exist(options.protocol);

				options.hostname.should.equal('test.api.io');
				options.path.should.equal('/v1/tests');
				options.protocol.should.equal('https:');
			});

			it('POST should properly parse string passed to request methods', async () => {
				nock('https://test.api.io')
					.post('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { parsed : true });

				let
					options,
					req = new Request(),
					res;

				req.on('request', (state) => (options = state.options));

				res = await req.post('https://test.api.io/v1/tests');

				should.exist(res);
				should.exist(res.parsed);
				res.parsed.should.equal(true);
				should.exist(options);
				should.exist(options.hostname);
				should.exist(options.path);
				should.exist(options.protocol);

				options.hostname.should.equal('test.api.io');
				options.path.should.equal('/v1/tests');
				options.protocol.should.equal('https:');
			});

			it('PUT should properly parse string passed to request methods', (done) => {
				nock('https://test.api.io')
					.put('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { parsed : true });

				let
					options,
					req = new Request();

				req.on('request', (state) => (options = state.options));

				req.put('https://test.api.io/v1/tests', (err, res) => {
					if (err) {
						return done(err);
					}

					should.exist(res);
					should.exist(res.parsed);
					res.parsed.should.equal(true);
					should.exist(options);
					should.exist(options.hostname);
					should.exist(options.path);
					should.exist(options.protocol);

					options.hostname.should.equal('test.api.io');
					options.path.should.equal('/v1/tests');
					options.protocol.should.equal('https:');

					return done();
				});
			});
		});

		// failover
		describe('host(name) failover', () => {
			it('should failover when multiple hostnames are provided', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { failedover : true });

				let
					failedOverRequestStates = [],
					req = new Request(),
					res;

				req.on('request', (context) => {
					failedOverRequestStates.push(JSON.parse(JSON.stringify(context.state)));
				});

				res = await req.get({
					hostname : [
						'fail.api.io',
						'error.api.io',
						'test.api.io'
					],
					path : '/v1/tests',
					protocol : 'https:'
				});

				should.exist(res);
				should.exist(res.failedover);
				res.failedover.should.equal(true);

				should.exist(failedOverRequestStates);
				failedOverRequestStates.length.should.equal(3);
				failedOverRequestStates[0].tries.should.equal(1);
				failedOverRequestStates[1].tries.should.equal(2);
				failedOverRequestStates[2].tries.should.equal(3);
			});

			it('should failover when multiple hostnames are provided as hostnames', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { failedover : true });

				let
					failedOverRequestStates = [],
					req = new Request(),
					res;

				req.on('request', (context) => {
					failedOverRequestStates.push(JSON.parse(JSON.stringify(context.state)));
				});

				res = await req.get({
					hostnames : [
						'fail.api.io',
						'error.api.io',
						'test.api.io'
					],
					path : '/v1/tests',
					protocol : 'https:'
				});

				should.exist(res);
				should.exist(res.failedover);
				res.failedover.should.equal(true);

				should.exist(failedOverRequestStates);
				failedOverRequestStates.length.should.equal(3);
				failedOverRequestStates[0].tries.should.equal(1);
				failedOverRequestStates[1].tries.should.equal(2);
				failedOverRequestStates[2].tries.should.equal(3);
			});

			it('should failover when multiple hosts are provided', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { failedover : true });

				let
					failedOverRequestStates = [],
					req = new Request(),
					res;

				req.on('request', (context) => {
					failedOverRequestStates.push(JSON.parse(JSON.stringify(context.state)));
				});

				res = await req.get({
					host : [
						'fail.api.io',
						'error.api.io',
						'test.api.io'
					],
					path : '/v1/tests',
					protocol : 'https:'
				});

				should.exist(res);
				should.exist(res.failedover);
				res.failedover.should.equal(true);

				should.exist(failedOverRequestStates);
				failedOverRequestStates.length.should.equal(3);
				failedOverRequestStates[0].tries.should.equal(1);
				failedOverRequestStates[1].tries.should.equal(2);
				failedOverRequestStates[2].tries.should.equal(3);
			});

			it('should failover when multiple hosts are provided as hosts', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { failedover : true });

				let
					failedOverRequestStates = [],
					req = new Request(),
					res;

				req.on('request', (context) => {
					failedOverRequestStates.push(JSON.parse(JSON.stringify(context.state)));
				});

				res = await req.get({
					hosts : [
						'fail.api.io',
						'error.api.io',
						'test.api.io'
					],
					path : '/v1/tests',
					protocol : 'https:'
				});

				should.exist(res);
				should.exist(res.failedover);
				res.failedover.should.equal(true);

				should.exist(failedOverRequestStates);
				failedOverRequestStates.length.should.equal(3);
				failedOverRequestStates[0].tries.should.equal(1);
				failedOverRequestStates[1].tries.should.equal(2);
				failedOverRequestStates[2].tries.should.equal(3);
			});

			it('should error when failover tries all hostnames provided unsuccessfully', async () => {
				let
					err,
					req = new Request();

				await (async () => {
					try {
						await req.get({
							hostname : [
								'fail.api.io',
								'error.api.io',
								'nope.api.io'
							],
							path : '/v1/tests',
							protocol : 'https:'
						});
					} catch (ex) {
						err = ex;
					}
				})();

				should.exist(err);
				err.message.should.contain('getaddrinfo ENOTFOUND nope.api.io');
			});
		});

		describe('ports within hostname', () => {
			it('should properly handle ports in hostname field', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { corrected : true });

				let
					options,
					req = new Request(),
					res;

				req.on('request', (context) => {
					options = context.options;
				});

				res = await req.get({
					hostname : 'test.api.io:443',
					path : '/v1/tests',
					protocol : 'https:'
				});

				should.exist(res);
				should.exist(res.corrected);
				res.corrected.should.equal(true);

				should.exist(options);
				should.exist(options.host);
				options.host.should.equal('test.api.io:443');
				should.exist(options.port);
				options.port.should.equal(443);
				should.exist(options.hostname);
				options.hostname.should.equal('test.api.io');
			});

			it('should properly handle invalid ports in hostname field', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { corrected : true });

				let
					options,
					req = new Request(),
					res;

				req.on('request', (context) => {
					options = context.options;
				});

				res = await req.get({
					hostname : 'test.api.io:notanumber',
					path : '/v1/tests',
					protocol : 'https:'
				});

				should.exist(res);
				should.exist(res.corrected);
				res.corrected.should.equal(true);

				should.exist(options);
				should.exist(options.host);
				options.host.should.equal('test.api.io:443');
				should.exist(options.port);
				options.port.should.equal(443);
				should.exist(options.hostname);
				options.hostname.should.equal('test.api.io');
			});

			it('should properly handle port overrides in hostname field', async () => {
				nock('https://test.api.io:3443')
					.get('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { corrected : true });

				let
					options,
					req = new Request(),
					res;

				req.on('request', (context) => {
					options = context.options;
				});

				res = await req.get({
					hostname : 'test.api.io:3443',
					path : '/v1/tests',
					protocol : 'https:'
				});

				should.exist(res);
				should.exist(res.corrected);
				res.corrected.should.equal(true);

				should.exist(options);
				should.exist(options.host);
				options.host.should.equal('test.api.io:3443');
				should.exist(options.port);
				options.port.should.equal(3443);
				should.exist(options.hostname);
				options.hostname.should.equal('test.api.io');
			});
		});

		// proxy
		describe('proxy support', () => {
			it('should properly apply proxy when supplied as an option', async () => {
				nock('http://proxy.server')
					.get((uri) => uri.includes('http://test.api.io/v1/tests'))
					.reply(HTTP_STATUS_CODES.SUCCESS, { proxy : true });

				let
					options,
					req = new Request(),
					res;

				req.on('request', (context) => {
					options = context.options;
				});

				res = await req.get({
						hostname : 'test.api.io',
						path : '/v1/tests',
						protocol : 'http:',
						proxy : 'http://proxy.server'
					});

				should.exist(res);
				should.exist(res.proxy);
				res.proxy.should.equal(true);

				should.exist(options);
				should.exist(options.headers);
				should.exist(options.headers['Host']);
				options.headers['Host'].should.equal('test.api.io');
			});

			it('should properly apply proxy with port defined', async () => {
				nock('http://proxy.server:8080')
					.get((uri) => uri.includes('http://test.api.io/v1/tests'))
					.reply(HTTP_STATUS_CODES.SUCCESS, { proxy : true });

				let
					options,
					req = new Request(),
					res;

				req.on('request', (context) => {
					options = context.options;
				});

				res = await req.get({
						hostname : 'test.api.io',
						path : '/v1/tests',
						protocol : 'http:',
						proxy : 'http://proxy.server:8080'
					});

				should.exist(res);
				should.exist(res.proxy);
				res.proxy.should.equal(true);

				should.exist(options);
				should.exist(options.headers);
				should.exist(options.headers['Host']);
				options.headers['Host'].should.equal('test.api.io');
				should.exist(options.port);
				options.port.should.equal('8080');
			});
		});

		// proxy requirement
		describe('proxy requirement', () => {
			it('should surface error when proxy is required', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply((uri, requestBody) => {
						return [
							HTTP_STATUS_CODES.PROXY_REQUIRED,
							requestBody,
							{
								'X-Original-URI' : uri
							}];
					});

				let req = new Request();

				req.get({
					hostname : 'test.api.io',
					path : '/v1/tests',
					protocol : 'https:'
				}).then(() => {
					throw new Error('should throw exception when proxy is required');
				}).catch((ex) => {
					should.exist(ex);
					ex.message.should.equal('proxy required');
				});
			});
		});

		// redirects
		describe('following redirects', () => {
			it('should surface error on redirect without location header', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply((uri, requestBody) => {
						// omit location header
						return [
							HTTP_STATUS_CODES.REDIRECT_CODE_TEMP,
							requestBody,
							{
								'X-Original-URI' : uri
							}];
					});

				let req = new Request();

				req.get({
					hostname : 'test.api.io',
					path : '/v1/tests',
					protocol : 'https:'
				}).then(() => {
					throw new Error('should throw exception when location header is missing');
				}).catch((ex) => {
					should.exist(ex);
					ex.message.should.equal('redirect requested with no location');
				});
			});

			it('should obey max redirect limit', async () => {
				let redirects = 6;

				nock('https://test.api.io')
					.get('/v1/tests')
					.times(redirects)
					.reply((uri, requestBody) => {
						return [
							HTTP_STATUS_CODES.REDIRECT_CODE_PERM,
							requestBody,
							{
								'Location': 'https://test.api.io/v1/tests',
								'X-Original-URI' : uri
							}];
					});

				let req = new Request();

				req.get({
					hostname : 'test.api.io',
					path : '/v1/tests',
					protocol : 'https:'
				}).then(() => {
					throw new Error('should throw exception when max redirect limit is exceeded');
				}).catch((ex) => {
					should.exist(ex);
				});
			});

			it('should allow max redirect override', async () => {
				let retries = 3;

				nock('https://test.api.io')
					.get('/v1/tests')
					.times(retries)
					.reply((uri, requestBody) => {
						return [
							HTTP_STATUS_CODES.REDIRECT_NEW_CODE_TEMP,
							requestBody,
							{
								'Location': 'https://test.api.io/v1/tests',
								'X-Original-URI' : uri
							}];
					});

				let req = new Request();

				req.get({
					hostname : 'test.api.io',
					maxRedirectCount : 2,
					path : '/v1/tests',
					protocol : 'https:'
				}).then(() => {
					throw new Error('should throw exception when max redirect limit is exceeded');
				}).catch((ex) => {
					should.exist(ex);
					ex.message.should.equal('maximum redirect limit exceeded');
				});
			});

			it('should follow redirects', async () => {
				let redirected = false;

				nock('https://test.api.io')
					.get('/v1/tests')
					.reply((uri, requestBody) => {
						redirected = true;
						return [
							HTTP_STATUS_CODES.REDIRECT_NEW_CODE_PERM,
							requestBody,
							{
								'Location': 'https://test.api.io/v1/redirected',
								'X-Original-URI' : uri
							}];
					});

				nock('https://test.api.io')
					.get('/v1/redirected')
					.reply(HTTP_STATUS_CODES.SUCCESS, { redirected : true });

				let
					req = new Request(),
					res = await req.get({
						hostname : 'test.api.io',
						path : '/v1/tests',
						protocol : 'https:'
					});

				should.exist(res);
				redirected.should.equal(true);
				should.exist(res.redirected);
				res.redirected.should.equal(redirected);
			});

			it('should parse protocol from previous request options if missing in location header', async () => {
				let redirected = false;

				nock('https://test.api.io')
					.get('/v1/tests')
					.reply((uri, requestBody) => {
						redirected = true;
						return [
							HTTP_STATUS_CODES.REDIRECT_NEW_CODE_PERM,
							requestBody,
							{
								// note missing protocol!
								'Location': '//test.api.io/v1/redirected',
								'X-Original-URI' : uri
							}];
					});

				nock('https://test.api.io')
					.get('/v1/redirected')
					.reply(HTTP_STATUS_CODES.SUCCESS, { redirected : true });

				let
					req = new Request(),
					res = await req.get({
						hostname : 'test.api.io',
						path : '/v1/tests',
						protocol : 'https:'
					});

				should.exist(res);
				redirected.should.equal(true);
				should.exist(res.redirected);
				res.redirected.should.equal(redirected);
			});

			it('should parse protocol from previous redirect if missing in location header', async () => {
				let redirected = false;

				nock('https://test.api.io')
					.get('/v1/tests')
					.reply((uri, requestBody) => {
						return [
							HTTP_STATUS_CODES.REDIRECT_NEW_CODE_PERM,
							requestBody,
							{
								'Location': 'https://test.api.io/v1/redirectOne',
								'X-Original-URI' : uri
							}];
					});

				nock('https://test.api.io')
					.get('/v1/redirectOne')
					.reply((uri, requestBody) => {
						redirected = true;
						return [
							HTTP_STATUS_CODES.REDIRECT_NEW_CODE_PERM,
							requestBody,
							{
								// note: missing protocol below!
								'Location': '//test.api.io/v1/redirectTwo',
								'X-Original-URI' : uri
							}];
					});

				nock('https://test.api.io')
					.get('/v1/redirectTwo')
					.reply(HTTP_STATUS_CODES.SUCCESS, { redirected : true });

				let
					req = new Request(),
					res = await req.get({
						hostname : 'test.api.io',
						path : '/v1/tests',
						protocol : 'https:'
					});

				should.exist(res);
				redirected.should.equal(true);
				should.exist(res.redirected);
				res.redirected.should.equal(redirected);
			});

			it('should event on redirect', async () => {
				let redirectedEvent;

				nock('https://test.api.io')
					.get('/v1/tests')
					.reply((uri, requestBody) => {
						return [
							HTTP_STATUS_CODES.REDIRECT_NEW_CODE_PERM,
							requestBody,
							{
								'Location': 'https://test.api.io/v1/redirected',
								'X-Original-URI' : uri
							}];
					});

				nock('https://test.api.io')
					.get('/v1/redirected')
					.reply(HTTP_STATUS_CODES.SUCCESS, { redirected : true });

				let req = new Request();

				req.on('redirect', (state) => {
					redirectedEvent = state;
				});

				await req.get({
					hostname : 'test.api.io',
					path : '/v1/tests',
					protocol : 'https:'
				});

				should.exist(redirectedEvent);
				should.exist(redirectedEvent.options);
				should.exist(redirectedEvent.state);
			});
		});

		// retries
		describe('attempting retries', () => {
			it('should not retry on client error', async () => {
				let retryEvent;

				nock('https://test.api.io')
					.get('/v1/retry')
					.reply(HTTP_STATUS_CODES.CONFLICT, { retry : true });

				let req = new Request();

				req.on('retry', (state) => {
					retryEvent = state;
					throw new Error('should not retry on client error');
				});

				await req.get({
					hostname : 'test.api.io',
					path : '/v1/retry',
					protocol : 'https:'
				}).then(() => {
					throw new Error('should not retry on client error');
				}).catch((ex) => {
					should.exist(ex);
					ex.message.should.contain('HTTP error received');
				});

				should.not.exist(retryEvent);
			});

			it('should event on retry', async () => {
				let
					retryEvent,
					tries;

				nock('https://test.api.io')
					.get('/v1/retry')
					.reply(HTTP_STATUS_CODES.SERVER_ERROR, { retry : true });

				nock('https://test.api.io')
					.get('/v1/retry')
					.reply(HTTP_STATUS_CODES.SUCCESS, { retry : true });

				let req = new Request();

				req.on('request', (state) => {
					tries = state.state.tries;
				});

				req.on('retry', (state) => {
					retryEvent = state;
				});

				await req.get({
					hostname : 'test.api.io',
					path : '/v1/retry',
					protocol : 'https:'
				});

				should.exist(tries);
				tries.should.equal(2);
				should.exist(retryEvent);
				should.exist(retryEvent.options);
				should.exist(retryEvent.state);
			});

			it('should allow max retry override', async () => {
				let retries = 3;

				nock('https://test.api.io')
					.get('/v1/retry')
					.times(retries)
					.reply(HTTP_STATUS_CODES.SERVER_ERROR, { retry : true });

				let req = new Request();

				req.get({
					hostname : 'test.api.io',
					maxRetryCount : 2,
					path : '/v1/retry',
					protocol : 'https:'
				}).then(() => {
					throw new Error('should throw exception when max retry limit is exceeded');
				}).catch((ex) => {
					should.exist(ex);
					ex.message.should.contain('HTTP error received');
				});
			});
		});

		// path and pathname
		describe('when an URL instance or string is passed to constructor', () => {
			it('should properly handle new URL in constructor', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { corrected : true });

				let
					options,
					req = new Request(new URL('https://test.api.io/v1/tests')),
					res;

				req.on('request', (context) => {
					options = context.options;
				});

				res = await req.get();

				should.exist(res);

				should.exist(options);
				should.exist(options.path);
				options.path.should.equal(options.pathname);
			});

			it('should properly handle string in constructor', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply(HTTP_STATUS_CODES.SUCCESS, { corrected : true });

				let
					options,
					req = new Request('https://test.api.io/v1/tests'),
					res;

				req.on('request', (context) => {
					options = context.options;
				});

				res = await req.get();

				should.exist(res);

				should.exist(options);
				should.exist(options.path);
				options.path.should.equal(options.pathname);
			});
		});

		// JSON parsing
		describe('response parsing', () => {
			it('should properly avoid parsing JSON based on header', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply(
						HTTP_STATUS_CODES.SUCCESS,
						'{ "test" : true }',
						{ 'Content-Type' : 'application/text' });

				let
					req = new Request(),
					res = await req.get({
						headers : {
							'content-type': 'application/text'
						},
						hostname : 'test.api.io',
						path : '/v1/tests',
						protocol : 'https:'
					});

					should.exist(res);
					res.should.be.an('string');
			});

			it('should properly parse JSON based on header', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply(
						HTTP_STATUS_CODES.SUCCESS,
						'{ "test" : true }',
						{ 'Content-Type' : 'application/json' });

				let
					req = new Request(),
					res = await req.get({
						headers : {
							'content-type': 'application/text'
						},
						hostname : 'test.api.io',
						path : '/v1/tests',
						protocol : 'https:'
					});

				should.exist(res);
				res.should.be.an('object');
				should.exist(res.test);
				res.test.should.equal(true);
			});

			it('should return response stream based on header', async () => {
				nock('https://test.api.io')
					.get('/v1/tests')
					.reply(
						HTTP_STATUS_CODES.SUCCESS,
						new Writable(),
						{ 'Content-Type' : 'application/binary' });

				let
					req = new Request(),
					res = await req.get({
						headers : {
							'content-type': 'application/text'
						},
						hostname : 'test.api.io',
						path : '/v1/tests',
						protocol : 'https:'
					});

				should.exist(res);
				res.should.be.an('object');
				res.readable.should.equal(true);
			});
		});

		// query handling
		describe('query handling', () => {
			it('should convert date types to valid ISO strings', async () => {
				nock('https://test.api.io')
					.get((uri) => uri.includes('/v1\/tests'))
					.reply(
						HTTP_STATUS_CODES.SUCCESS,
						'{ "test" : true }');

				let
					now = new Date(),
					queryNow,
					req = new Request(),
					requestState;

				req.on('request', (state) => {
					requestState = state;
				});

				await req.get({
					hostname : 'test.api.io',
					path : '/v1/tests',
					protocol : 'https:',
					query : {
						now
					}
				});

				should.exist(requestState);
				should.exist(requestState.options);
				should.exist(requestState.options.query);
				should.exist(requestState.options.query.now);
				requestState.options.query.now.should.be.an('string');
				queryNow = new Date(requestState.options.query.now);

				// should be the same time, but not the same object
				Number(queryNow).should.equal(Number(now));
				queryNow.should.not.equal(now);
			});
		});

		// non-JSON text response

		// content stream response

		// timeout
	});

	describe('Resource', () => {
		describe('#', () => {
			it('should require URL parameter', async () => {
				let res;
				(() => {
					res = new Resource();
				}).should.throw(Error, /urlPattern argument is required/);
				should.not.exist(res);
			});
		});
	});
});