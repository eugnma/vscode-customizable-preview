'use strict';

export function commandArgv(command: string): string[] {
    // Possible undefined or null if calling from pure JavaScript.
    if (!command) { throw new Error('Not found any valid command.'); }

    const argv = [];
    let argQuotationMark = '',
        char = '',
        arg = '';
    for (let i = 0; i < command.length; i++) {
        char = command[i];
        switch (char) {
            case '\\':
                if (!argQuotationMark) {
                    if (command.length <= i + 1) { throw new Error('Not found the following characters of the last escape character.'); }
                    arg += command[++i];
                } else {
                    arg += char;
                }
                break;
            case '"':
            case "'":
                if (argQuotationMark === char) {
                    argQuotationMark = '';
                    argv.push(arg);
                    arg = '';
                } else if (arg) {
                    throw new Error('Quotation marks are part of arguments should be escaped.');
                } else {
                    argQuotationMark = char;
                }
                break;
            case ' ':
                if (!argQuotationMark) {
                    if (arg) {
                        argv.push(arg);
                        arg = '';
                    }
                } else {
                    arg += char;
                }
                break;
            default:
                arg += char;
                break;
        }
    }
    if (argQuotationMark) { throw new Error('Invalid pair of the last quotation mark.'); }
    if (arg) {
        argv.push(arg);
    }
    if (argv.length === 0) { throw new Error('Not found any valid command.'); }
    return argv;
}
