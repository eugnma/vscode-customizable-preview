# Customizable Preview

Customizable Preview is a Visual Studio Code Extension to custom preview for any file.

## Features

* Support HTML preview by default
* Easy to integrate the external tools (e.g. [Pandoc](https://pandoc.org), [CommonMark](https://github.com/commonmark/CommonMark/wiki/List-of-CommonMark-Implementations), [Graphviz](http://www.graphviz.org))

## Usage

Open the [Command Palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette), and select the **Customizable Preview: Preview**

## Extension Settings

This extension contributes the following settings:

* `customizablePreview.rules`: Specifies the custom rules
    ```js
    [
        {
            // Optional, rule group name, it can only contains alphabets,
            // digits, underscores and any of the following characters: '.',
            // ' ', '-', in addition only alphabets and digits can be at the
            // beginning and the end
            "groupName": "",
            // Mandatory, rule name, it can only contains alphabets, digits,
            // underscores and any of the following characters: '.', ' ', '-',
            // in addition only alphabets and digits can be at the beginning
            // and the end
            "name": "Org-mode",
            // Optional, rule description
            "description": "Org-mode Preview",
            // Mandatory, the function in string tests whether the rule should
            // be applied
            "test": "x => x.languageId == 'org' || x.extname == '.org'",
            // Mandatory, the external command, it uses the default behaviour
            // reads input from stdin, and output goes to stdout
            "command": "pandoc --from org --to html",
            // Optional, indicates whether to directly show the result from
            // command, false to put the result in HTML body section by default
            "directFromCommand": true
        },
        /*
        Other rules, if a rule has the same group name and name with previous
        rule, it will override previous one
        .
        .
        .
        */
    ]
    ```

### For more information

* [CommonMark](https://commonmark.org)
* [Org mode](https://orgmode.org)
* [Standard streams](https://en.wikipedia.org/wiki/Standard_streams)
