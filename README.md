# GPS103 Message Parser
This is a GPS103 GPS Tracker message parser implementation. It can be used to implement your own server.
It parses all messages received from the device and creates the response message, if needed.

## Usage
```
const Gps103 = require('gps103');
const net = require('net');

var server = net.createServer((client) => {
  var gps103 = new Gps103();
  console.log('client connected');

  client.on('data', (data) => {
    try {
      gps103.parse(data);
    }
    catch (e) {
      console.log('err', e);
      return;
    }

    if (gps103.expectsResponse) {
      client.write(gps103.responseMsg);
    }

    gps103.msgBuffer.forEach(msg => {
      console.log(msg);
    });

    gps103.clearMsgBuffer();
  });
});

server.listen(serverPort, () => {
  console.log('started server on port:', 4711);
});

```