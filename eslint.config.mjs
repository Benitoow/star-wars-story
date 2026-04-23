import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import svelteConfig from './svelte.config.js';

export default tseslint.config(
  {
    ignores: ['.svelte-kit/**', 'build/**', 'dist/**', 'node_modules/**', 'archives/**', 'output/playwright/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        svelteConfig
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['**/*.{test,spec}.{ts,js}'],
    languageOptions: {
      globals: {
        ...globals.vitest
      }
    }
  },
  {
    rules: {
      'no-console': 'off',
      'no-useless-escape': 'off',
      'prefer-const': 'off',
      'no-case-declarations': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'svelte/require-each-key': 'off',
      'svelte/no-navigation-without-resolve': 'off',
      'svelte/infinite-reactive-loop': 'off',
      'svelte/no-at-html-tags': 'off'
    }
  }
);
