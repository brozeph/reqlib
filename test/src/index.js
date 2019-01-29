import { Request, Resource } from '../../src';
import chai from 'chai';

const should = chai.should();

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

		// retries

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