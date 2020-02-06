Snapmaker Luban
===============
Snapmaker Luban is an easy-to-use 3-in-1 software tailor-made for Snapmaker machines.
Through it you can connect to and control the machine, it also provides G-code generation
for 3D models, laser engraving / cutting, and CNC milling.

Our goal is to provide a more general multi-functional 3D software, remains ease of use
as well as highly customizable.

TODO: add a screen shot of software here.

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

You can download latest releases of software under releases section.
It's recommended to use a released version unless you want to do some modifications on the source code.

Or you can clone this repository, then follow the instructions in Development section below.

## Development

### Setup development environment

- Install Node.js 10 (or higher? Node.js 12 not verified). You can use 
[NVM (Node Version Manager)](https://github.com/nvm-sh/nvm) to install and manage multiple Node.js 
versions:

```Bash
> brew install nvm
> nvm install 10
> nvm use 10
```

- Upgrade npm to the latest version:

```Bash
> npm install npm@latest -g
```

### Install dependencies and start dev server

- Use `npm` to install package dependencies:

```Bash
> npm install
```

- Start dev server locally:

```Bash
> npm run dev
```

## Feedback & Contributing

- To submit a bug or feature request, [file an issue](https://github.com/whimsycwd/Snapmakerjs/issues/new) in github issues.
- To contribute some code, make sure you read up and follow our guidelines for [contributing](https://github.com/whimsycwd/Snapmakerjs/blob/master/CONTRIBUTING.md) first.


## License
Snapmaker Luban is released under terms of the AGPLv3 License.

Terms of the license can be found in the LICENSE file or at http://www.gnu.org/licenses/agpl-3.0.html.
