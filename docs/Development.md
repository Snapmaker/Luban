# Development

If you want to contribute to Luban, you will need to have `Node.js` development environment.

Or you can follow the instructions below to set up the development environment for specific platform:

- macOS: (No documentation for now)
- Linux (Ubuntu/Debian/CentOS): [Linux Environment](Environment-Linux.md)
- Windows: [Windows Environment](Environment-Windows.md)


### Install dependencies and start dev server

- Clone this repository and initialize submodules. **Note: As we use submodules to manage large resources, it's always recommended to use [SSH](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) to manage your repository.**

    ```Bash
    > git clone git@github.com:Snapmaker/Luban.git
    > cd Luban
    > git submodule update --init
    ```

- Use `npm` to install package dependencies:

    ```Bash
    > npm install
    ```

- Start dev server locally:

    ```Bash
    > npm run dev
    ```

### Build installer locally

```Bash
> npm run build && npm run build:mac-x64 (for macOS)
> npm run build && npm run build:win-x64 (for Windows)
```

### Additional Notes

- For developers in China, you can use taobao mirror to install npm packages.

    ```Bash
    > npm config set registry https://registry.npm.taobao.org/
    > ELECTRON_MIRROR="https://npm.taobao.org/mirrors/electron/" npm install
    ```

### FAQ

- **Q:** Encounter a `RequestError` when installing electron?

  **A:** Check your system proxy and try `rm -rf node_modules/electron && npm install` again.

- **Q:** Develop in Firefox encounters an blank screen?

  **A:** There is a compatible problem of `getScreenCTM()` in using SVG in Firefox, switch to Chrome.

