const dgram = require('dgram');
const net = require('net');
const { DiscoveryPacket, GatewayRequest, SensorData, ClientGatewayRequest, Command } = require('./proto/smart_city_pb');

const MCAST_ADDR = '224.1.1.1';
const MCAST_PORT = 5007;
const DEVICE_TCP_PORT = 10000; // Porta para os dispositivos
const API_TCP_PORT = 10002;    // Nova porta para a API
const UDP_PORT = 10001;

const devices = {}; // { id: { info, socket } }

// --- Servidores ---
function startDiscoveryService() {
    const multicastSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    setInterval(() => {
        const request = new GatewayRequest();
        request.setAction('DISCOVER');
        const message = request.serializeBinary();
        multicastSocket.send(message, 0, message.length, MCAST_PORT, MCAST_ADDR);
    }, 15000);
    console.log('Gateway: Serviço de descoberta periódica iniciado.');
}

function startUdpServer() {
    const udpServer = dgram.createSocket('udp4');
    udpServer.on('message', (msg) => {
        try {
            const sensorData = SensorData.deserializeBinary(msg);
            const deviceId = sensorData.getDeviceId();
            if (devices[deviceId]) {
                devices[deviceId].info.setStatus(`${parseInt(sensorData.getValue())}°C`);
            }
        } catch (e) { /* Ignorar pacotes malformados */ }
    });
    udpServer.bind(UDP_PORT, () => console.log(`Gateway: Servidor UDP escutando na porta ${UDP_PORT}`));
}

function startDeviceTcpServer() {
    const deviceServer = net.createServer((socket) => {
        let deviceId = null;
        socket.on('data', (data) => {
            try {
                const discoveryPacket = DiscoveryPacket.deserializeBinary(data);
                deviceId = discoveryPacket.getInfo().getId();
                const isNew = !devices[deviceId];
                devices[deviceId] = { info: discoveryPacket.getInfo(), socket: socket };
                socket.id = deviceId;
                
                if (isNew) console.log(`Gateway: Dispositivo ${deviceId} se registrou.`);
                else console.log(`Gateway: Estado do atuador ${deviceId} atualizado para ${discoveryPacket.getInfo().getStatus()}`);

            } catch (err) { /* Ignorar erros de decodificação */ }
        });

        socket.on('close', () => {
            if (deviceId) {
                console.log(`Gateway: Dispositivo ${deviceId} desconectado.`);
                delete devices[deviceId];
            }
        });
        socket.on('error', () => {});
    });
    deviceServer.listen(DEVICE_TCP_PORT, () => console.log(`Gateway: Servidor TCP para Dispositivos escutando na porta ${DEVICE_TCP_PORT}`));
}

function startApiTcpServer() {
    const apiServer = net.createServer((clientSocket) => {
        clientSocket.on('data', (data) => {
            try {
                const request = ClientGatewayRequest.deserializeBinary(data);
                handleApiRequest(request, clientSocket);
            } catch (err) {
                clientSocket.end();
            }
        });
        clientSocket.on('error', () => {});
    });
    apiServer.listen(API_TCP_PORT, () => console.log(`Gateway: Servidor TCP para API escutando na porta ${API_TCP_PORT}`));
}

function handleApiRequest(request, clientSocket) {
    let responseJson = "{}";
    if (request.hasListDevices()) {
        const deviceList = Object.values(devices).map(d => d.info.toObject());
        responseJson = JSON.stringify({ devices: deviceList });
    } else if (request.hasCommandDevice()) {
        const command = request.getCommandDevice();
        const targetDevice = devices[command.getDeviceId()];
        if (targetDevice && targetDevice.socket && !targetDevice.socket.destroyed) {
            targetDevice.socket.write(command.serializeBinary());
            responseJson = JSON.stringify({ status: 'success' });
        } else {
            responseJson = JSON.stringify({ status: 'error', message: 'Dispositivo não encontrado ou desconectado' });
        }
    }
    clientSocket.write(responseJson);
    clientSocket.end();
}

// --- Iniciar todos os serviços ---
startDiscoveryService();
startUdpServer();
startDeviceTcpServer();
startApiTcpServer();