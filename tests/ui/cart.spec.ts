import { expect, test } from '@playwright/test';
import { CartItems } from '../../pages/cart-items';
import { InventoryPage } from '../../pages/inventory';
import { LoginPage } from '../../pages/login';
import { backpack, bikeLight, expectCartItems } from './cart-assertions';

test.beforeEach(async ({ page }) => {
  await new LoginPage(page).signIn();
});

test('UI-05 adds the selected products once at their catalog prices', async ({ page }) => {
  const inventory = new InventoryPage(page);
  const selected = [
    await inventory.addToCart(backpack),
    await inventory.addToCart(bikeLight),
  ];

  await expect(inventory.cartCount).toHaveText('2');
  await inventory.cartLink.click();

  await expect(page.getByTestId('title')).toHaveText('Your Cart');
  await expectCartItems(page, selected);
});

test('UI-06 removes one product and keeps the other cart line unchanged', async ({ page }) => {
  const inventory = new InventoryPage(page);
  const toRemove = await inventory.addToCart(backpack);
  const toKeep = await inventory.addToCart(bikeLight);
  await expect(inventory.cartCount).toHaveText('2');
  await inventory.cartLink.click();
  await expectCartItems(page, [toRemove, toKeep]);

  const removedRow = new CartItems(page).item(backpack);
  await removedRow.getByRole('button', { name: 'Remove', exact: true }).click();

  await expect(inventory.cartCount).toHaveText('1');
  await expect(removedRow).toHaveCount(0);
  await expectCartItems(page, [toKeep]);

  await page.getByRole('button', { name: 'Continue Shopping' }).click();
  await expect(inventory.item(backpack).getByRole('button', { name: 'Add to cart' })).toBeVisible();
  await expect(inventory.item(bikeLight).getByRole('button', { name: 'Remove', exact: true })).toBeVisible();
});
