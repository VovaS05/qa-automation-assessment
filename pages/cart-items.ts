import type { Locator, Page } from '@playwright/test';

export class CartItems {
  readonly rows: Locator;

  constructor(private readonly page: Page) {
    this.rows = page.getByTestId('cart-list').getByTestId('inventory-item');
  }

  item(name: string) {
    return this.rows.filter({
      has: this.page.getByTestId('inventory-item-name').getByText(name, { exact: true }),
    });
  }
}
