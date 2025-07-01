const dgram = require('dgram');
const net = require('net');
const { DeviceType, DeviceInfo, DiscoveryPacket, GatewayRequest, SensorData } = require('./proto/smart_city_pb');

const MCAST_ADDR = '224.1.1.1';
const MCAST_PORT = 5007;
const GATEWAY_TCP_PORT = 10000;
const GATEWAY_UDP_PORT = 10001;
const DEVICE_ID = 'temp_sensor_01';

let clientSocket = null;
let udpInterval = null;

function connectToGateway(gatewayIp) {
    if (clientSocket) clientSocket.destroy();
    if (udpInterval) clearInterval(udpInterval);
    
    const udpSocket = dgram.createSocket('udp4');
    clientSocket = new net.Socket();

    clientSocket.connect(GATEWAY_TCP_PORT, gatewayIp, () => {
        console.log(`${DEVICE_ID}: Conectado ao Gateway. Registrando...`);
        const initialStatus = `${20 + Math.floor(Math.random() * 11)}°C`;
        
        const deviceInfo = new DeviceInfo();
        deviceInfo.setId(DEVICE_ID);
        deviceInfo.setType(DeviceType.TEMP_SENSOR);
        deviceInfo.setStatus(initialStatus);

        const discoveryPacket = new DiscoveryPacket();
        discoveryPacket.setInfo(deviceInfo);

        clientSocket.write(discoveryPacket.serializeBinary());

        udpInterval = setInterval(() => {
            const temperature = 20.0 + Math.random() * 15.0;
            const sensorData = new SensorData();
            sensorData.setDeviceId(DEVICE_ID);
            sensorData.setValue(temperature);
            
            const message = sensorData.serializeBinary();
            udpSocket.send(message, GATEWAY_UDP_PORT, gatewayIp);
            console.log(`${DEVICE_ID}: Enviado ${parseInt(temperature)}°C via UDP.`);
        }, 15000);
    });

    clientSocket.on('close', () => {
        console.log(`${DEVICE_ID}: Conexão com Gateway perdida.`);
        clearInterval(udpInterval);
        startDiscovery(); 
    });

    clientSocket.on('error', (err) => {});
}

function startDiscovery() {
    const discoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    discoverySocket.on('error', (err) => { discoverySocket.close(); });
    
    discoverySocket.on('message', (msg, rinfo) => {
        try {
            const gatewayRequest = GatewayRequest.deserializeBinary(msg);
            if (gatewayRequest.getAction() === 'DISCOVER') {
                console.log(`${DEVICE_ID}: Gateway encontrado em ${rinfo.address}.`);
                discoverySocket.close();
                connectToGateway(rinfo.address);
            }
        } catch(e) {}
    });

    discoverySocket.bind(MCAST_PORT, () => {
        discoverySocket.addMembership(MCAST_ADDR);
        console.log(`${DEVICE_ID}: Aguardando descoberta...`);
    });
}

startDiscovery();