import { authenticate, expect, expectBooking, json, test } from './booking.fixture';

test('API-02 rejects invalid credentials without issuing a token', async ({ booker }) => {
  const response = await booker.authenticate({ username: 'admin', password: 'invalid-demo-password' });
  const body = await json(response, 200);
  expect(body !== null && typeof body === 'object', 'Authentication error is a JSON object').toBe(true);
  const { token, ...error } = body as Record<string, unknown>;
  expect(Object.hasOwn(body as object, 'token'), 'Invalid credentials must not issue a token').toBe(false);
  expect(error).toEqual({ reason: 'Bad credentials' });
});

test('API-03 rejects an unauthenticated update and preserves the booking', async ({ booker, createBooking }) => {
  const { id, initial } = await createBooking(await authenticate(booker));
  await expectBooking(await booker.get(id), initial);

  const response = await booker.update(id, { ...initial, totalprice: initial.totalprice + 100 });

  expect.soft(response.status(), 'Update without authorization').toBe(403);
  await expectBooking(await booker.get(id), initial);
});

test('API-04 rejects deletion with an invalid token and preserves the booking', async ({ booker, createBooking }) => {
  const { id, initial } = await createBooking(await authenticate(booker));
  await expectBooking(await booker.get(id), initial);

  const response = await booker.delete(id, 'invalid-assessment-token');

  expect.soft(response.status(), 'Delete with an invalid token').toBe(403);
  await expectBooking(await booker.get(id), initial);
});
