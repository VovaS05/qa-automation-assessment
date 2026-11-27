import { expect, test } from '@playwright/test';
import { CartItems } from './pages/cart-items';
import { InventoryPage } from './pages/inventory';
import { LoginPage } from './pages/login';

test('BONUS: Removing the Bike Light from its details page empties the cart', async ({ page }) => {
  const login = new LoginPage(page);
  const inventory = new InventoryPage(page);
  const cart = new CartItems(page);
  const productName = 'Sauce Labs Bike Light';

  await login.signIn();
  await inventory.addToCart(productName);
  await expect(inventory.cartCount).toHaveText('1');
  await inventory.item(productName).getByTestId('inventory-item-name').click();

  await expect(page.getByRole('button', { name: 'Back to products', exact: true })).toBeVisible();
  await expect(page.getByTestId('inventory-item-name')).toHaveText(productName);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add to cart', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to cart', exact: true })).toBeEnabled();
  await expect(inventory.cartLink).toHaveAccessibleName('Cart, empty');
  await expect(inventory.cartCount).toHaveCount(0);

  await inventory.cartLink.click();
  await expect(page).toHaveURL('/cart.html');
  await expect(cart.list).toBeVisible();
  await expect(cart.rows).toHaveCount(0);
});