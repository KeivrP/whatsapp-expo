import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, FlatList } from 'react-native';
import { NetworkInfo } from 'react-native-network-info';
import TcpSocket from 'react-native-tcp-socket';

interface Message {
  id: number;
  text: string;
  sender: 'Me' | 'Other';
}

export default function App() {
  const [ipAddress, setIpAddress] = useState('');
  const [ipServer, setIpServer] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Desconectado');
  const [isServer, setIsServer] = useState(false);
  const [server, setServer] = useState<TcpSocket.Server | null>(null);
  const [client, setClient] = useState<TcpSocket.Socket | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const fetchIpAddress = async () => {
      const ip = await NetworkInfo.getIPV4Address();
      console.log(ip);
      setIpAddress(ip);
    };
    fetchIpAddress();
  }, []);

  useEffect(() => {
    if (isServer) {
      const tcpServer = TcpSocket.createServer((socket) => {
        console.log('Cliente conectado:', socket.address());
        socket.on('data', (data) => {
          const receivedMessage = data.toString();
          if (receivedMessage === '__HEARTBEAT__') {
            socket.write('__HEARTBEAT_ACK__');
            return;
          }
          setMessages((prev) => [...prev, { id: Date.now(), text: receivedMessage, sender: 'Other' }]);
        });

        socket.on('error', (error) => {
          console.error('Server Error:', error);
          socket.destroy();
        });
        socket.on('close', () => console.log('Cliente desconectado'));
      });

      tcpServer.listen({ port: 5050, host: '0.0.0.0', reuseAddress: true }, () => {
        setConnectionStatus(`Servidor en espera en IP: ${ipAddress}`);
        console.log(`Servidor TCP escuchando en IP: ${ipAddress}, puerto: 5050`);
      });

      setServer(tcpServer);
    } else {
      if (!ipServer.trim()) {
        setConnectionStatus('Error: Debe ingresar la IP del servidor');
        return;
      }

      setConnectionStatus('Intentando conectar...');
      const tcpClient = TcpSocket.createConnection({ 
        port: 5050, 
        host: ipServer.trim(),
        timeout: 5000,
        reuseAddress: true
      }, () => {
        setConnectionStatus(`Conectado al servidor ${ipServer}`);
        // Iniciar heartbeat
        const heartbeatInterval = setInterval(() => {
          if (tcpClient && tcpClient.writable) {
            tcpClient.write('__HEARTBEAT__');
          }
        }, 5000);

        tcpClient.on('close', () => {
          clearInterval(heartbeatInterval);
          setConnectionStatus('Desconectado');
        });
      });

      tcpClient.on('data', (data) => {
        const receivedMessage = data.toString();
        if (receivedMessage === '__HEARTBEAT_ACK__') return;
        setMessages((prev) => [...prev, { id: Date.now(), text: receivedMessage, sender: 'Other' }]);
      });

      tcpClient.on('error', (error) => {
        console.error('Error de conexión:', error);
        setConnectionStatus(`Error de conexión: ${error.message}`);
        tcpClient.destroy();
      });
      tcpClient.on('close', () => setConnectionStatus('Desconectado'));

      setClient(tcpClient);
    }

    return () => {
      server?.close();
      client?.destroy();
      setConnectionStatus('Desconectado');
    };
  }, [isServer]);

  const sendMessage = () => {
    if (!client || !messageText.trim()) return;

    client.write(messageText);
    setMessages((prev) => [...prev, { id: Date.now(), text: messageText, sender: 'Me' }]);
    setMessageText('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <View style={styles.content}>
        <Text style={styles.statusText}>{connectionStatus}</Text>

        <TouchableOpacity 
          style={[styles.button, isServer ? styles.stopButton : styles.startButton]}
          onPress={() => setIsServer(!isServer)}
        >
          <Text style={styles.buttonText}>
            {isServer ? 'Detener Servidor' : 'Iniciar Servidor'}
          </Text>
        </TouchableOpacity>

        {!isServer && (
          <TextInput
            placeholder="IP del servidor"
            onChangeText={setIpServer}
            value={ipServer}
            style={styles.input}
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        )}

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={[styles.messageBubble, item.sender === 'Me' ? styles.sentMessage : styles.receivedMessage]}>
              <Text style={styles.messageText}>{item.text}</Text>
            </View>
          )}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.inputMessage}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#999"
            value={messageText}
            onChangeText={setMessageText}
          />
          <TouchableOpacity 
            style={[styles.button, styles.sendButton]}
            onPress={sendMessage}
          >
            <Text style={styles.buttonText}>Enviar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  sendButton: {
    backgroundColor: '#2196F3',
    marginTop: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  inputMessage: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 10,
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4CAF50',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ddd',
  },
  messageText: {
    color: '#fff',
  },
});