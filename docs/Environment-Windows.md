## Windows 10 / Windows 11

- Install `Git` from https://git-scm.com/.
- Install Node.js 16 from https://nodejs.org/dist/latest-v16.x/.
- Install node-gyp compilation environment for the third-party denpendencies.
  - **Official:** You can follow [node-gyp installation instructions](https://github.com/nodejs/node-gyp#on-windows).
  - **Alternative:** Open `Git Bash` as administrator and follow the steps below. This will take about half an hour.

    ```Bash
    > npm install -g windows-build-tools
    > npm config set msvs_version 2017
    ```
    
    or

    ```Bash
    > npm config set @xiekun1992:registry=https://npm.pkg.github.com/
    > npm config set //npm.pkg.github.com/:_authToken=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
    > npm install -g @xiekun1992/windows-build-tools@5.2.3
    > npm config set msvs_version 2017
    ```

    **Note**: By now the latest version of `windows-build-tools` is v5.2.2, which has an issue of Visual Studio Build Tools in endless wait loop. In order to save your time, we fixed the bug and provide the second way.
