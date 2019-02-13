# Simple Request Library

[![Build Status](https://travis-ci.org/brozeph/reqlib.svg?branch=master)](https://travis-ci.org/brozeph/reqlib) [![Coverage Status](https://coveralls.io/repos/github/brozeph/reqlib/badge.svg)](https://coveralls.io/github/brozeph/reqlib)

## Request

`new Request(options)`



```javascript
import { Request } from 'reqlib';

const
  options = {
    maxRedirectCount : 5, // # of redirects to follow
    maxRetryCount : 3, // # of times to retry in the event of a 5xx
    timeout : 1000 // milliseconds
  },
  req = new Request(options);

(async () => {
  try {
    let result = await req.get('https://test.api.io/v1/tests');
    console.log(result);
  } catch (ex) {
    console.error(ex);
  }
})();
```

### delete

### get

### head

### patch

### post

### put

## Resource
