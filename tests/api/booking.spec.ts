import { authenticate, expect, expectBooking, test } from './booking.fixture';
import type { Booking } from './booker';

test('API-01 authenticates and completes a booking lifecycle', async ({ booker, createBooking }) => {
  const token = await test.step('Authenticate with the demo credentials', () => authenticate(booker));

  const { id, initial } = await test.step('Create and read the booking', async () => {
    const booking = await createBooking(token);
    await expectBooking(await booker.get(booking.id), booking.initial);
    return booking;
  });

  const updated: Booking = {
    ...initial,
    totalprice: 220,
    depositpaid: false,
    bookingdates: { ...initial.bookingdates, checkout: '2030-04-15' },
    additionalneeds: 'Late arrival',
  };

  await test.step('Update the booking and check persistence', async () => {
    await expectBooking(await booker.update(id, updated, token), updated);
    await expectBooking(await booker.get(id), updated);
  });

  await test.step('Delete the booking and confirm it is gone', async () => {
    expect((await booker.delete(id, token)).status(), 'Delete booking status').toBe(201);
    expect((await booker.get(id)).status(), 'Deleted booking lookup status').toBe(404);
  });
});
