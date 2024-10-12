import { beforeEach, describe, expect, it } from 'vitest';

const RESPONSE_DELAY = 50;
const ABORT_DELAY = 10;

import fetchMock from '../../src/index.js';
const getDelayedOk = () =>
	new Promise((res) => setTimeout(() => res(200), RESPONSE_DELAY));

const getDelayedAbortController = (reason) => {
	const controller = new AbortController();
	setTimeout(() => controller.abort(reason), ABORT_DELAY);
	return controller;
};

describe('abortable fetch', () => {
	let fm;

	beforeEach(() => {
		fm = fetchMock.createInstance();
	});

	describe.each`
		abortReason
		${undefined}
		${'test-reason'}
	`('with abort reason $abortReason', ({ abortReason }) => {
		const expectRejected = async (...fetchArgs) => {
			const result = fm.fetchHandler(...fetchArgs);
			if (abortReason) {
				await expect(result).rejects.toBe(abortReason);
			} else {
				await expect(result).rejects.toThrowError(DOMException);
				await expect(result).rejects.toHaveProperty(
					'message',
					'This operation was aborted',
				);
				await expect(result).rejects.toHaveProperty('name', 'AbortError');
			}
		};

		it('error on signal abort', () => {
			fm.mock('*', getDelayedOk());
			return expectRejected('http://a.com', {
				signal: getDelayedAbortController(abortReason).signal,
			});
		});

		it('error on signal abort for request object', () => {
			fm.mock('*', getDelayedOk());
			return expectRejected(
				new fm.config.Request('http://a.com', {
					signal: getDelayedAbortController(abortReason).signal,
				}),
			);
		});

		it('error when signal already aborted', () => {
			fm.mock('*', 200);
			const controller = new AbortController();
			controller.abort(abortReason);
			return expectRejected('http://a.com', {
				signal: controller.signal,
			});
		});

		it('go into `done` state even when aborted', async () => {
			fm.once('http://a.com', getDelayedOk());
			await expectRejected('http://a.com', {
				signal: getDelayedAbortController(abortReason).signal,
			});
			expect(fm.done()).toBe(true);
		});

		it('will flush even when aborted', async () => {
			fm.mock('http://a.com', getDelayedOk());

			await expectRejected('http://a.com', {
				signal: getDelayedAbortController(abortReason).signal,
			});
			await fm.flush();
			expect(fm.done()).toBe(true);
		});
	});
});
