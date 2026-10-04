// Configuración de ESLint (formato "flat"). Solo usa reglas del núcleo de ESLint,
// así no hace falta instalar plugins: `npm run lint` descarga ESLint con npx.

const GLOBALES_NODE = {
  AbortSignal: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  globalThis: 'readonly',
  process: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly'
};

const GLOBALES_NAVEGADOR = {
  URLSearchParams: 'readonly',
  console: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  sessionStorage: 'readonly',
  window: 'readonly'
};

const REGLAS = {
  // Errores probables
  'array-callback-return': 'error',
  'constructor-super': 'error',
  'for-direction': 'error',
  'getter-return': 'error',
  'no-async-promise-executor': 'error',
  'no-compare-neg-zero': 'error',
  'no-cond-assign': 'error',
  'no-const-assign': 'error',
  'no-constant-binary-expression': 'error',
  'no-constant-condition': 'error',
  'no-dupe-args': 'error',
  'no-dupe-class-members': 'error',
  'no-dupe-else-if': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-duplicate-imports': 'error',
  'no-empty-pattern': 'error',
  'no-ex-assign': 'error',
  'no-fallthrough': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-irregular-whitespace': 'error',
  'no-loss-of-precision': 'error',
  'no-misleading-character-class': 'error',
  'no-obj-calls': 'error',
  'no-promise-executor-return': 'error',
  'no-self-assign': 'error',
  'no-self-compare': 'error',
  'no-setter-return': 'error',
  'no-sparse-arrays': 'error',
  'no-template-curly-in-string': 'error',
  'no-this-before-super': 'error',
  'no-undef': 'error',
  'no-unreachable': 'error',
  'no-unsafe-finally': 'error',
  'no-unsafe-negation': 'error',
  'no-unsafe-optional-chaining': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-use-before-define': ['error', { functions: false }],
  'use-isnan': 'error',
  'valid-typeof': 'error',

  // Buenas prácticas
  curly: ['error', 'multi-line'],
  eqeqeq: ['error', 'always'],
  'no-empty': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-return-assign': 'error',
  'no-throw-literal': 'error',
  'no-unused-expressions': 'error',
  'no-useless-catch': 'error',
  'no-var': 'error',
  'prefer-const': 'error'
};

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**']
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: GLOBALES_NODE
    },
    rules: REGLAS
  },
  {
    files: ['webapp/src/**/*.js', 'webapp/src/**/*.jsx'],
    languageOptions: { globals: GLOBALES_NAVEGADOR }
  }
];
