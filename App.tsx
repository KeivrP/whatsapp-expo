import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, FlatList, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NetworkInfo } from 'react-native-network-info';
import TcpSocket from 'react-native-tcp-socket';

interface Message {
  id: number;
  text: string;
  sender: 'Me' | 'Other';
}

export default function App() {
  const [ipAddress, setIpAddress] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [targetIp, setTargetIp] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Desconectado');
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [ipHistory, setIpHistory] = useState<string[]>([]);
  const clientRef = useRef<TcpSocket.Socket | null>(null);
  const serverRef = useRef<TcpSocket.Server | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Obtener dirección IP y nombre del dispositivo al iniciar
    const initializeDevice = async () => {
      const ip = await NetworkInfo.getIPV4Address();
      setIpAddress(ip || '');
      setDeviceName( 'ChatTCP: ' + ip || '');
      startServer(ip || '');
    };
    initializeDevice();

    return () => {
      serverRef.current?.close();
      clientRef.current?.destroy();
    };
  }, []);

  const startServer = (ip: string) => {
    const server = TcpSocket.createServer(socket => {
      socket.on('data', (data) => {
        const message = data.toString();
        if (message === '__HEARTBEAT__') {
          socket.write('__HEARTBEAT_ACK__');
          return;
        }
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        inactivityTimerRef.current = setTimeout(() => {
          disconnectPeer();
        }, 30000); // 30 seconds timeout
        setMessages(prev => [...prev, { id: Date.now(), text: message, sender: 'Other' }]);
      });

      socket.on('error', (error) => {
        console.log('Error en conexión entrante:', error);
      });
    });

    server.listen({ port: 5050, host: ip, reuseAddress: true }, () => {
      console.log('Servidor escuchando en', ip);
      setConnectionStatus(`Esperando conexión en: ${ip}`);
    });

    serverRef.current = server;
  };

  const connectToPeer = () => {
    if (!targetIp.trim() || isConnected) return;

    const client = TcpSocket.createConnection({
      host: targetIp,
      port: 5050,
      timeout: 5000
    });

    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        disconnectPeer();
      }, 30000); // 30 segundos
    };

    client.on('connect', () => {
      console.log('Conexión exitosa con:', targetIp);
      setConnectionStatus(`Conectado a: ${targetIp}`);
      setIsConnected(true);
      setIpHistory(prev => [...new Set([...prev, targetIp])]);
      resetInactivityTimer();
      
      // Heartbeat
      const interval = setInterval(() => {
        if (client.writable) client.write('__HEARTBEAT__');
      }, 5000);

      client.on('close', () => {
        clearInterval(interval);
        setIsConnected(false);
        setConnectionStatus('Desconectado');
      });
    });

    client.on('data', (data) => {
      const message = data.toString();
      if (message === '__HEARTBEAT_ACK__') return;
      setMessages(prev => [...prev, { id: Date.now(), text: message, sender: 'Other' }]);
    });

    client.on('error', (error) => {
      console.log('Error de conexión:', error);
      setConnectionStatus(`Error: ${error.message}`);
      setIsConnected(false);
    });

    clientRef.current = client;
  };

  const sendMessage = () => {
    if (!messageText.trim() || !clientRef.current || !isConnected) return;

    clientRef.current.write(messageText);
    setMessages(prev => [...prev, { id: Date.now(), text: messageText, sender: 'Me' }]);
    setMessageText('');
  };

  const disconnectPeer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (clientRef.current) {
      clientRef.current.destroy();
      clientRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus('Desconectado');
    setMessages([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f065a" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{deviceName}</Text>
        <Text style={styles.headerSubtitle}>{ipAddress}</Text>
        <Text style={[styles.headerSubtitle, styles.connectionStatus]}>{connectionStatus}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.connectionContainer}>
          <View style={styles.ipInputContainer}>
            <TextInput
              style={styles.input}
              placeholder="IP del compañero"
              value={targetIp}
              onChangeText={setTargetIp}
              keyboardType="numeric"
              editable={!isConnected}
            />
            {ipHistory.length > 0 && !isConnected && (
              <FlatList
                data={ipHistory}
                style={styles.ipHistoryList}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.ipHistoryItem}
                    onPress={() => setTargetIp(item)}
                  >
                    <Text style={styles.ipHistoryText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
          {isConnected ? (
            <TouchableOpacity
              style={[styles.button, styles.disconnectButton]}
              onPress={disconnectPeer}
            >
              <Text style={styles.buttonText}>Desconectar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.connectButton]}
              onPress={connectToPeer}
            >
              <Text style={styles.buttonText}>Conectar</Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={[
              styles.messageBubble,
              item.sender === 'Me' ? styles.sentMessage : styles.receivedMessage
            ]}>
              <Text style={styles.messageText}>{item.text}</Text>
            </View>
          )}
          contentContainerStyle={styles.messagesContainer}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Escribe un mensaje..."
            value={messageText}
            onChangeText={setMessageText}
            editable={isConnected}
          />
          <TouchableOpacity
            style={[styles.button, styles.sendButton]}
            onPress={sendMessage}
            disabled={!isConnected}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#0f065a',
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  connectionStatus: {
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
    backgroundColor: '#E7EDF3',
  },
  connectionContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButton: {
    backgroundColor: '#0f065a',
  },
  disconnectButton: {
    backgroundColor: '#95A5A6',
  },
  sendButton: {
    backgroundColor: '#0f065a',
    borderRadius: 24,
    width: 48,
    height: 48,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  messagesContainer: {
    flexGrow: 1,
    gap: 8,
    paddingVertical: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#E3F2FD',
    borderBottomRightRadius: 4,
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#2C3E50',
    fontSize: 15,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    padding: 12,
    fontSize: 15,
    maxHeight: 100,
  },
  ipInputContainer: {
    flex: 1,
    position: 'relative',
  },
  ipHistoryList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    maxHeight: 150,
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  ipHistoryItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ipHistoryText: {
    fontSize: 15,
    color: '#2C3E50',
  },
});