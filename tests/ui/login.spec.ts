import { expect, test } from '@playwright/test';
import { InventoryPage } from '../../pages/inventory';
import { LoginPage, standardUser } from '../../pages/login';

test('UI-01 standard user can sign in and open the cart', async ({ page }) => {
  const inventory = new InventoryPage(page);
  await new LoginPage(page).signIn();

  await expect(page).toHaveURL('/inventory.html');
  await expect(inventory.title).toHaveText('Products');
  await expect(inventory.items.getByTestId('inventory-item-name')).not.toHaveCount(0);
  await inventory.cartLink.click();
  await expect(page.getByTestId('title')).toHaveText('Your Cart');
});

const rejectedLogins = [
  {
    title: 'UI-08 rejects an incorrect password',
    credentials: { ...standardUser, password: 'invalid-demo-password' },
    message: 'Username and password do not match any user in this service',
  },
  {
    title: 'UI-09 requires a password',
    credentials: { ...standardUser, password: '' },
    message: 'Password is required',
  },
];

for (const { title, credentials, message } of rejectedLogins) {
  test(title, async ({ page }) => {
    const login = new LoginPage(page);
    await login.signIn(credentials);

    await expect(login.error).toHaveText(`Epic sadface: ${message}`);
    await expect(page).toHaveURL('/');
    await expect(login.form).toBeVisible();
    await expect(page.getByTestId('inventory-list')).toHaveCount(0);
  });
}
