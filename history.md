# v1.0.6 - 03/05/2019

* Added statusCode property from response to error when available
* Fixed issue where 204 (no content) or an empty body caused parsing to fail

# v1.0.5 - 02/28/2019

* Added check for timeout option provided as a string

# v1.0.4 - 02/26/2019

* Updated dev dependency for nyc (security patch)
* Fixed issue that occurred when data passed for writing to the request stream was not properly serialized

# v1.0.3 - 02/26/2019

* Added support for failover / multiple hosts in request

# v1.0.2 - 02/13/2019

* Added more unit tests
* Fixed issue where redirects fail when location header value begins with '//' instead of protocol

# v1.0.1 - 02/13/2019

* Initial release - fleshing out Request functionality

# v1.0.0 - 01/30/2019

* Strawman release - hold on NPM namespace