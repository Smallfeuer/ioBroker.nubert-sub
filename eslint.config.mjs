// ioBroker eslint template configuration file for js and ts files
import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        ignores: ['.dev-server/', '.vscode/', '*.test.js', 'test/**/*.js', '*.config.mjs', 'admin/i18n/'],
    },
    {
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param-description': 'off',
            'jsdoc/require-returns-description': 'off',
            // JSDoc types are needed for the type check of the JavaScript sources (tsconfig checkJs)
            'jsdoc/check-tag-names': 'off',
            'jsdoc/no-types': 'off',
        },
    },
];
