import type { Locator, Page } from '@playwright/test';

export class CartItems {
  readonly list: Locator;
  readonly rows: Locator;

  constructor(private readonly page: Page) {
    this.list = page.getByTestId('cart-list');
    this.rows = this.list.getByTestId('inventory-item');
  }

  item(name: string) {
    return this.rows.filter({
      has: this.page.getByTestId('inventory-item-name').getByText(name, { exact: true }),
    });
  }
}
