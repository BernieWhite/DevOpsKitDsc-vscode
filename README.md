# DevOps Kit for DSC

This **preview** extension for Visual Studio Code adds convenience features for IT Pros using DevOps Kit for DSC.

DevOps Kit for DSC is a PowerShell module available from the PowerShell Gallery and is **required** for this extension to work.

To install the module use `Install-Module -Name DevOpsKitDsc -MinimumVersion 0.2.0 -Scope CurrentUser;` from a PowerShell prompt.

| AppVeyor (Windows) | Codecov (Windows) |
| --- | --- |
| [![av-image][]][av-site] | [![cc-image][]][cc-site] |

[av-image]: https://ci.appveyor.com/api/projects/status/b3bn5mymkonomjb4
[av-site]: https://ci.appveyor.com/project/BernieWhite/devopskitdsc-vscode
[cc-image]: https://codecov.io/gh/BernieWhite/DevOpsKitDsc-vscode/branch/master/graph/badge.svg
[cc-site]: https://codecov.io/gh/BernieWhite/DevOpsKitDsc-vscode

## Disclaimer

This project is to be considered a **proof-of-concept** and **not a supported Microsoft product**.

## Features

- Create collections
- IntelliSense for editing workspace settings.json
- Restore modules while editing
- Automatically detect collections and build with tasks

## Installing the Extension

You can install the latest release of the extension by following the steps in the [Visual Studio Code documentation][vscode-ext-gallery]. In the Extensions pane, search for "DevOps Kit for DSC" extension and install it there. You will get notified automatically about any future extension updates!

```
code --install-extension bewhite.dokd-vscode-preview
```

> NOTE: If you are using VS Code Insiders, the command will be `code-insiders`.

## Maintainers

- [Bernie White](https://github.com/BernieWhite)

## License

This project is [licensed under the MIT License](LICENSE).

[vscode-ext-gallery]: https://code.visualstudio.com/docs/editor/extension-gallery
