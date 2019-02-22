# Alexa MBTA Bus Time

An Alexa Skill which tells you the upcoming predictions/schedules of specific routes at specific stops.

Please look up your bus stop ID via https://www.mbta.com/schedules/bus. The ID will be present in the URL. (Additional feature coming up to determine from spoken name.)

### Core features

  - Configure favorite stops with names
  - Configure favorite routes at stops
  - Get summary of route times at specific stops
  - Get specific route times at favorite stop

### How to use skill (example utterances)

> Add stop 123
> Add stop 123 as "Home"
> Add route 456
> Add route 456 to "Home"
> Get summary
> Give me a summary
> Get summary at "Home"
> Get route 456
> Get route 456 at "Home"
> Delete stop
> Delete route 456

### Installation

Go to the Alexa App on your device and enable skill "Bus Time".

### Building

Code requires [Node.js](https://nodejs.org/) v6+ to build.

Install the dependencies and devDependencies and start the server.

```sh
$ cd alexa-mbta-bus-time
$ npm install
$ rm -rf bus-time.zip
$ zip -r bus-time.zip *
$ aws lambda update-function-code --function-name xxx --zip-file fileb://bus-time.zip
```

### Todos

 - Write Tests

License
----

MIT © Wenhao Lee

### Contact

Please let me know if you have any suggestions at wenceslauslee@gmail.com.