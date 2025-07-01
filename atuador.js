const dgram = require('dgram');
const net = require('net');
const { DeviceType, DeviceInfo, DiscoveryPacket, GatewayRequest, Command } = require('./proto/smart_city_pb');

const MCAST_ADDR = '224.1.1.1';
const MCAST_PORT = 5007;
const GATEWAY_TCP_PORT = 10000;
const DEVICE_ID = 'lamp_01';

let status = 'OFF';
let clientSocket = null;

function createDiscoveryPacket() {
    const deviceInfo = new DeviceInfo();
    deviceInfo.setId(DEVICE_ID);
    deviceInfo.setType(DeviceType.LAMP);
    deviceInfo.setStatus(status);

    const discoveryPacket = new DiscoveryPacket();
    discoveryPacket.setInfo(deviceInfo);
    return discoveryPacket;
}

function connectToGateway(gatewayIp) {
    if (clientSocket) {
        clientSocket.destroy();
    }
    clientSocket = new net.Socket();

    clientSocket.connect(GATEWAY_TCP_PORT, gatewayIp, () => {
        console.log(`${DEVICE_ID}: Conectado ao Gateway. Registrando...`);
        const registrationMessage = createDiscoveryPacket().serializeBinary();
        clientSocket.write(registrationMessage);
    });

    clientSocket.on('data', (data) => {
        try {
            const command = Command.deserializeBinary(data);
            if (command.getAction() === 'TURN_ON' || command.getAction() === 'TURN_OFF') {
                status = command.getAction().replace('TURN_', '');
                console.log(`${DEVICE_ID}: Status alterado para ${status}`);
                const updateMessage = createDiscoveryPacket().serializeBinary();
                clientSocket.write(updateMessage);
            }
        } catch(e) { }
    });

    clientSocket.on('close', () => {
        console.log(`${DEVICE_ID}: Conexão com Gateway perdida.`);
        startDiscovery(); 
    });

    clientSocket.on('error', (err) => {        
    });
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
        } catch(e) {/* Ignorar */}
    });

    discoverySocket.bind(MCAST_PORT, () => {
        discoverySocket.addMembership(MCAST_ADDR);
        console.log(`${DEVICE_ID}: Aguardando descoberta...`);
    });
}

startDiscovery();