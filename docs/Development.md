# Development

If you want to contribute to Luban, you will need to have `Node.js` development environment.

Or you can follow the instructions below to set up the development environment for specific platform:

- macOS: (No documentation for now)
- Linux (Ubuntu/Debian/CentOS): [Linux Environment](Environment-Linux.md)
- Windows: [Windows Environment](Environment-Windows.md)


### Install dependencies and start dev server

- Clone this repository.

    ```Bash
    > git clone https://github.com/Snapmaker/Luban.git
    > cd Luban
    > git submodule init && git submodule update
    ```

- Use `npm` to install package dependencies:

    ```Bash
    > npm install
    ```

- Start dev server locally:

    ```Bash
    > npm run dev
    ```

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

