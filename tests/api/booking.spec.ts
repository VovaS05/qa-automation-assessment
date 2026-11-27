import { authenticate, expect, expectBooking, readOwnedBooking, test } from './booking.fixture';
import type { Booking } from './booker';

test('API-01 authenticates and completes a booking lifecycle', async ({ booker, createBooking }) => {
  const token = await test.step('Authenticate with the demo credentials', () => authenticate(booker));

  const booking = await test.step('Create the booking', () => createBooking(token));
  const { id, initial } = booking;

  const updated: Booking = {
    ...initial,
    totalprice: 220,
    depositpaid: false,
    bookingdates: { ...initial.bookingdates, checkout: '2030-04-15' },
    additionalneeds: 'Late arrival',
  };

  await test.step('Read and update the owned booking', async () => {
    expect(await readOwnedBooking(booker, booking)).toEqual(initial);
    await expectBooking(await booker.update(id, updated, token), updated);
  });

  await test.step('Verify the persisted update and delete the owned booking', async () => {
    expect(await readOwnedBooking(booker, booking)).toEqual(updated);
    expect((await booker.delete(id, token)).status(), 'Delete booking status').toBe(201);
    expect((await booker.get(id)).status(), 'Deleted booking lookup status').toBe(404);
  });
});
