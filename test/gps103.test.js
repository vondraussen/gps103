const Gps103 = require('../gps103');

// Login
// ##,imei:123456789012345,A;

// Heartbeat every 1 min
// 123456789012345;

// imei:123456789012345,acc on,190323190956,,F,180953.000,A,4856.1241,N,00929.9720,E,0.00,0;
// imei:123456789012345,acc off,190323192449,,F,182449.000,A,4856.2782,N,00931.1914,E,0.00,0;
// imei:123456789012345,ac alarm,150811145623,,F,135623.000,A,4824.5933,N,00911.2830,E,0.00,0;


const login = new Buffer.from('##,imei:123456789012345,A;')
const loginResult = {
    imei: 123456789012345,
    responseMsg: 'LOAD',
    expectsResponse: true,
    event: { number: 0x01, string: 'login' }
}

const heartbeat = new Buffer.from('123456789012345;')
const heartbeatResult = {
    imei: 123456789012345, // this should still be there from the login
    responseMsg: 'ON',
    expectsResponse: true,
    event: { number: 0x02, string: 'heartbeat' }
}


const location = new Buffer.from('imei:123456789012345,acc on,190323190955,,F,180953.000,A,4856.1241,N,00929.9720,E,0.00,0;')
const locationResult = {
    imei: 123456789012345,
    expectsResponse: false,
    event: { number: 0x12, string: 'location' },
    info: 'acc on',
    hasFix: true,
    gpsTime: '2019-03-23T19:09:55.000Z',
    fixTime: 1553364593,
    lat: 48.93540167,
    lon: 9.49953333,
    speed: 0,
    course: 0
}

const locationNone = new Buffer.from('imei:123456789012345,low battery,000000000,13554900601,L,;')
const locationNoneResult = {
    imei: 123456789012345,
    expectsResponse: false,
    info: 'low battery',
    hasFix: false,
    lat: 0,
    lon: 0,
    speed: NaN,
    course: NaN
}

const locationDouble = new Buffer.from('imei:123456789012345,acc on,190323190956,,F,180953.000,A,4856.1241,N,00929.9720,E,0.00,0;imei:123456789012345,acc on,190323190957,,F,180953.000,A,4856.1241,N,00929.9720,E,0.00,0;')
const locationTriple = new Buffer.from('imei:123456789012345,acc on,190323190958,,F,180953.000,A,4856.1241,N,00929.9720,E,0.00,0;imei:123456789012345,acc on,190323190959,,F,180953.000,A,4856.1241,N,00929.9720,E,0.00,0;imei:123456789012345,acc on,190323191000,,F,180953.000,A,4856.1241,N,00929.9720,E,0.00,0;')
const locationQuad = new Buffer.from('imei:123456789012345,acc on,190323191001,,F,180953.000,A,4856.1241,N,00929.9720,E,0.00,0;123456789012345;imei:123456789012345,acc on,190323191002,,F,180953.000,A,4856.1241,N,00929.9720,E,0.00,0;imei:123456789012345,acc on,190323191003,,F,180953.000,A,4856.1241,N,00929.9720,E,0.00,0;')

test('Login Test', () => {
    let gps103 = new Gps103();
    gps103.parse(login);

    expect(gps103.imei).toBe(loginResult.imei);
    expect(gps103.responseMsg).toStrictEqual(loginResult.responseMsg);
    expect(gps103.expectsResponse).toBe(loginResult.expectsResponse);
    expect(gps103.event).toStrictEqual(loginResult.event);
});

test('Heartbeat Test', () => {
    let gps103 = new Gps103();
    gps103.parse(login);
    gps103.parse(heartbeat);

    expect(gps103.imei).toBe(heartbeatResult.imei);
    expect(gps103.responseMsg).toStrictEqual(heartbeatResult.responseMsg);
    expect(gps103.expectsResponse).toBe(heartbeatResult.expectsResponse);
    expect(gps103.event).toStrictEqual(heartbeatResult.event);
});

test('Alarm/Location Test', () => {
    let gps103 = new Gps103();
    gps103.parse(login);
    gps103.parse(location);

    expect(gps103.imei).toBe(locationResult.imei);
    expect(gps103.responseMsg).toBeNull();
    expect(gps103.expectsResponse).toBe(locationResult.expectsResponse);
    expect(gps103.info).toBe(locationResult.info);
    expect(gps103.lat).toBe(locationResult.lat);
    expect(gps103.lon).toBe(locationResult.lon);
    expect(gps103.speed).toBe(locationResult.speed);
    expect(gps103.course).toBe(locationResult.course);
    expect(gps103.hasFix).toBe(locationResult.hasFix);

    gps103.parse(locationNone);
    expect(gps103.imei).toBe(locationNoneResult.imei);
    expect(gps103.responseMsg).toBeNull();
    expect(gps103.expectsResponse).toBe(locationNoneResult.expectsResponse);
    expect(gps103.info).toBe(locationNoneResult.info);
    expect(gps103.lat).toBe(locationNoneResult.lat);
    expect(gps103.lon).toBe(locationNoneResult.lon);
    expect(gps103.speed).toBe(locationNoneResult.speed);
    expect(gps103.course).toBe(locationNoneResult.course);
    expect(gps103.hasFix).toBe(locationNoneResult.hasFix);
});

test('Multiple Messages Test', () => {
    let gps103 = new Gps103();
    gps103.parse(location);
    expect(gps103.msgBufferRaw.length).toBe(1);
    gps103.parse(locationDouble);
    expect(gps103.msgBufferRaw.length).toBe(2);
    gps103.parse(locationTriple);
    expect(gps103.msgBufferRaw.length).toBe(3);
    gps103.parse(locationQuad);
    expect(gps103.msgBufferRaw.length).toBe(4);

    expect(gps103.msgBuffer.length).toBe(1 + 2 + 3 + 4);
    gps103.clearMsgBuffer();
    gps103.parse(locationQuad);
    expect(gps103.msgBuffer.length).toBe(4);
});

test('Encoding Test', () => {
    let gps103 = new Gps103();
    let msg = gps103.encode(loginResult);
    expect(msg).toStrictEqual(login);
    msg = gps103.encode(heartbeatResult);
    expect(msg).toStrictEqual(heartbeat);
    msg = gps103.encode(locationResult);
    expect(msg).toStrictEqual(location);
});
