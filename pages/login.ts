import type { Locator, Page } from '@playwright/test';

export const standardUser = {
  username: 'standard_user',
  password: 'secret_sauce',
};

export class LoginPage {
  readonly form: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.form = page.getByRole('form', { name: 'Login' });
    this.error = page.getByTestId('error');
  }

  async signIn({ username, password } = standardUser) {
    await this.page.goto('/');
    await this.form.getByRole('textbox', { name: 'Username' }).fill(username);
    await this.form.getByTestId('password').fill(password);
    await this.form.getByRole('button', { name: 'Login', exact: true }).click();
  }
}
