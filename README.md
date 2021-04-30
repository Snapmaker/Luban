Snapmaker Luban
===============

[![Build Status](https://travis-ci.org/Snapmaker/Luban.svg?branch=master)](https://travis-ci.org/Snapmaker/Luban)
[![Build status](https://ci.appveyor.com/api/projects/status/2912jdsm88wcg19g?svg=true)](https://ci.appveyor.com/project/parachvte/luban)

Snapmaker Luban is an easy-to-use 3-in-1 software tailor-made for Snapmaker machines.
You can customize the printer settings and control the machine using the command panel in Luban anytime with ease.
The software also provides G-code generation support for 3D models, laser engraving / cutting, and CNC milling.

Our goal is to provide a multi-functional 3D software, while making it as accessible and customizable as possible for new users / beginners.

The software is inspired by [cncjs](https://github.com/cncjs/cncjs) by cheton, we also use [CuraEngine](https://github.com/Ultimaker/CuraEngine) for 3D slicing.

## Features

- Desktop applications for macOS, Linux and Windows
- Supported controller: Marlin or Marlin-based controllers
- 3D printing G-code generator
    - Multiple models
    - Manipulate model (Position / Rotate / Duplicate / Lay Flat)
    - Model export and G-code export
    - Built-in and custom configurations for slicing
- Laser G-code generator
    - Multiple models
    - Manipulate model (Position / Rotate / Duplicate)
    - Model export and G-code export
    - Featured modes: B&W, Greyscale, Vector, Text
- CNC G-code generator
    - Multiple models
    - Manipulate model (Position / Rotate / Duplicate)
    - Model export and G-code export
    - Featured modes: Relief, Vector, Text
    - Support Tabs
- Snapmaker 2.0 only features
    - Wi-Fi controls and file transfer
    - Camera Aid Background
- Case Library
- Multi-Language Support
- Keyboard shortcut
- Custom Widgets

## How to install and run

### Use released applications

You can download latest releases of software under the ["**Releases**"](https://github.com/Snapmaker/Luban/releases) section.
It's recommended to use a stable release version unless you want to do some modifications on the source code.

## Development
If you want to contribute to Luban, you can follow the instructions below to set up the development environment.
### Ubuntu & Debian
- Update software sources.
    ```
    > sudo apt update
    ```

- Install `Git`.
    ```
    > sudo apt install git
    ```

- Install Node.js 12. You can use
    [NVM (Node Version Manager)](https://github.com/nvm-sh/nvm) to install and manage multiple Node.js 
    versions:

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
    ```
    > sudo yum update
    ```

- Install `Git`.
    ```Bash
    > sudo yum install git
    ```
- Install Node.js 12. You can use
    [NVM (Node Version Manager)](https://github.com/nvm-sh/nvm) to install and manage multiple Node.js 
    versions:

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
- Open `Git Bash` as administrator and install node-gyp compilation environment for the third-party denpendencies. This will take about half hour.
    ```
    > npm install -g windows-build-tools
    > npm config set msvs_version 2017
    ```
    or
    ```
    > npm config set @xiekun1992:registry=https://npm.pkg.github.com/
    > npm config set //npm.pkg.github.com/:_authToken=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
    > npm install -g @xiekun1992/windows-build-tools@5.2.3
    > npm config set msvs_version 2017
    ```

    **Note**: By now the latest version of `windows-build-tools` is v5.2.2, which has an issue of Visual Studio Build Tools in endless wait loop. In order to save your time, we fixed the bug and provide the second way.

### Install dependencies and start dev server
- Clone this repository.
    ```
    > git clone https://github.com/Snapmaker/Luban.git
    > cd Luban
    ```

- Use `npm` to install package dependencies:

    ```Bash
    > npm install
    ```

- Start dev server locally:

    ```Bash
    > npm run dev
    ```

- Open browser (recommend Chrome) and navigate to http://localhost:8000.

### Additional Notes
- For developers in China, you can use taobao mirror.

    ```
    > npm config set registry https://registry.npm.taobao.org/
    > ELECTRON_MIRROR="https://npm.taobao.org/mirrors/electron/" npm install
    ```

### FAQ
- **Q:** Encounter a `RequestError` when installing electron?

  **A:** Check your system proxy and try `rm -rf node_modules/electron && npm install` again.

- **Q:** Develop in Firefox encounters an blank screen?

  **A:** There is a compatible problem of `getScreenCTM()` in using SVG in Firefox, switch to Chrome.

## Feedback & Contribution

- To submit a bug or feature request, [file an issue](https://github.com/Snapmaker/Luban/issues/new) in github issues.
- To contribute some code, make sure you have read and followed our guidelines for [contributing](https://github.com/Snapmaker/Luban/blob/master/CONTRIBUTING.md).


## License
Snapmaker Luban is released under terms of the AGPLv3 License.

Terms of the license can be found in the LICENSE file or at http://www.gnu.org/licenses/agpl-3.0.html.
