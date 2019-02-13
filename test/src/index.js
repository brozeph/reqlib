import { Request, Resource } from '../../src';
import chai from 'chai';
import nock from 'nock';
import { Writable } from 'stream';

const
	HTTP_STATUS_CODES = {
		CONFLICT : 413,
		PROXY_REQUIRED : 305,
		REDIRECT_CODE_PERM : 301,
		REDIRECT_CODE_TEMP : 302,
		REDIRECT_NEW_CODE_PERM : 308,
		REDIRECT_NEW_CODE_TEMP : 307,
		SERVER_ERROR : 500,
		SUCCESS : 200
	},
	should = chai.should();

describe('req-lib', () => {
	describe('Request', () => {
		describe('#', () => {
			it('should allow empty options', async () => {
				let req = new Request();

				should.exist(req);
				should.not.exist(req.options);
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
					ex.message.should.equal('maximum redirect limit exceeded');
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
				let retryEvent;

				nock('https://test.api.io')
					.get('/v1/retry')
					.reply(HTTP_STATUS_CODES.SERVER_ERROR, { retry : true });

					nock('https://test.api.io')
						.get('/v1/retry')
						.reply(HTTP_STATUS_CODES.SUCCESS, { retry : true });

				let req = new Request();

				req.on('retry', (state) => {
					retryEvent = state;
				});

				await req.get({
					hostname : 'test.api.io',
					path : '/v1/retry',
					protocol : 'https:'
				});

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
					.get(/\/v1\/tests\?now\=[0-9a-zA-Z\.\:\%]*/g)
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