import { expect, type Page } from '@playwright/test';
import { CartItems } from '../../pages/cart-items';

export const backpack = 'Sauce Labs Backpack';
export const bikeLight = 'Sauce Labs Bike Light';

export async function expectCartItems(page: Page, products: readonly { name: string; price: string }[]) {
  const items = new CartItems(page);
  await expect(items.rows).toHaveCount(products.length);
  for (const { name, price } of products) {
    const item = items.item(name);
    await expect(item.getByTestId('inventory-item-name')).toHaveText(name);
    await expect(item.getByTestId('inventory-item-price')).toHaveText(price);
    await expect(item.getByTestId('item-quantity')).toHaveText('1');
  }
}
