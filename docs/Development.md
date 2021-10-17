# Development

If you want to contribute to Luban, you can follow the instructions below to set up the development environment.

### Ubuntu & Debian

- Update software sources.

    ```Bash
    > sudo apt update
    ```

- Install `Git`.

    ```Bash
    > sudo apt install git
    ```

- Install Node.js 12. You can use [NVM (Node Version Manager)](https://github.com/nvm-sh/nvm) to install and manage multiple Node.js versions:

    ```Bash
    > nvm install 12
    > nvm use 12
    ```

- Install dependencies for Linux builds and compilation environment for third-party dependencies.

    ```Bash
    > sudo apt install rpm
    > sudo apt install make g++ libfontconfig-dev
    ```

### CentOS

- Update software sources.

    ```Bash
    > sudo yum update
    ```

- Install `Git`.

    ```Bash
    > sudo yum install git
    ```

- Install Node.js 12. You can use [NVM (Node Version Manager)](https://github.com/nvm-sh/nvm) to install and manage multiple Node.js versions:

    ```Bash
    > nvm install 12
    > nvm use 12
    ```

- Install dependencies for Linux builds and compilation environment for third-party dependencies.

    ```Bash
    > sudo yum install rpm-build
    > sudo yum install make gcc-c++ freetype-devel fontconfig-devel
    ```

### Windows 10

- Install `Git` from https://git-scm.com/.
- Install Node.js 12 from https://nodejs.org/dist/latest-v12.x/.
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

### Install dependencies and start dev server

- Clone this repository.

    ```Bash
    > git clone https://github.com/Snapmaker/Luban.git
    > cd Luban
    ```

- Use `npm` to install package dependencies (with peer dependencies):

    ```Bash
    > npm install --legacy-peer-deps
    ```

- Start dev server locally:

    ```Bash
    > npm run dev
    ```

- Open browser (recommend Chrome) and navigate to http://localhost:8000.

### Additional Notes

- For developers in China, you can use taobao mirror.

    ```Bash
    > npm config set registry https://registry.npm.taobao.org/
    > ELECTRON_MIRROR="https://npm.taobao.org/mirrors/electron/" npm install
    ```

### FAQ

- **Q:** Encounter a `RequestError` when installing electron?

  **A:** Check your system proxy and try `rm -rf node_modules/electron && npm install` again.

- **Q:** Develop in Firefox encounters an blank screen?

  **A:** There is a compatible problem of `getScreenCTM()` in using SVG in Firefox, switch to Chrome.

