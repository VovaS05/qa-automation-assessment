import { expect, test } from '@playwright/test';
import { CheckoutPage } from '../../pages/checkout';
import { InventoryPage } from '../../pages/inventory';
import { LoginPage } from '../../pages/login';
import { backpack, bikeLight, expectCartItems } from './cart-assertions';
import { dollarsToCents } from './money';

const customer = { firstName: 'Avery', lastName: 'Tester', postalCode: '94105' };

test.beforeEach(async ({ page }) => {
  await new LoginPage(page).signIn();
});

test('UI-07 places an order with the expected items and totals', async ({ page }) => {
  const inventory = new InventoryPage(page);
  const checkout = new CheckoutPage(page);

  const selected = await test.step('Add two products and start checkout', async () => {
    const items = [await inventory.addToCart(backpack), await inventory.addToCart(bikeLight)];
    await expect(inventory.cartCount).toHaveText('2');
    await inventory.cartLink.click();
    await expectCartItems(page, items);
    await page.getByRole('button', { name: 'Checkout', exact: true }).click();
    return items;
  });

  await test.step('Verify line items and totals before placing the order', async () => {
    await checkout.submitInformation(customer);
    await expect(page.getByTestId('title')).toHaveText('Checkout: Overview');
    await expectCartItems(page, selected);

    const expectedSubtotal = selected.reduce((sum, { price }) => sum + dollarsToCents(price), 0);
    const subtotalLabel = await checkout.summary.getByTestId('subtotal-label').innerText();
    const taxLabel = await checkout.summary.getByTestId('tax-label').innerText();
    const totalLabel = await checkout.summary.getByTestId('total-label').innerText();

    expect(dollarsToCents(subtotalLabel.replace(/^Item total: /, '')), 'Item subtotal').toBe(expectedSubtotal);
    const tax = dollarsToCents(taxLabel.replace(/^Tax: /, ''));
    expect(dollarsToCents(totalLabel.replace(/^Total: /, '')), 'Order total').toBe(expectedSubtotal + tax);
  });

  await test.step('Place the order and confirm the cart is cleared', async () => {
    await checkout.summary.getByRole('button', { name: 'Finish' }).click();
    await expect(page).toHaveURL('/checkout-complete.html');
    await expect(checkout.confirmation).toBeVisible();
    await expect(inventory.cartLink).toHaveAccessibleName('Cart, empty');
    await expect(inventory.cartCount).toHaveCount(0);
  });
});

test('UI-10 requires a postal code and preserves the cart when validation fails', async ({ page }) => {
  const inventory = new InventoryPage(page);
  const checkout = new CheckoutPage(page);
  const selected = await inventory.addToCart(backpack);
  await inventory.cartLink.click();
  await page.getByRole('button', { name: 'Checkout', exact: true }).click();

  await checkout.submitInformation({ ...customer, postalCode: '' });

  await expect(checkout.error).toHaveText('Error: Postal Code is required');
  await expect(page).toHaveURL('/checkout-step-one.html');
  await expect(checkout.summary).toHaveCount(0);
  await expect(inventory.cartCount).toHaveText('1');

  await checkout.form.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL('/cart.html');
  await expectCartItems(page, [selected]);
});
