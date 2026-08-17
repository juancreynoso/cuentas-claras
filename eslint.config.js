import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.wrangler/**',
      'api/worker-configuration.d.ts',
      // Versión original, guardada como referencia histórica.
      'docs/legacy/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Los archivos de configuración no pertenecen a ningún tsconfig.
          allowDefaultProject: ['eslint.config.js', '*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Preferimos `import type` explícito: deja claro qué desaparece en runtime.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Permite `catch {}` sin variable y args ignorados con prefijo _.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Los aserts no-nulos son legítimos en tests, donde el setup los garantiza.
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  // Frontend: React en el navegador.
  {
    files: ['web/**/*.{ts,tsx}', 'shared/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // Worker: runtime de Cloudflare, sin APIs de navegador ni de Node.
  {
    files: ['api/**/*.ts'],
    languageOptions: {
      globals: { ...globals.worker },
    },
    rules: {
      // El Worker sí usa console para logs de servidor.
      'no-console': 'off',
    },
  },

  // Tests y archivos de configuración.
  {
    files: ['**/*.test.{ts,tsx}', '**/*.config.{ts,js}', 'web/src/test/**'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
);
