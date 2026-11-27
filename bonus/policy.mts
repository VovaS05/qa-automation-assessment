import ts from 'typescript';

export const pageFiles = ['login', 'inventory', 'checkout', 'cart-items'] as const;
const pageClasses = ['LoginPage', 'InventoryPage', 'CheckoutPage', 'CartItems'];
const imports = new Map<string, readonly string[]>([
  ['@playwright/test', ['test', 'expect']],
  ...pageFiles.map((name, i): [string, string[]] => [`./pages/${name}`, [pageClasses[i]]]),
]);
const properties = new Set([
  'form', 'error', 'title', 'items', 'sort', 'cartLink', 'cartCount', 'list', 'rows',
  'summary', 'confirmation', 'name', 'price', 'not',
]);
const actions = new Set([
  'signIn', 'item', 'addToCart', 'submitInformation', 'getByTestId', 'getByRole',
  'getByText', 'getByLabel', 'filter', 'first', 'click', 'fill', 'selectOption',
  'goto', 'reload', 'innerText',
]);
const assertions = new Set([
  'toHaveURL', 'toHaveText', 'toContainText', 'toHaveCount', 'toHaveAccessibleName',
  'toBeVisible', 'toBeHidden', 'toBeEnabled', 'toBeDisabled', 'toHaveValue', 'toBe', 'toEqual',
]);
const fields = new Set([
  'name', 'exact', 'visible', 'has', 'hasText', 'label', 'value',
  'firstName', 'lastName', 'postalCode',
]);
const paths = new Set([
  '/', '/inventory.html', '/inventory-item.html', '/cart.html',
  '/checkout-step-one.html', '/checkout-step-two.html', '/checkout-complete.html',
]);

export function validateSpec(source: string): void {
  const file = ts.createSourceFile('generated.spec.ts', source, ts.ScriptTarget.ES2022, true);
  if (file.referencedFiles.length || file.typeReferenceDirectives.length || file.libReferenceDirectives.length ||
      /@ts-(?:nocheck|ignore|expect-error)\b/.test(source)) {
    throw new Error('TypeScript reference directives and suppressed diagnostics are unsupported');
  }
  const parsed = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext },
    reportDiagnostics: true,
  });
  const diagnostic = parsed.diagnostics?.find(item => item.category === ts.DiagnosticCategory.Error);
  if (diagnostic) throw new Error(`TypeScript syntax: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);

  function reject(node: ts.Node, message: string): never {
    const { line, character } = file.getLineAndCharacterOfPosition(node.getStart(file));
    throw new Error(`generated.spec.ts:${line + 1}:${character + 1} ${message}`);
  }

  const bindings = new Set<string>();
  let testCall: ts.CallExpression | undefined;
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.importClause && !statement.importClause.isTypeOnly && !statement.importClause.name &&
        statement.importClause.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) &&
        !statement.attributes && !testCall) {
      const allowed = imports.get(statement.moduleSpecifier.text);
      if (!allowed) reject(statement, 'Import is outside the bonus allowlist');
      for (const item of statement.importClause.namedBindings.elements) {
        if (item.propertyName || item.isTypeOnly || !allowed.includes(item.name.text)) {
          reject(item, 'Use an allowed named import without aliasing');
        }
        bindings.add(item.name.text);
      }
    } else if (!testCall && ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) &&
               ts.isIdentifier(statement.expression.expression) && statement.expression.expression.text === 'test') {
      testCall = statement.expression;
    } else {
      reject(statement, 'Only imports followed by one test declaration are allowed');
    }
  }
  if (!testCall || !bindings.has('test') || !bindings.has('expect')) reject(file, 'Import test and expect and declare one test');
  const [title, callback] = testCall.arguments;
  if (testCall.arguments.length !== 2 || testCall.typeArguments || !ts.isStringLiteral(title) ||
      !title.text.startsWith('BONUS: ') || !ts.isArrowFunction(callback) ||
      !callback.modifiers?.some(item => item.kind === ts.SyntaxKind.AsyncKeyword) || callback.type || callback.typeParameters ||
      !ts.isBlock(callback.body) || callback.parameters.length !== 1) {
    reject(testCall, 'Use test("BONUS: ...", async ({ page }) => { ... })');
  }
  const [parameter] = callback.parameters;
  if (!ts.isObjectBindingPattern(parameter.name) || parameter.name.elements.length !== 1 ||
      parameter.name.getText(file).replace(/\s/g, '') !== '{page}' || parameter.type || parameter.initializer) {
    reject(parameter, 'The only allowed fixture is page');
  }

  bindings.delete('test');
  bindings.add('page');
  let awaitedAssertions = 0;
  function isAssertion(expression: ts.Expression): boolean {
    if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression) ||
        !assertions.has(expression.expression.name.text)) return false;
    let receiver = expression.expression.expression;
    if (ts.isPropertyAccessExpression(receiver) && receiver.name.text === 'not') receiver = receiver.expression;
    return ts.isCallExpression(receiver) && ts.isIdentifier(receiver.expression) && receiver.expression.text === 'expect';
  }

  function check(expression: ts.Expression): void {
    if (ts.isIdentifier(expression) && bindings.has(expression.text)) return;
    if (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression) ||
        [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(expression.kind)) return;
    if (ts.isAwaitExpression(expression)) {
      if (isAssertion(expression.expression)) awaitedAssertions++;
      return check(expression.expression);
    }
    if (ts.isArrayLiteralExpression(expression)) {
      expression.elements.forEach(check);
      return;
    }
    if (ts.isObjectLiteralExpression(expression)) {
      for (const field of expression.properties) {
        if (!ts.isPropertyAssignment(field) ||
            !(ts.isIdentifier(field.name) || ts.isStringLiteral(field.name)) ||
            !fields.has(field.name.text)) reject(field, 'Unsupported option or object property');
        check(field.initializer);
      }
      return;
    }
    if (ts.isNewExpression(expression) && ts.isIdentifier(expression.expression) &&
        pageClasses.includes(expression.expression.text) && bindings.has(expression.expression.text) &&
        expression.arguments?.length === 1 && expression.arguments[0].getText(file) === 'page' && !expression.typeArguments) return;
    if (ts.isPropertyAccessExpression(expression) && properties.has(expression.name.text) && !expression.questionDotToken) {
      return check(expression.expression);
    }
    if (ts.isCallExpression(expression) && !expression.questionDotToken && !expression.typeArguments) {
      const call = expression.expression;
      if (ts.isIdentifier(call) && call.text === 'expect') {
        expression.arguments.forEach(check);
        return;
      }
      if (ts.isPropertyAccessExpression(call) && !call.questionDotToken &&
          (actions.has(call.name.text) || isAssertion(expression))) {
        if (call.name.text === 'goto' &&
            (expression.arguments.length !== 1 || !ts.isStringLiteral(expression.arguments[0]) ||
             !paths.has(expression.arguments[0].text))) reject(expression, 'Use an approved relative SauceDemo route');
        check(call.expression);
        expression.arguments.forEach(check);
        return;
      }
    }
    reject(expression, 'Unsupported expression in the generated test');
  }

  for (const statement of callback.body.statements) {
    if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || bindings.has(declaration.name.text) ||
            declaration.type || !declaration.initializer) {
          reject(declaration, 'Declare a new local const with a supported initializer');
        }
        check(declaration.initializer);
        bindings.add(declaration.name.text);
      }
    } else if (ts.isExpressionStatement(statement) && ts.isAwaitExpression(statement.expression)) {
      check(statement.expression);
    } else {
      reject(statement, 'Use const declarations and awaited operations');
    }
  }
  if (!awaitedAssertions) reject(testCall, 'Include at least one awaited expect assertion');
}
