import type { Locator, Page } from '@playwright/test';

export type Customer = { firstName: string; lastName: string; postalCode: string };

export class CheckoutPage {
  readonly form: Locator;
  readonly error: Locator;
  readonly summary: Locator;
  readonly confirmation: Locator;

  constructor(page: Page) {
    this.form = page.getByRole('form', { name: 'Checkout information' });
    this.error = this.form.getByTestId('error');
    this.summary = page.getByTestId('checkout-summary-container');
    this.confirmation = page.getByRole('heading', { name: 'Thank you for your order!' });
  }

  async submitInformation({ firstName, lastName, postalCode }: Customer) {
    await this.form.getByTestId('firstName').fill(firstName);
    await this.form.getByTestId('lastName').fill(lastName);
    await this.form.getByTestId('postalCode').fill(postalCode);
    await this.form.getByRole('button', { name: 'Continue' }).click();
  }
}
