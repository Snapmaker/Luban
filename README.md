Snapmaker Luban
===============

[![Build Status](https://github.com/Snapmaker/Luban/workflows/Build%20on%20Release%20created/badge.svg)](https://github.com/Snapmaker/Luban/actions)

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

### Run released applications

You can download latest releases of software under the ["**Releases**"](https://github.com/Snapmaker/Luban/releases) section.
It's recommended to use a stable release version unless you want to do some modifications on the source code.

For Linux distros (Debian for example), you may need to run following commands to install dependencies for Luban:

```Bashhist
> sudo dpkg install snapmaker-luban-{version}-linux-amd64.deb
> sudo apt install --fix-broken
```


### Run from source code

Checkout [Development](./docs/Development.md) to how to run and develop from source code.


## Feedback & Contribution

- To submit a bug or feature request, [file an issue](https://github.com/Snapmaker/Luban/issues/new) in github issues.
- To contribute some code, make sure you have read and followed our guidelines for [contributing](https://github.com/Snapmaker/Luban/blob/master/CONTRIBUTING.md).


## License
Snapmaker Luban is released under terms of the AGPLv3 License.

Terms of the license can be found in the LICENSE file or at http://www.gnu.org/licenses/agpl-3.0.html.
