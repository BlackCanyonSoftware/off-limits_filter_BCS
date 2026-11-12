# Security

Off-Limits is a safeguard for people who want to control what their AI assistants can see. If something in it does not work the way its documentation says, we want to hear about it.

## Reporting a problem

Please report it privately, so it can be fixed before it is discussed in public:

1. Open the repository on GitHub and choose **Security**.
2. Choose **Report a vulnerability**.
3. Describe what you did, what you expected and what happened. A short example using made-up names (such as `client-alpha`) is ideal. Please do not include your real policy or real names.

You should get a first reply within a week. We will tell you when it is fixed, and credit you in the changelog if you would like that.

## What is useful to report

- A way for text, a path or a command that a layer is documented to cover to get past that layer.
- A case where a refusal, an error message, a test result or a log line reveals something from the policy.
- A case where the guard, the filter or a command lets input through when it cannot read or understand the policy.
- A way for a session to change or read the policy, the guard's settings or its program files when the documentation says it cannot.

The [threat model](docs/THREAT-MODEL.md) says what each layer covers and what it does not. Differences between that page and what the tool does are bugs too.

## Supported versions

Off-Limits is in early development. Only the latest release receives fixes.
