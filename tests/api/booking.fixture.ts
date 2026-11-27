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

export const test = base.extend<{ booker: Booker; createBooking: CreateBooking }>({
  booker: async ({ request }, use) => {
    await use(new Booker(request));
  },

  createBooking: [async ({ booker }, use, testInfo) => {
    let owned: OwnedBooking | undefined;

    try {
      await use(async (token) => {
        if (owned) throw new Error('This fixture supports one owned booking per test');

        const initial: Booking = {
          firstname: 'Assessment',
          lastname: `QA-${randomUUID()}`,
          totalprice: 145,
          depositpaid: true,
          bookingdates: { checkin: '2030-04-10', checkout: '2030-04-13' },
          additionalneeds: 'Breakfast',
        };
        const response = await booker.create(initial);
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new Error(`Create booking returned non-JSON (HTTP ${response.status()}) for ${initial.lastname}`);
        }

        // Register a usable ID before asserting the response contract.
        const id = body && typeof body === 'object' && 'bookingid' in body ? body.bookingid : undefined;
        if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) {
          owned = { id, initial, token };
        }

        expect(response.status(), 'Create booking status').toBe(200);
        expect(response.headers()['content-type']).toMatch(/^application\/json\b/i);
        if (!owned) {
          throw new Error(`Create booking did not return a valid ID for ${initial.lastname}`);
        }

        const expected: CreatedBooking = { bookingid: owned.id, booking: initial };
        expect(body).toEqual(expected);
        return owned;
      });
    } finally {
      if (owned) {
        const { id, initial, token } = owned;
        try {
          const current = await booker.get(id);
          if (current.status() !== 404) {
            const body = await json(current, 200);
            expect(body, `Refusing to delete booking ${id} without its ownership marker`)
              .toMatchObject({ firstname: initial.firstname, lastname: initial.lastname });
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
