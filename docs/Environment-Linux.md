## Ubuntu & Debian

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

## CentOS

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
