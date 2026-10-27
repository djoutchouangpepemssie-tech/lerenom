import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/coverage/**',
      // Client Prisma généré : on ne relit pas un code qu'on n'écrit pas.
      '**/src/genere/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Les règles métier sont écrites en français : on n'impose pas de casse aux identifiants.
      // `x != null` couvre null et undefined en une seule comparaison : c'est l'idiome le plus
      // lisible face aux champs nullables de Prisma. Partout ailleurs, l'égalité est stricte.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Les scripts d'outillage sont du JavaScript simple : ils ne passent pas par le service
    // TypeScript, donc pas de règles typées sur eux.
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: {
      // Le service TypeScript ne connaît pas ces fichiers : on le désactive pour eux.
      parserOptions: { projectService: false, project: false },
      globals: {
        console: 'readonly',
        // Le code passé à page.evaluate() s'exécute dans le navigateur.
        window: 'readonly',
        document: 'readonly',
        getComputedStyle: 'readonly',
      },
    },
    // Les règles typées sont désactivées d'abord, puis on remet ce qui nous intéresse :
    // l'ordre compte, un `rules` plus tardif écraserait la désactivation.
    rules: { ...tseslint.configs.disableTypeChecked.rules, 'no-console': 'off' },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/vitest.config.ts', '**/*.config.*'],
    rules: { '@typescript-eslint/no-unsafe-assignment': 'off', 'no-console': 'off' },
  },
  prettier,
);
