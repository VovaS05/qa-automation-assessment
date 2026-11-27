import type { APIRequestContext, APIResponse } from '@playwright/test';

export type Booking = {
  firstname: string;
  lastname: string;
  totalprice: number;
  depositpaid: boolean;
  bookingdates: { checkin: string; checkout: string };
  additionalneeds: string;
};

export type CreatedBooking = { bookingid: number; booking: Booking };

const demoCredentials = { username: 'admin', password: 'password123' };

export class Booker {
  constructor(private readonly request: APIRequestContext) {}

  authenticate(credentials = demoCredentials) {
    return this.send('POST', '/auth', { data: credentials });
  }

  create(booking: Booking) {
    return this.send('POST', '/booking', { data: booking });
  }

  get(id: number) {
    return this.send('GET', `/booking/${id}`);
  }

  update(id: number, booking: Booking, token?: string) {
    return this.send('PUT', `/booking/${id}`, { data: booking, token });
  }

  delete(id: number, token: string) {
    return this.send('DELETE', `/booking/${id}`, { token });
  }

  private async send(
    method: string,
    path: string,
    { data, token }: { data?: object; token?: string } = {},
  ): Promise<APIResponse> {
    try {
      return await this.request.fetch(path, {
        method,
        data,
        timeout: 10_000,
        maxRedirects: 0,
        failOnStatusCode: false,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          ...(token === undefined ? {} : { Cookie: `token=${token}` }),
        },
      });
    } catch (error) {
      if (error instanceof Error && token) {
        // Request diagnostics may include the authorization header.
        throw new Error(error.message.replaceAll(token, '[redacted]'));
      }
      throw error;
    }
  }
}
