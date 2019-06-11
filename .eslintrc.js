module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: [
        'plugin:@typescript-eslint/recommended',
    ],
    // https://eslint.org/docs/user-guide/configuring#specifying-parser-options
    parserOptions: {
        ecmaVersion: 2019,
        sourceType: 'module',
    },
    rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    }
};