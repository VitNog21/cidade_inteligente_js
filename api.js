const express = require('express');
const cors = require('cors');
const net = require('net');
const { ClientGatewayRequest, Command } = require('./proto/smart_city_pb');

const app = express();
const PORT = 8001;
const GATEWAY_API_TCP_PORT = 10002; 
const GATEWAY_IP = '127.0.0.1';

app.use(cors({ origin: 'http://localhost:8080' }));
app.use(express.json());

function sendToGateway(requestProto) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        client.setTimeout(2000);

        client.connect(GATEWAY_API_TCP_PORT, GATEWAY_IP, () => {
            client.write(requestProto.serializeBinary());
        });

        let responseData = '';
        client.on('data', (data) => {
            responseData += data.toString();
        });

        client.on('end', () => {
            try {
                resolve(JSON.parse(responseData));
            } catch (e) {
                reject(new Error('Resposta inválida do Gateway.'));
            }
        });

        client.on('error', (err) => {
            reject(new Error('Não foi possível conectar ao Gateway: ' + err.message));
        });

        client.on('timeout', () => {
            client.destroy();
            reject(new Error('Timeout na conexão com o Gateway.'));
        });
    });
}

app.get('/api/devices', async (req, res) => {
    try {
        const request = new ClientGatewayRequest();
        request.setListDevices('LIST');
        const response = await sendToGateway(request);
        res.json(response);
    } catch (error) {
        console.error("[API Error]", error.message);
        res.status(500).json({ error: error.message, devices: [] });
    }
});

app.post('/api/devices/:deviceId/command', async (req, res) => {
    try {
        const command = new Command();
        command.setDeviceId(req.params.deviceId);
        command.setAction(req.body.action);

        const request = new ClientGatewayRequest();
        request.setCommandDevice(command);

        const response = await sendToGateway(request);
        res.json(response);
    } catch (error) {
        console.error("[API Error]", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`API do Cliente Web rodando na porta ${PORT}`));