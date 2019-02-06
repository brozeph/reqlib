import { Request, Resource } from '../../src';
import chai from 'chai';
import nock from 'nock';

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

		// non-JSON text response

		// content stream response
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