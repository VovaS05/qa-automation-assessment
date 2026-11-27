import { randomUUID } from 'node:crypto';
import { expect, test as base, type APIResponse } from '@playwright/test';
import { Booker, type Booking, type CreatedBooking } from './booker';

type OwnedBooking = { id: number; initial: Booking; token: string };
type CreateBooking = (token: string) => Promise<OwnedBooking>;

export async function json(response: APIResponse, status: number): Promise<unknown> {
  expect(response.status(), `HTTP status from ${response.url()}`).toBe(status);
  expect(response.headers()['content-type']).toMatch(/^application\/json\b/i);
  return response.json();
}

export async function authenticate(booker: Booker): Promise<string> {
  const body = await json(await booker.authenticate(), 200);
  if (!body || typeof body !== 'object' || !('token' in body) ||
      typeof body.token !== 'string' || !body.token.trim()) {
    throw new Error('Booker authentication did not return a non-empty token');
  }
  return body.token;
}

export async function expectBooking(response: APIResponse, expected: Booking) {
  expect(await json(response, 200)).toEqual(expected);
}

export async function readOwnedBooking(
  booker: Booker,
  { id, initial }: OwnedBooking,
  { allowMissing = false } = {},
): Promise<unknown> {
  const response = await booker.get(id);
  if (allowMissing && response.status() === 404) return undefined;

  const body = await json(response, 200);
  if (!body || typeof body !== 'object' ||
      !('firstname' in body) || body.firstname !== initial.firstname ||
      !('lastname' in body) || body.lastname !== initial.lastname) {
    throw new Error(`Refusing to mutate booking ${id} without ownership marker ${initial.lastname}`);
  }
  return body;
}

export const test = base.extend<{ booker: Booker; isolatedBooker: Booker; createBooking: CreateBooking }>({
  booker: async ({ request }, use) => {
    await use(new Booker(request));
  },

  isolatedBooker: async ({ playwright, baseURL }, use) => {
    const request = await playwright.request.newContext({ baseURL });
    try {
      await use(new Booker(request));
    } finally {
      await request.dispose();
    }
  },

  createBooking: [async ({ booker }, use, testInfo) => {
    let marker: string | undefined;
    let owned: OwnedBooking | undefined;

    try {
      await use(async (token) => {
        if (marker) throw new Error('This fixture supports one booking creation attempt per test');
        marker = `QA-${randomUUID()}`;

        const initial: Booking = {
          firstname: 'Assessment',
          lastname: marker,
          totalprice: 145,
          depositpaid: true,
          bookingdates: { checkin: '2030-04-10', checkout: '2030-04-13' },
          additionalneeds: 'Breakfast',
        };
        let status: number | undefined;
        try {
          const response = await booker.create(initial);
          status = response.status();
          const body: unknown = await response.json().catch(() => {
            throw new Error(`Create booking returned non-JSON (HTTP ${status})`);
          });

          // Keep any usable ID so teardown can check ownership after a rejected response.
          const id = body && typeof body === 'object' && 'bookingid' in body ? body.bookingid : undefined;
          if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) {
            owned = { id, initial, token };
          }

          expect(status, 'Create booking status').toBe(200);
          expect(response.headers()['content-type']).toMatch(/^application\/json\b/i);
          if (!owned) throw new Error('Create booking did not return a valid ID');

          const expected: CreatedBooking = { bookingid: owned.id, booking: initial };
          expect(body).toEqual(expected);
          return owned;
        } catch (error) {
          await testInfo.attach('booking creation failure', {
            body: [
              `Ownership marker: ${marker}`,
              `HTTP status: ${status ?? 'unavailable'}`,
              `Booking ID: ${owned?.id ?? 'unavailable'}`,
            ].join('\n'),
            contentType: 'text/plain',
          });
          throw error;
        }
      });
    } finally {
      if (owned) {
        const { id, initial, token } = owned;
        try {
          if ((await readOwnedBooking(booker, owned, { allowMissing: true })) !== undefined) {
            expect((await booker.delete(id, token)).status(), `Cleanup DELETE for booking ${id}`).toBe(201);
            expect((await booker.get(id)).status(), `Booking ${id} after cleanup`).toBe(404);
          }
        } catch (error) {
          await testInfo.attach('booking cleanup failure', {
            body: `Booking ID: ${id}\nOwnership marker: ${initial.lastname}`,
            contentType: 'text/plain',
          });
          throw error;
        }
      }
    }
  }, { timeout: 45_000 }],
});

export { expect };
