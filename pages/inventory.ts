import type { Locator, Page } from '@playwright/test';

export class InventoryPage {
  readonly title: Locator;
  readonly items: Locator;
  readonly sort: Locator;
  readonly cartLink: Locator;
  readonly cartCount: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByTestId('title');
    this.items = page.getByTestId('inventory-list').getByTestId('inventory-item');
    this.sort = page.getByRole('combobox', { name: 'Sort products' });
    this.cartLink = page.getByTestId('shopping-cart-link');
    this.cartCount = this.cartLink.getByTestId('shopping-cart-badge');
  }

  item(name: string) {
    return this.items.filter({
      has: this.page.getByTestId('inventory-item-name').getByText(name, { exact: true }),
    });
  }

  async addToCart(name: string) {
    const item = this.item(name);
    const price = await item.getByTestId('inventory-item-price').innerText();
    await item.getByRole('button', { name: 'Add to cart', exact: true }).click();
    return { name, price };
  }

  readProducts() {
    return this.items.evaluateAll((items) => items.map((item) => ({
      name: item.querySelector<HTMLElement>('[data-test="inventory-item-name"]')?.innerText ?? '',
      price: item.querySelector<HTMLElement>('[data-test="inventory-item-price"]')?.innerText ?? '',
    })));
  }
}
