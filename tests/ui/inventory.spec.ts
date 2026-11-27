import { expect, test } from '@playwright/test';
import { InventoryPage } from '../../pages/inventory';
import { LoginPage } from '../../pages/login';
import { dollarsToCents } from './money';

test.beforeEach(async ({ page }) => {
  await new LoginPage(page).signIn();
  await expect(new InventoryPage(page).title).toHaveText('Products');
});

test('UI-02 catalog lists unique products with matching details and prices', async ({ page }) => {
  const inventory = new InventoryPage(page);
  await expect(inventory.items).not.toHaveCount(0);
  const products = await inventory.readProducts();

  for (const { name, price } of products) {
    expect(name.trim(), 'Every product needs a name').not.toBe('');
    expect(dollarsToCents(price), `Price of ${name}`).toBeGreaterThan(0);
  }
  expect(new Set(products.map(({ name }) => name)).size).toBe(products.length);

  const backpack = inventory.item('Sauce Labs Backpack');
  const description = await backpack.getByTestId('inventory-item-desc').innerText();
  const price = await backpack.getByTestId('inventory-item-price').innerText();
  expect(description.trim()).not.toBe('');

  await backpack.getByTestId('inventory-item-name').click();
  await expect(page.getByRole('button', { name: 'Back to products' })).toBeVisible();
  await expect(page.getByTestId('inventory-item-name')).toHaveText('Sauce Labs Backpack');
  await expect(page.getByTestId('inventory-item-desc')).toHaveText(description);
  await expect(page.getByTestId('inventory-item-price')).toHaveText(price);
});

const lowToHigh = 'Price (low to high)';
const highToLow = 'Price (high to low)';
const priceOrders = [
  { title: 'UI-03 sorts all products by ascending price', label: lowToHigh, opposite: highToLow, multiplier: 1 },
  { title: 'UI-04 sorts all products by descending price', label: highToLow, opposite: lowToHigh, multiplier: -1 },
];

for (const { title, label, opposite, multiplier } of priceOrders) {
  test(title, async ({ page }) => {
    const inventory = new InventoryPage(page);
    await expect(inventory.items).not.toHaveCount(0);
    const before = await inventory.readProducts();
    const prices = before.map(({ price }) => dollarsToCents(price));
    expect(new Set(prices).size, 'The catalog needs two distinct prices to exercise sorting').toBeGreaterThan(1);
    const expectedOrder = [...prices].sort((a, b) => (a - b) * multiplier);
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    const expectedProducts = [...before].sort(byName);
    const readCatalog = async () => {
      const products = await inventory.readProducts();
      return {
        prices: products.map(({ price }) => dollarsToCents(price)),
        products: products.sort(byName),
      };
    };

    if (prices.every((price, index) => price === expectedOrder[index])) {
      await inventory.sort.selectOption({ label: opposite });
      await expect.poll(readCatalog, { message: `Arrange catalog with ${opposite}` })
        .toEqual({ prices: [...expectedOrder].reverse(), products: expectedProducts });
    }

    await inventory.sort.selectOption({ label });
    await expect.poll(readCatalog, { message: `Verify catalog after selecting ${label}` })
      .toEqual({ prices: expectedOrder, products: expectedProducts });
  });
}
