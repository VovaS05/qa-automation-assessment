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
        expect(response.ok(), 'Create booking returned a non-success status').toBe(true);
        const body: Partial<CreatedBooking> | null = await response.json();
        const id = body?.bookingid;

        if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
          throw new Error(`Create booking did not return a valid ID for ${initial.lastname}`);
        }
        owned = { id, initial, token };

        expect(response.status(), 'Create booking status').toBe(200);
        expect(response.headers()['content-type']).toMatch(/^application\/json\b/i);
        expect(body).toEqual({ bookingid: id, booking: initial });
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
