# Contributing to Snapmaker Luban

We would love for your to contribute to Snapmaker Luban and help make it better.
Here are the guidelines we would like you to follow:

- [Issues and Bugs](#issue)
- [Feature Request](#feature)
- [Pull Request](#pr)
- [Code Style Guidelines](#code)
- [Commit Message Guidelines](#commit)

## <a name="issue"></a> Found a Bug?

If you found a bug in the source code, you can help us by [submitting a issue](https://github.com/Snapmaker/Luban/issues/new) to our [Github repository](https://github.com/Snapmaker/Luban).
Even better, you can [submitting a pull request](#pr) with a fix.

Before you submit an issue, please search the issue tracker, maybe an issue for your problem already exists and discussion might inform you of workarounds readily available.

We want to fix all the issues as soon as possible, but before fixing a bug we need to reproduce and confirm it.
In order to reproduce bugs, we will ask you to provide a minimal reproduction.
Unfortunately, we are not able to investigate / fix bugs without a minimal reproduction, so if we don't hear back from you, we are going to close an issue that doesn't have enough info to be reproduced.

## <a name="feature"></a> Adding a feature?

You can *request a new feature* by [submitting an issue](https://github.com/Snapmaker/Luban/issues/new) to our [Github repository](https://github.com/Snapmaker/Luban) as well.
If you would like to *implement a new feature*, please submit an issue with a proposal for your work first, to be sure that we can use it.
Small Features can be crafted and directly submitted as a Pull Request.

Our [Development](docs/Development.md) documentation describes how to setup your development environment (macOS/Ubuntu/Windows) and run Snapmaker Luban from source code.

### <a name="pr"></a> Pull Request

Before you submit your Pull Request (PR) consider the following guidelines:

1. Search existing PRs for an open or closed PR relates to your submission to make sure it's not duplicated.
2. Be sure that an issue describes the problem you've fixing / solving, or documents the design for the feature you'd like to add.
Discussing the design up front helps to ensure that we're ready to accept your work.
3. Fork the `Snapmaker/Luban` repo.
4. Make your changes in a new git branch
    ```
    git checkout -b my-fix-branch main
    ```
5. Make changes to the source code follow [our code style guidelines](#code), best to **include appropriate test cases**.
When you run `git push`, our git hook will call eslint to run a lint over source code automatically.
6. Run all tests to ensure that all tests pass.
7. Commit your changes using a descriptive commit message that follows [our commit message guidelines](#commit).
We also have a git hook script to check your commit message, for convenience you can just type `npm run commit` to use
[Commitizen's CLI tool](https://github.com/commitizen/cz-cli) to help you write commit messages.

    ```
    git commit
    ```
    
8. Push your branch to Github:

    ```
    git push origin my-fix-branch
    ```

9. In Github, send a pull request to `Snapmaker/Luban`.

   If we suggest,

   - Make updates on your branch
   - Rebase your branch and force push to your GitHub repository (this will update your Pull Request):

     ```
     git rebase main -i
     git push -f
     ```

That's it! Thank you for your contribution!

#### After your pull request is merged

After your pull request is merged, you can safely delete your branch and pull the changes from the main (upstream) repository:

- Delete the remote branch on GitHub either through the GitHub web UI or your local shell as follows:

  ```
  git push origin --delete my-fix-branch
  ```

- Check out the `main` branch:

  ```
  git checkout main -f
  ```

- Delete the local branch:

  ```
  git branch -D my-fix-branch
  ```

- Update your `main` branch with the latest upstream version:

  ```
  git pull --ff upstream main
  ```

### <a name="code"></a> Code Style Guidelines

Generally, we follow [Airbnb's JavaScript Style Guide](https://github.com/airbnb/javascript), based
on that we write a [ESLint config for Snapmaker](https://github.com/Snapmaker/eslint-config-snapmaker)
to check code style.

A githook is also added to run the check automatically before every git push.

- Check code style:

```
npm run lint
```

### <a name="commit"></a> Commit Message Guidelines

We have rules over how git commit message can be formatted. This leads to **more readable message**
that are easy to follow when looking through the **project history**.

#### Commit Message Format

```
<type>: <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

Any line of the commit message cannot be longer than 80 characters. This allows the message to be
easier to read on GitHub as well as in various git tools.

##### Type

Must be one of the following:

- **Feature**: A new feature
- **Improvement**: An improvement to a current feature
- **Fix**: A bug fix
- **Refactor**: A code change that neither fixes a bug nor adds a feature
- **Perf**: A code change that improves performance
- **Test**: Adding missing tests or correcting existing tests
- **Build**: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)
- **Style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **Docs**: Documentation only changes

##### Subject

The subject contains a succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- capitalize the first letter
- no dot (.) at the end

##### Body (optional)

Just as in the **subject**, use the imperative, present tense: "change" not "changed" nor "changes".
The body should include the motivation for the change and contrast this with previous behavior

##### Footer (optional)

The footer should contain any information about **Breaking Changes** and is also the place to
[reference **GitHub issues**](https://help.github.com/en/github/managing-your-work-on-github/linking-a-pull-request-to-an-issue)
that this commit Closes.
