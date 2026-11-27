import { expect, test } from '@playwright/test';
import { InventoryPage } from './pages/inventory';
import { LoginPage } from './pages/login';

test('BONUS: Fleece Jacket details match the catalog and its price is unchanged on return', async ({ page }) => {
  const login = new LoginPage(page);
  const inventory = new InventoryPage(page);
  await login.signIn();
  await expect(page).toHaveURL('/inventory.html');

  const product = inventory.item('Sauce Labs Fleece Jacket');
  const productName = product.getByTestId('inventory-item-name');
  const productPrice = product.getByTestId('inventory-item-price');
  const productDescription = product.getByTestId('inventory-item-desc');
  const name = await productName.innerText();
  const price = await productPrice.innerText();
  const description = await productDescription.innerText();
  await productName.click();

  const backToProducts = page.getByRole('button', { name: 'Back to products', exact: true });
  const detailName = page.getByTestId('inventory-item-name');
  const detailPrice = page.getByTestId('inventory-item-price');
  const detailDescription = page.getByTestId('inventory-item-desc');
  await expect(backToProducts).toBeVisible();
  await expect(detailName).toBeVisible();
  await expect(detailName).toHaveText(name);
  await expect(detailPrice).toBeVisible();
  await expect(detailPrice).toHaveText(price);
  await expect(detailDescription).toBeVisible();
  await expect(detailDescription).toHaveText(description);

  await backToProducts.click();
  await expect(page).toHaveURL('/inventory.html');
  await expect(product).toBeVisible();
  await expect(productName).toBeVisible();
  await expect(productPrice).toBeVisible();
  await expect(productPrice).toHaveText(price);
});