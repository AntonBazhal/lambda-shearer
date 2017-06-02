# lambda-shearer

`lambda-shearer` is a Node CLI tool that helps to configure [AWS Lambda][aws-lambda-url] function resources properly.
It runs lambda function with a predefined set of memory settings and returns min/max/average for each.
This way, it is easier to make a decision about optimal configuration based on needs and [cost][cost-calculator-url].

## Usage

Requires Node 6.x or higher. AWS credentials [must be preconfigured][credentials-url] before use.

```bash
npm install -g lambda-shearer
```

```bash
> lambda-shearer -h

Options:
  --lambda, -l   lambda function name or ARN                          [required]
  --payload, -p  path to a file that contains JSON payload or function that
                 produces one (is invoked with one argument: index)   [required]
  --region, -r   AWS region
  --repeats, -n  number of lambda function invocations for each memory setting
                                                                   [default: 10]
  --steps, -s    comma-separated list of memory settings, in MB, for your lambda
                 function to be tested with                           [required]
```

Example:
```bash
> lambda-shearer -l <function name or ARN> -s 128,512,1024 -r us-east-1 -n 100 -p ./payload.json

RESULTS:
128MB:
        MIN: 5465ms
        MAX: 8540ms
        AVG: 6868ms
512MB:
        MIN: 1292ms
        MAX: 2350ms
        AVG: 1696ms
1024MB:
        MIN: 495ms
        MAX: 896ms
        AVG: 690ms
```

## Limitations

Tool does not handle failed invocations.

## Code style

This repository is configured with [EditorConfig][editorconfig-url] and [ESLint][eslint-url] rules.

## Contributing

Contributors and PRs are always welcome.

## License

The MIT License (MIT)

Copyright (c) 2017 Anton Bazhal

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[aws-lambda-url]: https://aws.amazon.com/lambda/details/
[cost-calculator-url]: http://serverlesscalc.com/
[credentials-url]: http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html
[editorconfig-url]: http://editorconfig.org/
[eslint-url]: http://eslint.org/
