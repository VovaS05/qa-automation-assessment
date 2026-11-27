import { expect, test } from '@playwright/test';
import { CartItems } from './pages/cart-items';
import { CheckoutPage } from './pages/checkout';
import { InventoryPage } from './pages/inventory';
import { LoginPage } from './pages/login';

test('BONUS: Recover from a missing first name and preserve the Onesie in checkout', async ({ page }) => {
  const login = new LoginPage(page);
  const inventory = new InventoryPage(page);
  const checkout = new CheckoutPage(page);
  const cartItems = new CartItems(page);

  await login.signIn();
  const onesie = await inventory.addToCart('Sauce Labs Onesie');
  await inventory.cartLink.click();
  await page.getByRole('button', { name: 'Checkout', exact: true }).click();

  await checkout.submitInformation({ firstName: '', lastName: 'Tester', postalCode: '94105' });
  await expect(checkout.error).toBeVisible();
  await expect(checkout.error).toHaveText('Error: First Name is required');
  await expect(page).toHaveURL('/checkout-step-one.html');

  await checkout.submitInformation({ firstName: 'Jamie', lastName: 'Tester', postalCode: '94105' });
  await expect(page).toHaveURL('/checkout-step-two.html');
  await expect(page.getByTestId('title')).toHaveText('Checkout: Overview');
  await expect(checkout.summary).toBeVisible();
  await expect(cartItems.rows).toHaveCount(1);
  const overviewItem = cartItems.rows.first();
  await expect(overviewItem.getByTestId('inventory-item-name')).toHaveText(onesie.name);
  await expect(overviewItem.getByTestId('item-quantity')).toHaveText('1');
  await expect(overviewItem.getByTestId('inventory-item-price')).toHaveText(onesie.price);
});