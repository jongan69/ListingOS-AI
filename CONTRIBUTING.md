# Contributing to ListingOS

First, thank you for taking the time to contribute to ListingOS! ❤️

All types of contributions are encouraged and valued, including bug reports, feature suggestions, documentation improvements, design feedback, tests, and code changes.

Please review the relevant section of this guide before submitting a contribution. Following these guidelines helps maintainers review contributions efficiently and creates a better experience for everyone involved.

The ListingOS community looks forward to your contributions. 🎉

> Like the project but do not have time to contribute code? You can still support ListingOS by:
>
> - Starring the repository
> - Sharing the project on social media
> - Mentioning ListingOS in your project documentation
> - Recommending the project to friends, colleagues, and local developer communities
> - Providing feedback about your experience using the project

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [I Have a Question](#i-have-a-question)
- [I Want to Contribute](#i-want-to-contribute)
  - [Legal Notice](#legal-notice)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Improving the Documentation](#improving-the-documentation)
- [Development Guidelines](#development-guidelines)
  - [Style Guidelines](#style-guidelines)
  - [Testing](#testing)
  - [Commit Messages](#commit-messages)
  - [Pull Requests](#pull-requests)
- [Security Vulnerabilities](#security-vulnerabilities)
- [Joining the Project Team](#joining-the-project-team)
- [Attribution](#attribution)

## Code of Conduct

This project and everyone participating in it are governed by the [ListingOS Code of Conduct](/CODE_OF_CONDUCT.md).

By participating, you agree to uphold that code and help maintain a welcoming, respectful, and harassment-free community.

Please report unacceptable behavior through the private contact method listed in the Code of Conduct.

## I Have a Question

Before opening an issue, please:

1. Read the available project documentation.
2. Search the existing [issues](/issues) for similar questions.
3. Review closed issues, as your question may have already been answered.
4. Confirm that the question relates directly to ListingOS.
5. Avoid including passwords, access tokens, private keys, customer information, or other sensitive data.

When an existing issue covers your question but does not fully answer it, add a comment to that issue rather than opening a duplicate.

When opening a new question:

- Use a clear and descriptive title.
- Explain what you are trying to accomplish.
- Describe what you have already tried.
- Include relevant platform and dependency versions.
- Include logs or screenshots when helpful, after removing sensitive information.
- Provide a minimal example when the question relates to code behavior.

Open a new issue through the repository’s [issue tracker](/issues/new).

Please remember that GitHub issues are public. Never include eBay credentials, OAuth tokens, API keys, private seller information, or personal customer data.

## I Want to Contribute

### Legal Notice

By contributing to ListingOS, you confirm that:

- You authored the contribution or otherwise have the legal right to submit it.
- Your contribution does not knowingly violate another person’s intellectual-property or privacy rights.
- You have permission to submit any third-party code, content, screenshots, images, or data included in the contribution.
- Your contribution may be distributed under the license used by this project.

Do not submit proprietary code or information belonging to an employer, client, customer, or other third party without authorization.

### Reporting Bugs

#### Before Submitting a Bug Report

A useful bug report gives maintainers enough information to understand and reproduce the problem without repeatedly requesting additional details.

Before opening a report:

- Confirm that you are using the latest available version of ListingOS.
- Read the relevant documentation.
- Confirm that the behavior is not caused by an unsupported or incorrectly configured environment.
- Search the [issue tracker](/issues?q=is%3Aissue) for an existing report.
- Check whether the problem occurs consistently.
- Try to isolate the problem from unrelated application code or data.
- Remove credentials and sensitive information from all examples, screenshots, and logs.

Collect the following information where relevant:

- A concise description of the problem
- The expected behavior
- The actual behavior
- Exact reproduction steps
- A minimal reproduction or reduced test case
- Error messages and stack traces
- Screenshots or screen recordings
- Operating system and version
- Device or browser information
- Node.js version
- Package-manager name and version
- Expo, React Native, and application versions
- Relevant dependency versions
- Whether the problem occurs in development, preview, production, or more than one environment
- Whether the issue started after a particular update or configuration change

#### How Do I Submit a Good Bug Report?

Use the repository’s [issue tracker](/issues/new) to report bugs.

A good bug report should include:

1. **A descriptive title**

   Summarize the specific problem rather than using a general title such as “It does not work.”

2. **Environment details**

   Include the relevant operating system, runtime, application, browser, device, and dependency versions.

3. **Reproduction steps**

   Provide a numbered sequence that another person can follow to reproduce the issue.

4. **Expected behavior**

   Explain what you expected ListingOS to do.

5. **Actual behavior**

   Explain what happened instead.

6. **Supporting information**

   Include sanitized logs, screenshots, videos, example inputs, or a minimal reproduction when useful.

7. **Frequency and impact**

   State whether the issue happens every time, intermittently, or only under specific conditions. Explain how it affects your workflow.

After the issue is submitted:

- A maintainer will review and classify it.
- Duplicate reports may be closed in favor of the original issue.
- The team may request additional information or a reduced reproduction.
- Issues that cannot be reproduced may be marked as needing reproduction details.
- Confirmed issues may be labeled according to priority, affected area, and complexity.
- A confirmed issue may be made available for a community contributor to implement.

Do not assign labels unless the repository’s issue form asks you to do so.

> **Important:** Do not report security vulnerabilities through a public GitHub issue. Follow the instructions in [Security Vulnerabilities](#security-vulnerabilities).

### Suggesting Enhancements

Enhancement suggestions include:

- New features
- Improvements to existing features
- User-interface or accessibility improvements
- Developer-experience improvements
- Performance improvements
- New integrations
- Documentation improvements
- Changes to existing workflows

#### Before Submitting an Enhancement

Before opening an enhancement request:

- Confirm that you are using the latest version.
- Review the documentation to determine whether the behavior is already supported.
- Search the [issue tracker](/issues) for an existing suggestion.
- Add relevant information to an existing issue instead of creating a duplicate.
- Consider whether the proposal fits the scope and goals of ListingOS.
- Consider whether the feature would benefit a meaningful portion of the project’s users.
- Think about maintenance, security, privacy, usability, and backward-compatibility implications.

For specialized functionality that would serve only a small number of users, an external integration, extension, or companion package may be more appropriate than a core feature.

#### How Do I Submit a Good Enhancement Suggestion?

Enhancement suggestions are tracked through [GitHub issues](/issues/new).

A useful enhancement request should:

- Use a clear and descriptive title.
- Explain the user problem before describing the proposed solution.
- Identify who would benefit from the enhancement.
- Describe the current behavior.
- Describe the desired behavior.
- Provide a step-by-step example of the proposed workflow.
- Explain why the change belongs in ListingOS.
- Identify possible alternatives or workarounds.
- Include mockups, screenshots, diagrams, or recordings when they improve clarity.
- Note any potential privacy, security, marketplace-policy, or compatibility concerns.
- Link to relevant examples from other projects when appropriate.

Feature requests may be declined when they conflict with the project’s scope, security requirements, product direction, or maintenance capacity. A declined request can still be useful and appreciated.

### Your First Code Contribution

Look for issues labeled `good first issue`, `help wanted`, or a similar contributor-friendly label.

Before beginning substantial work:

1. Read the entire issue and its discussion.
2. Check that nobody is already actively working on it.
3. Comment on the issue to describe the approach you plan to take.
4. Wait for maintainer guidance when the change affects architecture, public APIs, stored data, authentication, publishing behavior, or marketplace integrations.
5. Keep the proposed change focused on the issue being addressed.

A typical contribution workflow is:

1. Fork the repository.
2. Clone your fork locally.
3. Create a branch from the repository’s default branch.
4. Install the project dependencies.
5. Make a focused change.
6. Add or update tests.
7. Run the project’s formatting, linting, type-checking, and test commands.
8. Update documentation when behavior changes.
9. Commit the change with a clear commit message.
10. Push the branch to your fork.
11. Open a pull request.

Example:

```sh
git clone https://github.com/jongan69/ListingOS-AI.git
cd ListingOS-AI
git checkout -b fix/descriptive-branch-name