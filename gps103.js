// get more info about the protocol from:
// https://www.traccar.org/protocols/
// https://dl.dropboxusercontent.com/s/4r372ek1yarknb8/GPRS%20data%20protocol.xls

module.exports = Gps103 = function () {
    this.msgBufferRaw = new Array();
    this.msgBuffer = new Array();
    this.imei = null;
}

// if multiple message are in the buffer, it will store them in msgBuffer
// the state of the last message will be represented in Gps103
Gps103.prototype.parse = function (msg) {
    this.msgBufferRaw.length = 0;
    let messages = msg.toString().split(';').slice(0, -1); // slice off empty ele
    let loginRegex = /\#\#,imei:(\d{15}),A$/;
    let heartbeatRegex = /^\d{15}$/;
    let alarmRegex = /^imei:\d{15}.*$/;

    messages.forEach((msg, idx) => {
        this.msgBufferRaw.push(msg);
        let parsed = {};
        // login
        if (loginRegex.test(msg)) {
            let imei = loginRegex.exec(msg);
            parsed.imei = parseInt(imei[1]);
            parsed.responseMsg = 'LOAD';
            parsed.expectsResponse = true;
            parsed.event = { number: 0x01, string: 'login' };
        }

        // heartbeat
        if (heartbeatRegex.test(msg)) {
            parsed.responseMsg = 'ON';
            parsed.expectsResponse = true;
            parsed.event = { number: 0x02, string: 'heartbeat' };
        }

        // alarm message
        if (alarmRegex.test(msg)) {
            let data = msg.split(',');
            parsed.expectsResponse = false;
            parsed.imei = parseInt(data[0].split(':')[1]);
            parsed.info = data[1];
            parsed.gpsTime = getGpsTime(data[2]);
            parsed.fixTimestamp = getFixTime(data[2], data[5]);
            if (parsed.fixTimestamp) {
                let date = new Date(parsed.fixTimestamp * 1000);
                parsed.fixTime = date.toISOString();
            }
            parsed.notSure1 = data[3];
            parsed.hasFix = Boolean(getFixType(data[4]));
            parsed.lat = getLatitude(data[8], data[7]);
            parsed.lon = getLongitude(data[10], data[9]);
            parsed.speed = parseFloat(data[11]);
            if (parsed.hasFix) {
                parsed.course = parseInt(data[12].split(':')[0]);
            } else {
                parsed.course = NaN;
            }
            parsed.event = { number: 0x12, string: 'location' };
            parsed.responseMsg = null;
        }
        parsed.parseTime = Date.now();
        // last message represents the obj state
        // and all go to the buffer for looped forwarding in the app
        if (idx === (messages.length - 1)) {
            Object.assign(this, parsed);
        }
        this.msgBuffer.push(parsed);
    });
}

Gps103.prototype.encode = function (data) {
    let msg = "";
    switch (data.event.number) {
        case 0x01: // login
            msg = "##,imei:" + data.imei + ",A;";
            break;
        case 0x02: // hearbeat
            msg = data.imei + ";";
            break;
        case 0x12: // location
            msg = "imei:" + data.imei;
            msg = appendCsvText(msg, data.info);
            msg = appendCsvText(msg, encGpsTime(data.gpsTime));
            msg = appendCsvText(msg, ''); // notSure1 is always ''
            msg = appendCsvText(msg, encFixType(data.hasFix));
            msg = appendCsvText(msg, encFixTime(data.fixTime));
            msg = appendCsvText(msg, 'A'); // notSure2 is always 'A'
            msg = appendCsvText(msg, encLatitude(data.lat));
            msg = appendCsvText(msg, encLongitude(data.lon));
            msg = appendCsvText(msg, data.speed.toFixed(2));
            msg = appendCsvText(msg, data.course);
            msg = msg + ';';
            break;
        default:
            break;
    }
    return new Buffer.from(msg);
}

Gps103.prototype.clearMsgBuffer = function () {
    this.msgBuffer.length = 0;
}

function appendCsvText(string, part) {
    return string + ',' + part;
}

function getGpsTime(dateStr) {
    return new Date(Date.UTC(
        parseInt(dateStr.slice(0, 2)) + 2000,
        parseInt(dateStr.slice(2, 4)) - 1,
        parseInt(dateStr.slice(4, 6)),
        parseInt(dateStr.slice(6, 8)),
        parseInt(dateStr.slice(8, 10)),
        parseInt(dateStr.slice(10, 12))
    ));
}

function encGpsTime(gpsTime) {
    let dateTime = new Date(gpsTime);
    let result = addLeadingZero(dateTime.getUTCFullYear() - 2000);
    result += addLeadingZero(dateTime.getUTCMonth() + 1);
    result += addLeadingZero(dateTime.getUTCDate());
    result += addLeadingZero(dateTime.getUTCHours());
    result += addLeadingZero(dateTime.getUTCMinutes());
    result += addLeadingZero(dateTime.getUTCSeconds());
    return result;
}

function addLeadingZero(number, amount = 1) {
    let leadZeros = '';
    for (let i = amount; i > 0; i--) {
        if (number < Math.pow(10, i)) {
            leadZeros = leadZeros + '0';
        }
    }
    return leadZeros + number;
}

function getFixTime(dateStr, timeStr) {
    let date = new Date(Date.UTC(
        parseInt(dateStr.slice(0, 2)) + 2000,
        parseInt(dateStr.slice(2, 4)) - 1,
        parseInt(dateStr.slice(4, 6)),
        parseInt(timeStr.slice(0, 2)),
        parseInt(timeStr.slice(2, 4)),
        parseInt(timeStr.slice(4, 6))
    ));
    return date.getTime() / 1000;
}

function encFixTime(timestamp) {
    let dateTime = new Date();
    dateTime.setTime(timestamp * 1000);
    let result = addLeadingZero(dateTime.getUTCHours());
    result += addLeadingZero(dateTime.getUTCMinutes());
    result += addLeadingZero(dateTime.getUTCSeconds());
    return result + '.000';
}

function getFixType(fL) {
    if (fL === 'F') {
        return 1;
    }
    return 0;
}

function encFixType(hasFix) {
    if (hasFix) {
        return 'F';
    }
    return 'L';
}

function getLatitude(ns, data) {
    if (!(/N|S/.test(ns))) {
        return 0.0;
    }

    let dd = parseInt(data.slice(0, 2));
    let mm = parseFloat(data.slice(2));
    let lat = dd + (mm / 60);

    if (ns === 'S') {
        lat *= -1;
    }
    return parseFloat(lat.toFixed(8));
}

function getLongitude(ew, data) {
    if (!(/E|W/.test(ew))) {
        return 0.0;
    }

    let dd = parseInt(data.slice(0, 3));
    let mm = parseFloat(data.slice(3));
    let lat = dd + (mm / 60);

    if (ew === 'W') {
        lat *= -1;
    }
    return parseFloat(lat.toFixed(8));
}

function encLatitude(lat) {
    let charNS = 'N';
    if (lat < 0) {
        charNS = 'S';
    }
    let dd = parseInt(Math.abs(lat));
    dd = addLeadingZero(dd);
    let mm = ((Math.abs(lat) - dd) * 60).toFixed(4);
    mm = addLeadingZero(mm);
    return '' + dd + mm + ',' + charNS;
}

function encLongitude(lon) {
    let charEW = 'E';
    if (lon < 0) {
        charEW = 'W';
    }
    let dd = parseInt(Math.abs(lon));
    dd = addLeadingZero(dd, 2);
    let mm = ((Math.abs(lon) - dd) * 60).toFixed(4);
    mm = addLeadingZero(mm);
    return '' + dd + mm + ',' + charEW;
}
